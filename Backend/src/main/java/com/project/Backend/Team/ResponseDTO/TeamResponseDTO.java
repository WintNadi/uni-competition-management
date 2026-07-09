package com.project.Backend.Team.ResponseDTO;

import java.util.List;

public record TeamResponseDTO(

                String teamId,
                String teamName,
                String competitionId,

                String leaderId,
                List<String> memberIds,
                List<String> acceptedMemberIds,
                List<String> pendingJoinRequestIds,
                String leaderUsername,
                List<String> memberUsernames,
                List<String> acceptedMemberUsernames,
                List<String> pendingJoinRequestUsernames,

                String status // ACTIVE | PENDING
) {

}
