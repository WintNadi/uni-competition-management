package com.project.Backend.Notification;

public enum NotificationType {
    COMPETITION_CREATED,
    COMPETITION_UPDATED,
    COMPETITION_REGISTRATION_OPEN,
    COMPETITION_REGISTRATION_CLOSED,
    TEAM_INVITATION,
    TEAM_CONFIRMATION, // Team invitations and confirmations
    SUBMISSION_OPEN,
    SUBMISSION_DEADLINE_PASSED,
    SUBMISSION_SUCCESS, // Submission success
    SUBMISSION_RECEIVED, // Teacher receives new submission notification
    SUBMISSION_EVALUATED,
    ACHIEVEMENT_EARNED, // Achievement earned
    ATTENDANCE_RECOVERY_APPROVAL, // Attendance recovery approval
    REJECTION, // Rejection actions
    ROLLBACK, // Rollback actions
    EXTERNAL_PARTICIPATION_SUBMITTED, // Student submitted external participation
    TEAM_INVITE_CANCELED,
    TEAM_MEMBER_REMOVED,
    TEAM_INVITE_ACCEPTED,
    TEAM_INVITE_DECLINED,
    GENERAL
}
