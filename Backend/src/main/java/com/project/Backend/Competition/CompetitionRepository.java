package com.project.Backend.Competition;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CompetitionRepository extends MongoRepository<Competition, String> {

    List<Competition> findByCreatedBy(String createdBy);

    List<Competition> findByCompetitionType(String competitionType);

    List<Competition> findByCreatedByAndCompetitionType(String createdBy, String competitionType);
}
