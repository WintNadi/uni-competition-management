package com.project.Backend.Achievement;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.project.Backend.Competition.Competition;
import com.project.Backend.Milestone.Milestone;
import com.project.Backend.Milestone.MilestoneRepository;
import com.project.Backend.MyExternalParticipation.MyExternalParticipation;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Social.SocialPost;
import com.project.Backend.Social.SocialPostRepository;
import com.project.Backend.Submission.Submission;
import com.project.Backend.Submission.SubmissionRepository;
import com.project.Backend.Submission.SubmissionStatus;
import com.project.Backend.Team.Team;
import com.project.Backend.Team.TeamRepository;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RecognitionService {

    private final AchievementRepository achievementRepository;
    private final MilestoneRepository milestoneRepository;
    private final SocialPostRepository socialPostRepository;
    private final SubmissionRepository submissionRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public void processInternalEvaluation(Competition competition, Submission submission) {
        if (competition == null || submission == null || competition.getCompetitionId() == null
                || competition.getCompetitionId().isBlank()) {
            return;
        }
        List<Submission> evaluatedSubmissions = submissionRepository.findByCompetitionId(competition.getCompetitionId())
                .stream()
                .filter(Objects::nonNull)
                .filter(item -> item.getSubmissionStatus() == SubmissionStatus.EVALUATED)
                .filter(item -> item.getMarksAwarded() != null)
                .sorted(Comparator
                        .comparing((Submission item) -> Math.max(0, item.getMarksAwarded()))
                        .reversed()
                        .thenComparing(item -> item.getSubmittedAt() == null ? LocalDateTime.MIN : item.getSubmittedAt())
                        .thenComparing(item -> item.getSubmissionId() == null ? "" : item.getSubmissionId()))
                .toList();
        if (evaluatedSubmissions.isEmpty()) {
            return;
        }

        Map<String, Integer> rankBySubmissionId = buildRankMap(evaluatedSubmissions);
        int maxMarksAwarded = evaluatedSubmissions.stream()
                .mapToInt(item -> Math.max(0, item.getMarksAwarded() == null ? 0 : item.getMarksAwarded()))
                .max()
                .orElse(1);
        int totalMarks = resolveTotalMarks(competition, maxMarksAwarded);

        for (Submission evaluatedSubmission : evaluatedSubmissions) {
            if (evaluatedSubmission.getSubmissionId() == null || evaluatedSubmission.getSubmissionId().isBlank()) {
                continue;
            }
            List<String> recipients = resolveRecipients(evaluatedSubmission);
            if (recipients.isEmpty()) {
                continue;
            }
            int rankPosition = rankBySubmissionId.getOrDefault(
                    evaluatedSubmission.getSubmissionId(),
                    evaluatedSubmissions.size());
            MeritRule rule = buildInternalRule(evaluatedSubmission, rankPosition, totalMarks);

            for (String studentId : recipients) {
                if (studentId == null || studentId.isBlank()) {
                    continue;
                }
                Achievement achievement = achievementRepository
                        .findByStudentIdAndSubmissionId(studentId, evaluatedSubmission.getSubmissionId())
                            .orElseGet(Achievement::new)
                        ;
                boolean isNewAchievement = achievement.getAchievementId() == null
                        || achievement.getAchievementId().isBlank();

                achievement.setStudentId(studentId);
                achievement.setCompetitionId(competition.getCompetitionId());
                achievement.setCompetitionTitle(competition.getTitle());
                achievement.setCompetitionType("INTERNAL");
                achievement.setSubmissionId(evaluatedSubmission.getSubmissionId());
                achievement.setTeamId(evaluatedSubmission.getTeamId());
                achievement.setTeamAchievement(evaluatedSubmission.isTeamSubmission());
                achievement.setResultLabel(rule.resultLabel());
                achievement.setBadge(rule.badge());
                achievement.setScore(rule.points());
                achievement.setAchievedAt(LocalDateTime.now());
                Achievement saved = achievementRepository.save(achievement);
                if (isNewAchievement) {
                    notificationService.sendAchievementEarnedNotification(
                            studentId,
                            saved.getBadge(),
                            saved.getAchievementId());
                }
                syncMilestones(studentId);
            }

            if ("Participant".equalsIgnoreCase(rule.rankLabel())) {
                socialPostRepository.findBySubmissionId(evaluatedSubmission.getSubmissionId())
                        .ifPresent(socialPostRepository::delete);
                continue;
            }

            Team team = evaluatedSubmission.getTeamId() != null
                    ? teamRepository.findById(evaluatedSubmission.getTeamId()).orElse(null)
                    : null;
            String winnerLabel = team != null && team.getTeamName() != null && !team.getTeamName().isBlank()
                    ? team.getTeamName()
                    : resolveDisplayName(recipients.get(0));
            String postMessage = buildInternalPostMessage(competition, recipients, team, rule);

            SocialPost post = socialPostRepository.findBySubmissionId(evaluatedSubmission.getSubmissionId())
                    .orElseGet(SocialPost::new);
            if (post.getCreatedAt() == null) {
                post.setCreatedAt(LocalDateTime.now());
            }
            post.setSourceType("INTERNAL_EVALUATION");
            post.setCompetitionId(competition.getCompetitionId());
            post.setCompetitionTitle(competition.getTitle());
            post.setSubmissionId(evaluatedSubmission.getSubmissionId());
            post.setWinnerLabel(winnerLabel);
            post.setRankLabel(rule.rankLabel());
            post.setContent(postMessage);
            post.setRelatedStudentIds(new ArrayList<>(recipients));
            post.setTeamId(team != null ? team.getTeamId() : null);
            post.setTeamName(team != null ? team.getTeamName() : null);
            post.setSystemGenerated(true);
            socialPostRepository.save(post);
        }
    }

    public void processExternalApproval(MyExternalParticipation participation) {
        if (participation == null || participation.getOwnerId() == null || participation.getOwnerId().isBlank()) {
            return;
        }
        String studentId = participation.getOwnerId();
        MeritRule rule = buildExternalRule(participation.getParticipationResult());

        if (!achievementRepository.existsByStudentIdAndExternalParticipationId(studentId, participation.getId())) {
            Achievement achievement = Achievement.builder()
                    .studentId(studentId)
                    .competitionId(participation.getCompetitionId())
                    .competitionTitle(participation.getTitle())
                    .competitionType("EXTERNAL")
                    .externalParticipationId(participation.getId())
                    .resultLabel(rule.resultLabel())
                    .badge(rule.badge())
                    .score(rule.points())
                    .achievedAt(LocalDateTime.now())
                    .build();
            Achievement saved = achievementRepository.save(achievement);
            notificationService.sendAchievementEarnedNotification(
                    studentId,
                    saved.getBadge(),
                    saved.getAchievementId());
            syncMilestones(studentId);
        }

        if (!isTopThreeResult(rule)) {
            if (participation.getId() != null) {
                socialPostRepository.deleteByExternalParticipationId(participation.getId());
            }
            return;
        }
        if (participation.getId() != null
                && socialPostRepository.existsByExternalParticipationId(participation.getId())) {
            return;
        }

        String studentName = resolveDisplayName(studentId);
        String competitionTitle = safeText(participation.getTitle(), "External Competition");
        String message = studentName + " achieved " + rule.resultLabel() + " in " + competitionTitle
                + ". Congratulations on the outstanding performance!";
        SocialPost post = SocialPost.builder()
                .sourceType("EXTERNAL_APPROVAL")
                .competitionId(participation.getCompetitionId())
                .competitionTitle(participation.getTitle())
                .externalParticipationId(participation.getId())
                .winnerLabel(studentName)
                .rankLabel(rule.rankLabel())
                .content(message)
                .relatedStudentIds(List.of(studentId))
                .createdAt(LocalDateTime.now())
                .build();
        socialPostRepository.save(post);
    }

    public void rollbackExternalApproval(String externalParticipationId) {
        if (externalParticipationId == null || externalParticipationId.isBlank()) {
            return;
        }
        achievementRepository.deleteByExternalParticipationId(externalParticipationId);
        socialPostRepository.deleteByExternalParticipationId(externalParticipationId);
    }

    private boolean isTopThreeResult(MeritRule rule) {
        if (rule == null) {
            return false;
        }
        String normalized = safeText(rule.resultLabel(), "").toLowerCase(Locale.ROOT);
        return normalized.contains("top 1")
                || normalized.contains("top 2")
                || normalized.contains("top 3");
    }

    private int resolveTotalMarks(Competition competition, int marksAwarded) {
        int totalMarks = competition.getTotalMarks() == null ? 0 : competition.getTotalMarks();
        if (totalMarks <= 0) {
            return Math.max(marksAwarded, 1);
        }
        return totalMarks;
    }

    private MeritRule buildInternalRule(
            Submission submission,
            int rankPosition,
            int totalMarks) {
        int marksAwarded = Math.max(0, submission.getMarksAwarded() == null ? 0 : submission.getMarksAwarded());
        double percentage = totalMarks <= 0 ? 0 : (marksAwarded * 100.0 / totalMarks);
        int evaluatedScore = (int) Math.round(percentage);
        String rankLabel;
        String resultLabel;
        if (rankPosition == 1) {
            rankLabel = "Gold";
            resultLabel = "Winner";
        } else if (rankPosition == 2) {
            rankLabel = "Silver";
            resultLabel = "2nd Place";
        } else if (rankPosition == 3) {
            rankLabel = "Bronze";
            resultLabel = "3rd Place";
        } else {
            rankLabel = "Participant";
            resultLabel = "Participant";
        }

        int rankBonus = switch (rankLabel) {
            case "Gold" -> 40;
            case "Silver" -> 30;
            case "Bronze" -> 20;
            default -> 5;
        };
        int points = Math.max(10, Math.min(180, evaluatedScore + rankBonus));
        String badge = switch (rankLabel) {
            case "Gold" -> "Gold Achievement";
            case "Silver" -> "Silver Achievement";
            case "Bronze" -> "Bronze Achievement";
            default -> "Participation Badge";
        };
        return new MeritRule(points, badge, rankLabel, resultLabel);
    }

    private Map<String, Integer> buildRankMap(List<Submission> rankedSubmissions) {
        Map<String, Integer> rankBySubmissionId = new HashMap<>();
        int currentRank = 0;
        Integer previousMarks = null;
        for (int index = 0; index < rankedSubmissions.size(); index++) {
            Submission item = rankedSubmissions.get(index);
            if (item.getSubmissionId() == null || item.getSubmissionId().isBlank()) {
                continue;
            }
            int marks = Math.max(0, item.getMarksAwarded() == null ? 0 : item.getMarksAwarded());
            if (previousMarks == null || marks != previousMarks) {
                currentRank = index + 1;
                previousMarks = marks;
            }
            rankBySubmissionId.put(item.getSubmissionId(), currentRank);
        }
        return rankBySubmissionId;
    }

    private MeritRule buildExternalRule(String participationResult) {
        String normalized = safeText(participationResult, "Participant").toLowerCase(Locale.ROOT);
        if (normalized.contains("2nd runner up") || normalized.contains("second runner up")) {
            return new MeritRule(80, "External Bronze Badge", "Bronze", "Top 3");
        }
        if (normalized.contains("1st runner up") || normalized.contains("first runner up")) {
            return new MeritRule(90, "External Silver Badge", "Silver", "Top 2");
        }
        if (normalized.contains("winner")
                || normalized.contains("champion")
                || normalized.contains("1st")
                || normalized.contains("first")
                || normalized.contains("top 1")) {
            return new MeritRule(100, "External Gold Badge", "Gold", "Top 1");
        }
        if (normalized.contains("runner")
                || normalized.contains("2nd")
                || normalized.contains("second")
                || normalized.contains("top 2")) {
            return new MeritRule(90, "External Silver Badge", "Silver", "Top 2");
        }
        if (normalized.contains("3rd")
                || normalized.contains("third")
                || normalized.contains("top 3")) {
            return new MeritRule(80, "External Bronze Badge", "Bronze", "Top 3");
        }
        if (normalized.contains("top 5")) {
            return new MeritRule(70, "External Top 5 Badge", "Bronze", "Top 5");
        }
        if (normalized.contains("top 10")) {
            return new MeritRule(60, "External Top 10 Badge", "Bronze", "Top 10");
        }
        if (normalized.contains("final")) {
            return new MeritRule(55, "External Finalist Badge", "Bronze", "Finalist");
        }
        if (normalized.contains("participant") || normalized.contains("participation")) {
            return new MeritRule(40, "External Participation Badge", "Participant", "Participant");
        }
        return new MeritRule(50, "External Merit Badge", "Participant", safeText(participationResult, "Participant"));
    }

    private List<String> resolveRecipients(Submission submission) {
        if (submission.getTeamId() == null || submission.getTeamId().isBlank()) {
            return submission.getSubmittedBy() == null || submission.getSubmittedBy().isBlank()
                    ? List.of()
                    : List.of(submission.getSubmittedBy());
        }
        Team team = teamRepository.findById(submission.getTeamId()).orElse(null);
        if (team == null) {
            return submission.getSubmittedBy() == null || submission.getSubmittedBy().isBlank()
                    ? List.of()
                    : List.of(submission.getSubmittedBy());
        }
        Set<String> out = new LinkedHashSet<>();
        if (team.getLeaderId() != null && !team.getLeaderId().isBlank()) {
            out.add(team.getLeaderId());
        }
        if (team.getAcceptedMemberIds() != null) {
            for (String memberId : team.getAcceptedMemberIds()) {
                if (memberId != null && !memberId.isBlank()) {
                    out.add(memberId);
                }
            }
        }
        return new ArrayList<>(out);
    }

    private String buildInternalPostMessage(
            Competition competition,
            List<String> recipients,
            Team team,
            MeritRule rule) {
        String competitionTitle = safeText(competition.getTitle(), "the competition");
        if (team != null) {
            String teamName = safeText(team.getTeamName(), "Team");
            if ("Gold".equalsIgnoreCase(rule.rankLabel())) {
                return "Team " + teamName + " is winner in " + competitionTitle
                        + ". Congratulations on the outstanding performance!";
            }
            if ("Silver".equalsIgnoreCase(rule.rankLabel())) {
                return "Team " + teamName + " achieved 2nd Place in " + competitionTitle
                        + ". Congratulations on the outstanding performance!";
            }
            if ("Bronze".equalsIgnoreCase(rule.rankLabel())) {
                return "Team " + teamName + " achieved 3rd Place in " + competitionTitle
                        + ". Congratulations on the outstanding performance!";
            }
            return "Team " + teamName + " completed " + competitionTitle + ".";
        }
        String studentName = resolveDisplayName(recipients.get(0));
        if ("Gold".equalsIgnoreCase(rule.rankLabel())) {
            return studentName + " is winner in " + competitionTitle
                    + ". Congratulations on the outstanding performance!";
        }
        if ("Silver".equalsIgnoreCase(rule.rankLabel())) {
            return studentName + " achieved 2nd Place in " + competitionTitle
                    + ". Congratulations on the outstanding performance!";
        }
        if ("Bronze".equalsIgnoreCase(rule.rankLabel())) {
            return studentName + " achieved 3rd Place in " + competitionTitle
                    + ". Congratulations on the outstanding performance!";
        }
        return studentName + " completed " + competitionTitle + ".";
    }

    private String resolveDisplayName(String userId) {
        if (userId == null || userId.isBlank()) {
            return "Student";
        }
        return userRepository.findById(userId)
                .map(this::resolveDisplayName)
                .orElse("Student");
    }

    private String resolveDisplayName(User user) {
        if (user == null) {
            return "Student";
        }
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName().trim();
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().trim();
        }
        return "Student";
    }

    private void syncMilestones(String studentId) {
        if (studentId == null || studentId.isBlank()) {
            return;
        }
        int totalPoints = achievementRepository.findByStudentIdOrderByAchievedAtDesc(studentId)
                .stream()
                .map(achievement -> achievement.getScore() == null ? 0 : achievement.getScore())
                .reduce(0, Integer::sum);

        List<MilestoneThreshold> thresholds = List.of(
                new MilestoneThreshold(100, "Bronze Merit"),
                new MilestoneThreshold(250, "Silver Merit"),
                new MilestoneThreshold(500, "Gold Merit"),
                new MilestoneThreshold(800, "Platinum Merit"));

        for (MilestoneThreshold threshold : thresholds) {
            if (totalPoints < threshold.points()) {
                continue;
            }
            if (milestoneRepository.existsByStudentIdAndTitle(studentId, threshold.title())) {
                continue;
            }
            Milestone milestone = Milestone.builder()
                    .studentId(studentId)
                    .title(threshold.title())
                    .points(threshold.points())
                    .achievedAt(LocalDateTime.now().toString())
                    .build();
            milestoneRepository.save(milestone);
        }
    }

    private String safeText(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    private record MeritRule(
            int points,
            String badge,
            String rankLabel,
            String resultLabel) {
    }

    private record MilestoneThreshold(
            int points,
            String title) {
    }
}
