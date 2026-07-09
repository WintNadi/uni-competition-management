package com.project.Backend.CompetitionRegistration;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "competition_registrations")
@CompoundIndexes({
        @CompoundIndex(name = "registration_competition_student_status_idx", def = "{'competitionId': 1, 'studentId': 1, 'status': 1}"),
        @CompoundIndex(name = "registration_competition_team_status_idx", def = "{'competitionId': 1, 'teamId': 1, 'status': 1}"),
        @CompoundIndex(name = "registration_team_status_idx", def = "{'teamId': 1, 'status': 1}")
})
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CompetitionRegistration {

    @Id
    private String id;

    @Indexed
    private String competitionId;

    // INDIVIDUAL
    @Indexed
    private String studentId;

    // TEAM
    @Indexed
    private String teamId;

    private boolean teamRegistration;

    @Indexed
    private RegistrationStatus status; // REGISTERED, CANCELLED

    @Indexed
    private LocalDateTime registeredAt;
}
