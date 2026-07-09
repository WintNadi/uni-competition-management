package com.project.Backend.Notification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.project.Backend.Auth.Role;
import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.CompetitionRegistration.CompetitionRegistration;
import com.project.Backend.CompetitionRegistration.CompetitionRegistrationRepository;
import com.project.Backend.CompetitionRegistration.RegistrationStatus;
import com.project.Backend.Team.Team;
import com.project.Backend.Team.TeamRepository;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final CompetitionRepository competitionRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;

    private final Map<String, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public void registerEmitter(String userId, SseEmitter emitter) {
        emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);
    }

    public void unregisterEmitter(String userId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> list = emitters.get(userId);
        if (list != null) {
            list.remove(emitter);
        }
    }

    private void pushToUser(String userId, Notification notification) {
        CopyOnWriteArrayList<SseEmitter> list = emitters.get(userId);
        if (list == null)
            return;
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name("notification").data(notification));
            } catch (Exception e) {
                unregisterEmitter(userId, emitter);
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                }
            }
        }
    }

    public Notification createNotification(String recipientId, String title, String message, NotificationType type,
            String relatedEntityId) {
        Notification notification = new Notification();
        notification.setRecipientId(recipientId);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setType(type);
        notification.setRelatedEntityId(relatedEntityId);
        notification.setCreatedAt(LocalDateTime.now());
        notification.setRead(false);
        Notification saved = notificationRepository.save(notification);
        pushToUser(recipientId, saved);
        return saved;
    }

    public Notification createNotificationIfAbsent(
            String recipientId,
            String title,
            String message,
            NotificationType type,
            String relatedEntityId) {
        if (recipientId == null || type == null || relatedEntityId == null || relatedEntityId.isBlank()) {
            return createNotification(recipientId, title, message, type, relatedEntityId);
        }
        boolean exists = notificationRepository.existsByRecipientIdAndTypeAndRelatedEntityId(
                recipientId,
                type,
                relatedEntityId);
        if (exists) {
            return null;
        }
        return createNotification(recipientId, title, message, type, relatedEntityId);
    }

    // Helper methods for specific notification flows

    public void sendCompetitionCreatedNotification(String recipientId, String competitionName, String competitionId) {
        createNotification(
                recipientId,
                "New Competition Created",
                "A new competition '" + competitionName + "' has been created.",
                NotificationType.COMPETITION_CREATED,
                competitionId);
    }

    public void sendTeamInvitationNotification(String recipientId, String teamName, String teamId) {
        createNotification(
                recipientId,
                "Team Invitation",
                "You have been invited to join team '" + teamName + "'.",
                NotificationType.TEAM_INVITATION,
                teamId);
    }

    public void sendTeamConfirmationNotification(String recipientId, String teamName, String teamId) {
        createNotification(
                recipientId,
                "Team Joined",
                "You have successfully joined team '" + teamName + "'.",
                NotificationType.TEAM_CONFIRMATION,
                teamId);
    }

    public void sendTeamInviteCanceledNotification(String recipientId, String teamName, String teamId) {
        createNotification(
                recipientId,
                "Team Invitation Canceled",
                "Your invitation to join team '" + teamName + "' was canceled by the leader.",
                NotificationType.TEAM_INVITE_CANCELED,
                teamId);
    }

    public void sendTeamMemberRemovedNotification(String recipientId, String teamName, String teamId) {
        createNotification(
                recipientId,
                "Removed From Team",
                "You have been removed from team '" + teamName + "' by the leader.",
                NotificationType.TEAM_MEMBER_REMOVED,
                teamId);
    }

    public void sendTeamInviteAcceptedToLeader(String leaderId, String studentName, String teamName, String teamId) {
        createNotification(
                leaderId,
                "Team Invite Accepted",
                studentName + " accepted your invitation to join '" + teamName + "'.",
                NotificationType.TEAM_INVITE_ACCEPTED,
                teamId);
    }

    public void sendTeamInviteDeclinedToLeader(String leaderId, String studentName, String teamName, String teamId) {
        createNotification(
                leaderId,
                "Team Invite Declined",
                studentName + " declined your invitation to join '" + teamName + "'.",
                NotificationType.TEAM_INVITE_DECLINED,
                teamId);
    }

    public void sendSubmissionSuccessNotification(String recipientId, String competitionName, String submissionId) {
        createNotification(
                recipientId,
                "Submission Successful",
                "Your submission for '" + competitionName + "' was successful.",
                NotificationType.SUBMISSION_SUCCESS,
                submissionId);
    }

    public void sendAchievementEarnedNotification(String recipientId, String achievementName, String achievementId) {
        createNotification(
                recipientId,
                "Achievement Unlocked!",
                "You have earned the achievement: " + achievementName,
                NotificationType.ACHIEVEMENT_EARNED,
                achievementId);
    }

    public void sendAttendanceRecoveryApprovalNotification(String recipientId, String date, String recoveryId) {
        createNotification(
                recipientId,
                "Attendance Recovery Approved",
                "Your attendance recovery request for " + date + " has been approved.",
                NotificationType.ATTENDANCE_RECOVERY_APPROVAL,
                recoveryId);
    }

    public void sendRejectionNotification(String recipientId, String context, String reason, String entityId) {
        createNotification(
                recipientId,
                "Request Rejected",
                "Your request regarding " + context + " was rejected. Reason: " + reason,
                NotificationType.REJECTION,
                entityId);
    }

    public List<Notification> getUserNotifications(String userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
    }

    public List<Notification> getUnreadNotifications(String userId) {
        return notificationRepository.findByRecipientIdAndIsReadFalse(userId);
    }

    public Notification markAsRead(String notificationId) {
        Optional<Notification> notificationOpt = notificationRepository.findById(notificationId);
        if (notificationOpt.isPresent()) {
            Notification notification = notificationOpt.get();
            notification.setRead(true);
            Notification saved = notificationRepository.save(notification);
            pushToUser(notification.getRecipientId(), saved);
            return saved;
        }
        return null;
    }

    public Notification markAsReadForUser(String notificationId, String userId) {
        Optional<Notification> notificationOpt = notificationRepository.findById(notificationId);
        if (notificationOpt.isEmpty()) {
            return null;
        }
        Notification notification = notificationOpt.get();
        if (!notification.getRecipientId().equals(userId)) {
            throw new IllegalStateException("Not authorized to update this notification");
        }
        notification.setRead(true);
        Notification saved = notificationRepository.save(notification);
        pushToUser(notification.getRecipientId(), saved);
        return saved;
    }

    public void markAllAsRead(String userId) {
        List<Notification> unread = notificationRepository.findByRecipientIdAndIsReadFalse(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
        unread.forEach(n -> pushToUser(userId, n));
    }

    @Scheduled(initialDelay = 20_000, fixedDelay = 60_000)
    public void dispatchCompetitionWindowNotifications() {
        List<Competition> competitions = competitionRepository.findAll();
        if (competitions == null || competitions.isEmpty()) {
            return;
        }

        List<String> studentIds = userRepository.findByRoles(Role.ROLE_STUDENT)
                .stream()
                .map(User::getId)
                .filter(id -> id != null && !id.isBlank())
                .toList();
        if (studentIds.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        for (Competition competition : competitions) {
            if (!isInternalVisibleCompetition(competition)) {
                continue;
            }

            LocalDateTime registrationOpen = competition.getRegistrationOpen();
            LocalDateTime registrationClose = resolveRegistrationClose(competition);
            LocalDateTime submissionDeadline = competition.getSubmissionDeadline();

            if (registrationOpen != null
                    && !now.isBefore(registrationOpen)
                    && (registrationClose == null || !now.isAfter(registrationClose))) {
                for (String studentId : studentIds) {
                    createNotificationIfAbsent(
                            studentId,
                            "Registration Open",
                            "Registration is now open for: " + competition.getTitle(),
                            NotificationType.COMPETITION_REGISTRATION_OPEN,
                            competition.getCompetitionId());
                }
            }

            if (registrationClose != null && now.isAfter(registrationClose)) {
                for (String studentId : studentIds) {
                    createNotificationIfAbsent(
                            studentId,
                            "Registration Closed",
                            "Registration has closed for: " + competition.getTitle(),
                            NotificationType.COMPETITION_REGISTRATION_CLOSED,
                            competition.getCompetitionId());
                }
            }

            Set<String> registeredStudentIds = resolveRegisteredStudentIds(competition.getCompetitionId());
            if (registeredStudentIds.isEmpty()) {
                continue;
            }

            if (registrationClose != null
                    && !now.isBefore(registrationClose)
                    && (submissionDeadline == null || !now.isAfter(submissionDeadline))) {
                for (String studentId : registeredStudentIds) {
                    createNotificationIfAbsent(
                            studentId,
                            "Submission Open",
                            "Submission is now open for: " + competition.getTitle(),
                            NotificationType.SUBMISSION_OPEN,
                            competition.getCompetitionId());
                }
            }

            if (submissionDeadline != null && now.isAfter(submissionDeadline)) {
                for (String studentId : registeredStudentIds) {
                    createNotificationIfAbsent(
                            studentId,
                            "Submission Closed",
                            "Submission deadline is over for: " + competition.getTitle(),
                            NotificationType.SUBMISSION_DEADLINE_PASSED,
                            competition.getCompetitionId());
                }
            }
        }
    }

    private boolean isInternalVisibleCompetition(Competition competition) {
        if (competition == null) {
            return false;
        }
        if (!"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            return false;
        }
        return competition.getStatus() == null || !"DRAFT".equalsIgnoreCase(competition.getStatus());
    }

    private LocalDateTime resolveRegistrationClose(Competition competition) {
        if (competition.getRegistrationClose() != null) {
            return competition.getRegistrationClose();
        }
        return competition.getRegistrationDeadline();
    }

    private Set<String> resolveRegisteredStudentIds(String competitionId) {
        Set<String> out = new HashSet<>();
        if (competitionId == null || competitionId.isBlank()) {
            return out;
        }

        List<CompetitionRegistration> registrations = competitionRegistrationRepository
                .findByCompetitionId(competitionId);
        if (registrations == null || registrations.isEmpty()) {
            return out;
        }

        for (CompetitionRegistration registration : registrations) {
            if (registration.getStatus() != RegistrationStatus.REGISTERED) {
                continue;
            }

            if (!registration.isTeamRegistration()) {
                if (registration.getStudentId() != null && !registration.getStudentId().isBlank()) {
                    out.add(registration.getStudentId());
                }
                continue;
            }

            if (registration.getTeamId() == null || registration.getTeamId().isBlank()) {
                continue;
            }
            Team team = teamRepository.findById(registration.getTeamId()).orElse(null);
            if (team == null) {
                continue;
            }
            out.addAll(resolveAcceptedMemberIds(team));
        }

        return out;
    }

    private List<String> resolveAcceptedMemberIds(Team team) {
        List<String> memberIds = new ArrayList<>();
        if (team.getAcceptedMemberIds() != null) {
            memberIds.addAll(team.getAcceptedMemberIds());
        }
        if (team.getLeaderId() != null && !team.getLeaderId().isBlank()) {
            memberIds.add(team.getLeaderId());
        }
        return memberIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
    }
}
