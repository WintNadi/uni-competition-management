package com.project.Backend.Social;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface SocialPostRepository extends MongoRepository<SocialPost, String> {
    List<SocialPost> findAllByOrderByCreatedAtDesc();

    boolean existsBySubmissionId(String submissionId);

    Optional<SocialPost> findBySubmissionId(String submissionId);

    boolean existsByExternalParticipationId(String externalParticipationId);

    Optional<SocialPost> findByExternalParticipationId(String externalParticipationId);

    void deleteByExternalParticipationId(String externalParticipationId);
}
