package com.project.Backend.AdminReports;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.project.Backend.Achievement.Achievement;
import com.project.Backend.Achievement.AchievementRepository;
import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.MyExternalParticipation.MyExternalParticipation;
import com.project.Backend.MyExternalParticipation.MyExternalParticipationRepository;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ParticipationScopeReportService {

    private static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Yangon");

    private final AchievementRepository achievementRepository;
    private final CompetitionRepository competitionRepository;
    private final MyExternalParticipationRepository externalRepository;
    private final UserRepository userRepository;

    private static final class ResolutionContext {
        private final Map<String, Competition> competitionById;
        private final Map<String, MyExternalParticipation> externalById;
        private final Map<String, User> studentById;

        private ResolutionContext(
                Map<String, Competition> competitionById,
                Map<String, MyExternalParticipation> externalById,
                Map<String, User> studentById) {
            this.competitionById = competitionById;
            this.externalById = externalById;
            this.studentById = studentById;
        }
    }

    private ResolutionContext buildResolutionContext(Collection<Achievement> achievements) {
        Set<String> competitionIds = achievements.stream()
                .map(Achievement::getCompetitionId)
                .filter(this::hasText)
                .collect(Collectors.toSet());
        Set<String> externalIds = achievements.stream()
                .map(Achievement::getExternalParticipationId)
                .filter(this::hasText)
                .collect(Collectors.toSet());
        Set<String> studentIds = achievements.stream()
                .map(Achievement::getStudentId)
                .filter(this::hasText)
                .collect(Collectors.toSet());

        Map<String, Competition> competitionById = new HashMap<>();
        if (!competitionIds.isEmpty()) {
            for (Competition competition : competitionRepository.findAllById(competitionIds)) {
                if (competition == null || !hasText(competition.getCompetitionId())) {
                    continue;
                }
                competitionById.put(competition.getCompetitionId(), competition);
            }
        }

        Map<String, MyExternalParticipation> externalById = new HashMap<>();
        if (!externalIds.isEmpty()) {
            for (MyExternalParticipation external : externalRepository.findAllById(externalIds)) {
                if (external == null || !hasText(external.getId())) {
                    continue;
                }
                externalById.put(external.getId(), external);
            }
        }

        Map<String, User> studentById = new HashMap<>();
        if (!studentIds.isEmpty()) {
            for (User student : userRepository.findAllById(studentIds)) {
                if (student == null || !hasText(student.getId())) {
                    continue;
                }
                studentById.put(student.getId(), student);
            }
        }

        return new ResolutionContext(competitionById, externalById, studentById);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String normalizeScope(String scale) {
        if (scale == null) {
            return "LOCAL";
        }
        String normalized = scale.toLowerCase(Locale.ROOT);
        if (normalized.contains("international")) {
            return "INTERNATIONAL";
        }
        if (normalized.contains("national")) {
            return "NATIONAL";
        }
        return "LOCAL";
    }

    private boolean isExternalAchievement(Achievement achievement) {
        return hasText(achievement.getExternalParticipationId())
                || "EXTERNAL".equalsIgnoreCase(safeStr(achievement.getCompetitionType()));
    }

    private String resolveScope(Achievement achievement, ResolutionContext context) {
        if (isExternalAchievement(achievement) && hasText(achievement.getExternalParticipationId())) {
            MyExternalParticipation external = context.externalById.get(achievement.getExternalParticipationId());
            if (external != null) {
                return normalizeScope(external.getScale());
            }
        }
        if (hasText(achievement.getCompetitionId())) {
            Competition competition = context.competitionById.get(achievement.getCompetitionId());
            if (competition != null) {
                return normalizeScope(competition.getScale());
            }
        }
        return "LOCAL";
    }

    private String resolveCompetitionTitle(Achievement achievement, ResolutionContext context) {
        if (hasText(achievement.getExternalParticipationId())) {
            MyExternalParticipation external = context.externalById.get(achievement.getExternalParticipationId());
            if (external != null && hasText(external.getTitle())) {
                return external.getTitle().trim();
            }
        }
        if (hasText(achievement.getCompetitionId())) {
            Competition competition = context.competitionById.get(achievement.getCompetitionId());
            if (competition != null && hasText(competition.getTitle())) {
                return competition.getTitle().trim();
            }
        }
        if (hasText(achievement.getCompetitionTitle())) {
            return achievement.getCompetitionTitle().trim();
        }
        return "";
    }

    private String displayName(User user) {
        if (user == null) {
            return "Student";
        }
        if (hasText(user.getFullName())) {
            return user.getFullName().trim();
        }
        if (hasText(user.getUsername())) {
            return user.getUsername().trim();
        }
        if (hasText(user.getEmail())) {
            return user.getEmail().trim();
        }
        return "Student";
    }

    private String resolveStudentName(String studentId, ResolutionContext context) {
        if (!hasText(studentId)) {
            return "Student";
        }
        User student = context.studentById.get(studentId);
        if (student != null) {
            return displayName(student);
        }
        // Fallback for legacy data where studentId may contain username/email directly.
        return studentId.trim();
    }

    private boolean containsIgnoreCase(String value, String queryLower) {
        if (!hasText(value) || !hasText(queryLower)) {
            return false;
        }
        return value.toLowerCase(Locale.ROOT).contains(queryLower);
    }

    private boolean matchesNameFilter(String queryLower, String studentId, String studentName, User student) {
        if (!hasText(queryLower)) {
            return true;
        }
        return containsIgnoreCase(studentName, queryLower)
                || containsIgnoreCase(studentId, queryLower)
                || containsIgnoreCase(student != null ? student.getFullName() : null, queryLower)
                || containsIgnoreCase(student != null ? student.getUsername() : null, queryLower)
                || containsIgnoreCase(student != null ? student.getEmail() : null, queryLower);
    }

    private boolean isAwardResult(String resultLabel) {
        String normalized = safeStr(resultLabel);
        return !normalized.equalsIgnoreCase("Participant")
                && !normalized.equalsIgnoreCase("Participation");
    }

    public ParticipationScopeSummaryDTO getSummary() {
        List<Achievement> all = achievementRepository.findAll();
        if (all.isEmpty()) {
            return new ParticipationScopeSummaryDTO(0, 0, 0);
        }
        ResolutionContext context = buildResolutionContext(all);

        long local = 0;
        long national = 0;
        long international = 0;

        for (Achievement achievement : all) {
            String scope = resolveScope(achievement, context);
            switch (scope) {
                case "INTERNATIONAL" -> international++;
                case "NATIONAL" -> national++;
                default -> local++;
            }
        }
        return new ParticipationScopeSummaryDTO(local, national, international);
    }

    public List<ParticipationScopeStudentDTO> getDetails(String filterScope, String q, String month) {
        List<Achievement> all = achievementRepository.findAll();
        if (all.isEmpty()) {
            return List.of();
        }

        YearMonth targetMonth = null;
        try {
            if (hasText(month)) {
                targetMonth = YearMonth.parse(month.trim());
            }
        } catch (Exception ignored) {
            targetMonth = null;
        }

        final YearMonth monthFilter = targetMonth;
        if (monthFilter != null) {
            all = all.stream()
                    .filter(achievement -> {
                        LocalDateTime achievedAt = achievement.getAchievedAt();
                        if (achievedAt == null) {
                            return false;
                        }
                        YearMonth current = YearMonth.from(achievedAt.atZone(REPORT_ZONE));
                        return monthFilter.equals(current);
                    })
                    .collect(Collectors.toList());
        }
        if (all.isEmpty()) {
            return List.of();
        }

        ResolutionContext context = buildResolutionContext(all);

        Map<String, List<Achievement>> groupedByStudent = all.stream()
                .collect(Collectors.groupingBy(achievement -> safeStr(achievement.getStudentId())));
        String queryLower = safeStr(q).toLowerCase(Locale.ROOT);

        List<ParticipationScopeStudentDTO> result = new ArrayList<>();

        for (Map.Entry<String, List<Achievement>> entry : groupedByStudent.entrySet()) {
            String studentId = safeStr(entry.getKey());
            List<Achievement> achievements = entry.getValue();
            String studentName = resolveStudentName(studentId, context);
            User student = context.studentById.get(studentId);

            if (!matchesNameFilter(queryLower, studentId, studentName, student)) {
                continue;
            }

            long local = 0;
            long national = 0;
            long international = 0;
            long awards = 0;
            Set<String> competitionNames = new LinkedHashSet<>();
            List<ParticipationScopeItemDTO> items = new ArrayList<>(achievements.size());

            for (Achievement achievement : achievements) {
                String scope = resolveScope(achievement, context);
                String competitionTitle = resolveCompetitionTitle(achievement, context);
                String resultLabel = safeStr(achievement.getResultLabel());

                if (isAwardResult(resultLabel)) {
                    awards++;
                }
                if (hasText(competitionTitle)) {
                    competitionNames.add(competitionTitle);
                }

                switch (scope) {
                    case "INTERNATIONAL" -> international++;
                    case "NATIONAL" -> national++;
                    default -> local++;
                }

                items.add(new ParticipationScopeItemDTO(
                        competitionTitle,
                        scope,
                        resultLabel,
                        achievement.getAchievedAt(),
                        isExternalAchievement(achievement) ? "EXTERNAL" : "INTERNAL"));
            }

            items.sort(Comparator
                    .comparing(ParticipationScopeItemDTO::getAchievedAt,
                            Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(item -> safeStr(item.getCompetitionTitle())));

            if (filterScope != null && !filterScope.equalsIgnoreCase("ALL")) {
                if (filterScope.equalsIgnoreCase("LOCAL") && local == 0) {
                    continue;
                }
                if (filterScope.equalsIgnoreCase("NATIONAL") && national == 0) {
                    continue;
                }
                if (filterScope.equalsIgnoreCase("INTERNATIONAL") && international == 0) {
                    continue;
                }
            }

            long total = local + national + international;
            result.add(new ParticipationScopeStudentDTO(
                    studentId,
                    studentName,
                    total,
                    awards,
                    local,
                    national,
                    international,
                    new ArrayList<>(competitionNames),
                    items));
        }

        result.sort(Comparator
                .comparingLong(ParticipationScopeStudentDTO::getTotal)
                .reversed()
                .thenComparing(item -> safeStr(item.getStudentName()), String.CASE_INSENSITIVE_ORDER));

        return result;
    }

    private String safeStr(String value) {
        return value == null ? "" : value.trim();
    }
}
