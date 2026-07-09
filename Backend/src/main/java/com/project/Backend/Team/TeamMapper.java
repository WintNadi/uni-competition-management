package com.project.Backend.Team;

import com.project.Backend.Team.ResponseDTO.TeamResponseDTO;

public class TeamMapper {
    public static TeamResponseDTO toResponse(Team team) {
        return new TeamResponseDTO(
                team.getTeamId(),
                team.getTeamName(),
                team.getCompetitionId(),
                team.getLeaderId(),
                team.getInvitedMemberIds(),
                team.getAcceptedMemberIds(),
                team.getPendingJoinRequestIds(),
                null,
                null,
                null,
                null,
                team.getStatus().name());
    }
}
