package com.project.Backend.Question;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface QuestionRepository extends MongoRepository<Question, String> {

    List<Question> findByCompetitionId(String competitionId);

    void deleteByCompetitionId(String competitionId);
}
