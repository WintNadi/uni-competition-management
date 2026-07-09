package com.project.Backend.Leaderboard;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.OffsetDateTime;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.project.Backend.Achievement.Achievement;
import com.project.Backend.Achievement.AchievementRepository;
import com.project.Backend.Auth.Role;
import com.project.Backend.Social.SocialPost;
import com.project.Backend.Social.SocialPostRepository;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private static final int SOCIAL_POST_WEIGHT = 10;
    private static final int SOCIAL_LIKE_WEIGHT = 1;
    private static final int SOCIAL_COMMENT_WEIGHT = 2;

    private final UserRepository userRepository;
    private final AchievementRepository achievementRepository;
    private final SocialPostRepository socialPostRepository;

    private final com.project.Backend.Competition.CompetitionRepository competitionRepository;
    private final com.project.Backend.MyExternalParticipation.MyExternalParticipationRepository externalRepository;

    public List<MeritLeaderboardEntry> getMeritLeaderboard(Integer limit) {
        return getMeritLeaderboard(limit, "all", "all");
    }

    public List<MeritLeaderboardEntry> getMeritLeaderboard(Integer limit, String timePeriod, String competitionType) {
        List<User> students = userRepository.findByRoles(Role.ROLE_STUDENT);
        List<MeritLeaderboardEntry> entries = new ArrayList<>();

        for (User student : students) {
            String studentId = student.getId();

            List<Achievement> allAchievements = achievementRepository.findByStudentIdOrderByAchievedAtDesc(studentId);

            // Apply filters here
            List<Achievement> achievements = allAchievements.stream()
                    .filter(a -> inPeriod(a, timePeriod))
                    .filter(a -> matchesCompetitionType(a, competitionType))
                    .collect(Collectors.toList());

            int points = achievements.stream()
                    .map(a -> a.getScore() == null ? 0 : a.getScore())
                    .reduce(0, Integer::sum);

            int participations = achievements.size(); // includes Participant

            int awardedAchievementsCount = (int) achievements.stream()
                    .filter(a -> !isParticipantAchievement(a))
                    .count();

            int wins = (int) achievements.stream()
                    .filter(a -> !isParticipantAchievement(a))
                    .count();

            int competitions = (int) achievements.stream()
                    .map(a -> a.getCompetitionId() == null ? a.getCompetitionTitle() : a.getCompetitionId())
                    .filter(v -> v != null && !v.isBlank())
                    .distinct()
                    .count();

            if (points <= 0)
                continue;

            entries.add(new MeritLeaderboardEntry(
                    studentId,
                    displayName(student),
                    initials(student),
                    safeText(student.getDepartment()),
                    points,
                    awardedAchievementsCount,
                    participations,
                    competitions,
                    wins,
                    "same",
                    0));
        }

        List<MeritLeaderboardEntry> sorted = entries.stream()
                .sorted(Comparator.<MeritLeaderboardEntry>comparingInt(MeritLeaderboardEntry::points).reversed()
                        .thenComparing(Comparator.comparingInt(MeritLeaderboardEntry::achievements).reversed())
                        .thenComparing(e -> e.name() == null ? "" : e.name().toLowerCase(Locale.ROOT)))
                .collect(Collectors.toList());

        return applyRankAndLimitMerit(sorted, limit);
    }

    public List<SocialLeaderboardEntry> getSocialLeaderboard(Integer limit, String timePeriod) {
        List<User> students = userRepository.findByRoles(Role.ROLE_STUDENT);

        Map<String, SocialAggregate> aggregates = new HashMap<>();
        for (User student : students) {
            aggregates.put(student.getId(), new SocialAggregate());
        }

        ZonedDateTime now = ZonedDateTime.now(REPORT_ZONE);
        ZonedDateTime start = periodStart(now, timePeriod);

        // IMPORTANT: use sorted list (same as your feed)
        for (SocialPost post : socialPostRepository.findAllByOrderByCreatedAtDesc()) {
            List<String> related = post.getRelatedStudentIds() == null ? List.of() : post.getRelatedStudentIds();
            if (related.isEmpty())
                continue;

            Set<String> recipients = new java.util.LinkedHashSet<>(related);

            // 1) POSTS count: only if post.createdAt is in range
            int postCreatedInPeriod = isBetween(toZdt(post.getCreatedAt()), start, now) ? 1 : 0;

            // 2) LIKES count: count likes[] createdAt in range
            int likesInPeriod = 0;
            if (post.getLikes() != null && !post.getLikes().isEmpty()) {
                likesInPeriod = (int) post.getLikes().stream()
                        .map(SocialPost.SocialLike::getCreatedAt)
                        .map(this::toZdt)
                        .filter(z -> isBetween(z, start, now))
                        .count();
            } else {
                // fallback for old docs: if only likedUserIds exists, we can't time-filter them
                // accurately.
                // Option A (strict): count 0
                likesInPeriod = 0;
                // Option B (approx): treat them as happened at post.createdAt if post is in
                // period
                // likesInPeriod = postCreatedInPeriod == 1 ? (post.getLikesCount() == null ? 0
                // : post.getLikesCount()) : 0;
            }

            // 3) COMMENTS count: count comments createdAt in range (you already store
            // createdAt per comment)
            int commentsInPeriod = 0;
            if (post.getComments() != null && !post.getComments().isEmpty()) {
                commentsInPeriod = (int) post.getComments().stream()
                        .map(SocialPost.SocialComment::getCreatedAt)
                        .map(this::toZdt)
                        .filter(z -> isBetween(z, start, now))
                        .count();
            }

            // If nothing happened in period, skip
            if (postCreatedInPeriod == 0 && likesInPeriod == 0 && commentsInPeriod == 0)
                continue;

            for (String studentId : recipients) {
                SocialAggregate agg = aggregates.get(studentId);
                if (agg == null)
                    continue;

                agg.posts += postCreatedInPeriod;
                agg.likes += likesInPeriod;
                agg.comments += commentsInPeriod;
            }
        }

        List<SocialLeaderboardEntry> entries = new ArrayList<>();
        for (User student : students) {
            SocialAggregate agg = aggregates.getOrDefault(student.getId(), new SocialAggregate());

            int score = agg.posts * SOCIAL_POST_WEIGHT
                    + agg.likes * SOCIAL_LIKE_WEIGHT
                    + agg.comments * SOCIAL_COMMENT_WEIGHT;

            if (score <= 0)
                continue;

            entries.add(new SocialLeaderboardEntry(
                    student.getId(),
                    displayName(student),
                    initials(student),
                    safeText(student.getDepartment()),
                    score,
                    agg.likes,
                    agg.comments,
                    agg.posts,
                    "same",
                    0));
        }

        List<SocialLeaderboardEntry> sorted = entries.stream()
                .sorted(Comparator.<SocialLeaderboardEntry>comparingInt(SocialLeaderboardEntry::socialScore).reversed()
                        .thenComparing(Comparator.comparingInt(SocialLeaderboardEntry::likes).reversed())
                        .thenComparing(Comparator.comparingInt(SocialLeaderboardEntry::comments).reversed())
                        .thenComparing(e -> e.name() == null ? "" : e.name().toLowerCase(Locale.ROOT)))
                .collect(Collectors.toList());

        return applyRankAndLimitSocial(sorted, limit);
    }

    private List<MeritLeaderboardEntry> applyRankAndLimitMerit(
            List<MeritLeaderboardEntry> entries,
            Integer limit) {
        int max = limit == null || limit <= 0 ? entries.size() : Math.min(limit, entries.size());
        List<MeritLeaderboardEntry> out = new ArrayList<>(max);
        for (int index = 0; index < max; index++) {
            MeritLeaderboardEntry item = entries.get(index);
            out.add(item.withRank(index + 1));
        }
        return out;
    }

    private List<SocialLeaderboardEntry> applyRankAndLimitSocial(
            List<SocialLeaderboardEntry> entries,
            Integer limit) {
        int max = limit == null || limit <= 0 ? entries.size() : Math.min(limit, entries.size());
        List<SocialLeaderboardEntry> out = new ArrayList<>(max);
        for (int index = 0; index < max; index++) {
            SocialLeaderboardEntry item = entries.get(index);
            out.add(item.withRank(index + 1));
        }
        return out;
    }

    private boolean isParticipantAchievement(Achievement achievement) {
        if (achievement == null) {
            return true;
        }
        String resultLabel = safeText(achievement.getResultLabel()).toLowerCase(Locale.ROOT);
        String badge = safeText(achievement.getBadge()).toLowerCase(Locale.ROOT);
        return resultLabel.contains("participant") || badge.contains("participation");
    }

    private String displayName(User user) {
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

    private String initials(User user) {
        String name = displayName(user);
        String[] parts = name.split("\\s+");
        if (parts.length == 0) {
            return "ST";
        }
        if (parts.length == 1) {
            return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase(Locale.ROOT);
        }
        String first = parts[0].substring(0, 1);
        String last = parts[parts.length - 1].substring(0, 1);
        return (first + last).toUpperCase(Locale.ROOT);
    }

    private String safeText(String value) {
        return safeText(value, "");
    }

    private String safeText(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    // -------------------------
    // Filters (Time + Competition Type)
    // -------------------------
    private ZonedDateTime periodStart(ZonedDateTime now, String periodRaw) {
        String period = safeText(periodRaw, "all").toLowerCase(Locale.ROOT);
        if ("all".equals(period))
            return ZonedDateTime.ofInstant(Instant.EPOCH, REPORT_ZONE);

        return switch (period) {
            case "week" -> now.toLocalDate().with(DayOfWeek.MONDAY).atStartOfDay(REPORT_ZONE);
            case "month" -> now.withDayOfMonth(1).toLocalDate().atStartOfDay(REPORT_ZONE);
            case "semester" -> {
                int m = now.getMonthValue();
                int startMonth = (m <= 6) ? 1 : 7;
                yield ZonedDateTime.of(now.getYear(), startMonth, 1, 0, 0, 0, 0, REPORT_ZONE);
            }
            default -> ZonedDateTime.ofInstant(Instant.EPOCH, REPORT_ZONE);
        };
    }

    private ZonedDateTime toZdt(LocalDateTime ldt) {
        if (ldt == null)
            return null;
        return ldt.atZone(REPORT_ZONE);
    }

    private boolean isBetween(ZonedDateTime t, ZonedDateTime start, ZonedDateTime end) {
        if (t == null)
            return false;
        return !t.isBefore(start) && !t.isAfter(end);
    }

    private static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Yangon"); // change if you want server zone

    private boolean inPeriod(Achievement a, String periodRaw) {
        String period = safeText(periodRaw, "all").toLowerCase(Locale.ROOT);
        if ("all".equals(period))
            return true;

        LocalDateTime ldt = a == null ? null : a.getAchievedAt();
        if (ldt == null)
            return false;

        ZonedDateTime achieved = ldt.atZone(REPORT_ZONE);
        ZonedDateTime now = ZonedDateTime.now(REPORT_ZONE);

        ZonedDateTime start;
        switch (period) {
            case "week": {
                // start of week (Mon 00:00) -> now
                LocalDate today = now.toLocalDate();
                LocalDate monday = today.with(DayOfWeek.MONDAY);
                start = monday.atStartOfDay(REPORT_ZONE);
                break;
            }
            case "month": {
                // first day of month 00:00 -> now
                start = now.withDayOfMonth(1).toLocalDate().atStartOfDay(REPORT_ZONE);
                break;
            }
            case "semester": {
                // simple semester: Jan-Jun or Jul-Dec
                int m = now.getMonthValue();
                int startMonth = (m <= 6) ? 1 : 7;
                start = ZonedDateTime.of(now.getYear(), startMonth, 1, 0, 0, 0, 0, REPORT_ZONE);
                break;
            }
            default:
                return true;
        }

        return !achieved.isBefore(start) && !achieved.isAfter(now);
    }

    private boolean matchesCompetitionType(Achievement a, String typeRaw) {
        String type = safeText(typeRaw, "all").toLowerCase(Locale.ROOT);
        if ("all".equals(type))
            return true;
        if (a == null)
            return false;

        // 1) internal/external fast path
        if ("internal".equals(type) || "external".equals(type)) {
            return safeText(a.getCompetitionType()).toLowerCase(Locale.ROOT).contains(type);
        }

        // 2) category/format/type path (quiz/hackathon/workshop/project)
        String resolved = resolveCompetitionType(a).toLowerCase(Locale.ROOT);
        if (resolved.isBlank())
            return false;
        return resolved.contains(type);
    }

    private String resolveCompetitionType(Achievement a) {
        if (a == null)
            return "";

        // if external participation exists, prefer external participation category/type
        String extId = safeText(a.getExternalParticipationId());
        if (!extId.isBlank()) {
            try {
                Object ext = externalRepository.findById(extId).orElse(null);
                if (ext != null) {
                    String cat = pickStringByReflection(ext, "getCategory");
                    if (!cat.isBlank())
                        return cat;

                    // sometimes it might be "type"
                    String type = pickStringByReflection(ext, "getType");
                    if (!type.isBlank())
                        return type;

                    // fallback: if external has a linked competitionId, try competition
                    String compId = pickStringByReflection(ext, "getCompetitionId");
                    if (!compId.isBlank()) {
                        Object comp = competitionRepository.findById(compId).orElse(null);
                        String fromComp = pickCompetitionTypeFromObject(comp);
                        if (!fromComp.isBlank())
                            return fromComp;
                    }
                }
            } catch (Exception ignored) {
                // keep safe: never break leaderboard if external lookup fails
            }
        }

        // internal competition
        String compId = safeText(a.getCompetitionId());
        if (!compId.isBlank()) {
            try {
                Object comp = competitionRepository.findById(compId).orElse(null);
                return pickCompetitionTypeFromObject(comp);
            } catch (Exception ignored) {
            }
        }

        // last fallback: sometimes title may contain a hint
        return safeText(a.getCompetitionTitle());
    }

    private String pickCompetitionTypeFromObject(Object comp) {
        if (comp == null)
            return "";

        // prefer category, then format, then competitionType
        String category = pickStringByReflection(comp, "getCategory");
        if (!category.isBlank())
            return category;

        String format = pickStringByReflection(comp, "getFormat");
        if (!format.isBlank())
            return format;

        String type = pickStringByReflection(comp, "getCompetitionType");
        if (!type.isBlank())
            return type;

        return "";
    }

    /**
     * Safely call a getter using reflection so we don't depend on the exact
     * entity class methods at compile time.
     */
    private String pickStringByReflection(Object obj, String getterName) {
        if (obj == null)
            return "";
        try {
            Object val = obj.getClass().getMethod(getterName).invoke(obj);
            return safeText(val == null ? "" : String.valueOf(val));
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Supports Achievement.getAchievedAt() returning Instant, Date, LocalDateTime,
     * or String.
     */
    private Optional<Instant> getAchievementInstant(Achievement a) {
        if (a == null)
            return Optional.empty();

        try {
            Object raw = a.getClass().getMethod("getAchievedAt").invoke(a);
            if (raw == null)
                return Optional.empty();

            if (raw instanceof Instant i)
                return Optional.of(i);

            if (raw instanceof Date d)
                return Optional.of(d.toInstant());

            if (raw instanceof LocalDateTime ldt) {
                return Optional.of(ldt.atZone(ZoneId.systemDefault()).toInstant());
            }

            if (raw instanceof String s) {
                String text = s.trim();
                if (text.isEmpty())
                    return Optional.empty();

                // Handles: 2026-02-18T17:03:00.778+00:00
                try {
                    return Optional.of(OffsetDateTime.parse(text).toInstant());
                } catch (Exception ignored) {
                    // fallback: Z format (Instant.parse supports this)
                    try {
                        return Optional.of(Instant.parse(text));
                    } catch (Exception ignored2) {
                        // fallback: LocalDateTime without timezone
                        try {
                            LocalDateTime ldt2 = LocalDateTime.parse(text);
                            return Optional.of(ldt2.atZone(ZoneId.systemDefault()).toInstant());
                        } catch (Exception ignored3) {
                            return Optional.empty();
                        }
                    }
                }
            }

            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private boolean postInPeriod(SocialPost post, String periodRaw) {
        String period = safeText(periodRaw, "all").toLowerCase(Locale.ROOT);
        if ("all".equals(period))
            return true;

        // ✅ get created time (change getter name if yours differs)
        LocalDateTime ldt = null;
        try {
            Object raw = post.getClass().getMethod("getCreatedAt").invoke(post);
            if (raw instanceof LocalDateTime t)
                ldt = t;
            else if (raw instanceof Instant i)
                ldt = LocalDateTime.ofInstant(i, REPORT_ZONE);
            else if (raw instanceof Date d)
                ldt = LocalDateTime.ofInstant(d.toInstant(), REPORT_ZONE);
        } catch (Exception ignored) {
        }

        if (ldt == null)
            return false;

        ZonedDateTime created = ldt.atZone(REPORT_ZONE);
        ZonedDateTime now = ZonedDateTime.now(REPORT_ZONE);

        ZonedDateTime start;
        switch (period) {
            case "week": {
                LocalDate today = now.toLocalDate();
                LocalDate monday = today.with(DayOfWeek.MONDAY);
                start = monday.atStartOfDay(REPORT_ZONE);
                break;
            }
            case "month": {
                start = now.withDayOfMonth(1).toLocalDate().atStartOfDay(REPORT_ZONE);
                break;
            }
            case "semester": {
                int m = now.getMonthValue();
                int startMonth = (m <= 6) ? 1 : 7;
                start = ZonedDateTime.of(now.getYear(), startMonth, 1, 0, 0, 0, 0, REPORT_ZONE);
                break;
            }
            default:
                return true;
        }
        return !created.isBefore(start) && !created.isAfter(now);
    }

    private static class SocialAggregate {
        int likes;
        int comments;
        int posts;
    }

    public record MeritLeaderboardEntry(
            int rank,
            String studentId,
            String name,
            String avatar,
            String department,
            int points,
            int achievements,
            int participations,
            int competitions,
            int wins,
            String trend,
            int change) {

        public MeritLeaderboardEntry(
                String studentId,
                String name,
                String avatar,
                String department,
                int points,
                int achievements,
                int participations,
                int competitions,
                int wins,
                String trend,
                int change) {
            this(0, studentId, name, avatar, department, points, achievements, participations, competitions, wins,
                    trend, change);
        }

        public MeritLeaderboardEntry withRank(int nextRank) {
            return new MeritLeaderboardEntry(
                    nextRank, studentId, name, avatar, department,
                    points, achievements, participations, competitions, wins, trend, change);
        }
    }

    public record SocialLeaderboardEntry(
            int rank,
            String studentId,
            String name,
            String avatar,
            String department,
            int socialScore,
            int likes,
            int comments,
            int posts,
            String trend,
            int change) {
        public SocialLeaderboardEntry(
                String studentId,
                String name,
                String avatar,
                String department,
                int socialScore,
                int likes,
                int comments,
                int posts,
                String trend,
                int change) {
            this(0, studentId, name, avatar, department, socialScore, likes, comments, posts, trend, change);
        }

        public SocialLeaderboardEntry withRank(int nextRank) {
            return new SocialLeaderboardEntry(
                    nextRank,
                    studentId,
                    name,
                    avatar,
                    department,
                    socialScore,
                    likes,
                    comments,
                    posts,
                    trend,
                    change);
        }
    }
}
