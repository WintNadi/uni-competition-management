package com.project.Backend.Achievement;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface AchievementRepository extends MongoRepository<Achievement, String> {
    List<Achievement> findByStudentIdOrderByAchievedAtDesc(String studentId);

    boolean existsByStudentIdAndSubmissionId(String studentId, String submissionId);

    Optional<Achievement> findByStudentIdAndSubmissionId(String studentId, String submissionId);

    boolean existsByStudentIdAndExternalParticipationId(String studentId, String externalParticipationId);

    List<Achievement> findByExternalParticipationId(String externalParticipationId);

    void deleteByExternalParticipationId(String externalParticipationId);
}
