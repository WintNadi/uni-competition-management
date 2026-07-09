package com.project.Backend.MyExternalParticipation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface MyExternalParticipationRepository extends MongoRepository<MyExternalParticipation, String> {
    List<MyExternalParticipation> findByOwnerIdOrderBySubmittedAtDesc(String ownerId);

    List<MyExternalParticipation> findByStatusOrderBySubmittedAtDesc(String status);

    List<MyExternalParticipation> findByStatusAndSourceOrderBySubmittedAtDesc(String status, String source);

    Optional<MyExternalParticipation> findByOwnerIdAndCompetitionId(String ownerId, String competitionId);
}
