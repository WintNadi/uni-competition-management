package com.project.Backend.Question;

import java.util.List;

import com.project.Backend.Question.dto.CreateQuestionRequest;
import com.project.Backend.Question.dto.QuestionResponse;

public interface QuestionService {

    QuestionResponse addQuestion(String competitionId, CreateQuestionRequest request);

    List<QuestionResponse> getQuestionsByCompetition(String competitionId);

    QuestionResponse updateQuestion(String questionId, CreateQuestionRequest request);

    void deleteQuestion(String questionId);

    void deleteBulkQuestions(String competitionId, List<String> questionIds);
}
