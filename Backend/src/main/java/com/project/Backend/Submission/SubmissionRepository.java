package com.project.Backend.Submission;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface SubmissionRepository extends MongoRepository<Submission, String> {

        Optional<Submission> findByCompetitionIdAndSubmittedBy(
                        String competitionId,
                        String submittedBy);

        boolean existsByCompetitionIdAndSubmittedBy(
                        String competitionId,
                        String submittedBy);

        List<Submission> findBySubmittedBy(String submittedBy);

        List<Submission> findByCompetitionId(String competitionId);

        List<Submission> findByCompetitionIdIn(List<String> competitionIds);

        List<Submission> findByTeamId(String teamId);

        Optional<Submission> findBySubmittedByAndSubmissionId(String submittedBy, String submissionId);

        List<Submission> findByTeamIdIn(List<String> teamIds);

        Optional<Submission> findBySubmissionId(String submissionId);

        long countByCompetitionId(String competitionId);

}
