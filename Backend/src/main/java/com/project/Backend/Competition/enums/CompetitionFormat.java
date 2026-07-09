package com.project.Backend.Competition.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum CompetitionFormat {
    @JsonProperty("quiz")
    QUIZ,

    @JsonProperty("assignment")
    ASSIGNMENT,

    @JsonProperty("project")
    PROJECT
}
