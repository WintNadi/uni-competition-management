package com.project.Backend.Competition.enums;

public enum CompetitionStatus {
    // Internal lifecycle statuses (used by teachers/admins for draft/publish flows)
    DRAFT,
    PUBLISHED,
    CLOSED,

    // External-facing statuses for admin-managed competitions
    UPCOMING,
    ACTIVE,
    COMPLETED
}
