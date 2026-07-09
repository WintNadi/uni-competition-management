package com.project.Backend.Achievement;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "achievements")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Achievement {

    @Id
    private String achievementId;
    private String studentId;
    private String competitionId;
    private String competitionTitle;
    private String competitionType;
    private String submissionId;
    private String externalParticipationId;
    private String teamId;
    private boolean teamAchievement;
    private String resultLabel;
    private String badge;
    private Integer score;
    private LocalDateTime achievedAt;
}
