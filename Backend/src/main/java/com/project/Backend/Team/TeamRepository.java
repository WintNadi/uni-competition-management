package com.project.Backend.Team;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface TeamRepository extends MongoRepository<Team, String> {
    List<Team> findByLeaderIdOrAcceptedMemberIdsContaining(String leaderId, String memberId);

    List<Team> findByCompetitionId(String competitionId);

    void deleteByCompetitionId(String competitionId);

    List<Team> findByCompetitionIdAndAcceptedMemberIdsContaining(String competitionId, String memberId);

    List<Team> findByCompetitionIdAndLeaderId(String competitionId, String leaderId);

    boolean existsByTeamIdAndLeaderId(String teamId, String leaderId);

    boolean existsByTeamIdAndAcceptedMemberIdsContaining(String teamId, String memberId);
}
