package com.project.Backend.Team;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "teams")
@CompoundIndexes({
        @CompoundIndex(name = "team_competition_leader_idx", def = "{'competitionId': 1, 'leaderId': 1}"),
        @CompoundIndex(name = "team_competition_member_idx", def = "{'competitionId': 1, 'acceptedMemberIds': 1}")
})
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Team {

    @Id
    private String teamId;

    @Indexed
    private String teamName;
    @Indexed
    private String competitionId;

    @Indexed
    private String leaderId;

    // invited users
    @Indexed
    private List<String> invitedMemberIds;

    // accepted users
    @Indexed
    private List<String> acceptedMemberIds;

    // students who requested to join and are waiting leader decision
    @Indexed
    private List<String> pendingJoinRequestIds;

    private TeamStatus status; // INACTIVE | ACTIVE
    @Indexed
    private LocalDateTime createdAt;
}
