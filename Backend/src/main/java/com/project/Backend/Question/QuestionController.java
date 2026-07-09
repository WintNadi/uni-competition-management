package com.project.Backend.Question;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.project.Backend.Question.dto.CreateQuestionRequest;
import com.project.Backend.Question.dto.QuestionResponse;
import com.project.Backend.User.ResponseDTO.MessageResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/teacher/competitions/{competitionId}/questions")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping
    public ResponseEntity<?> addQuestion(
            @PathVariable String competitionId,
            @Valid @RequestBody CreateQuestionRequest request) {
        try {
            QuestionResponse response = questionService.addQuestion(competitionId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getAll(@PathVariable String competitionId) {
        return ResponseEntity.ok(questionService.getQuestionsByCompetition(competitionId));
    }

    @PutMapping("/{questionId}")
    public ResponseEntity<?> update(
            @PathVariable String questionId,
            @Valid @RequestBody CreateQuestionRequest request) {
        try {
            QuestionResponse response = questionService.updateQuestion(questionId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @DeleteMapping
    public ResponseEntity<?> deleteBulk(
            @PathVariable String competitionId,
            @RequestBody List<String> questionIds) {
        try {
            questionService.deleteBulkQuestions(competitionId, questionIds);
            return ResponseEntity.ok(new MessageResponse("Questions deleted"));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @DeleteMapping("/{questionId}")
    public ResponseEntity<?> delete(@PathVariable String questionId) {
        try {
            questionService.deleteQuestion(questionId);
            return ResponseEntity.ok(new MessageResponse("Question deleted"));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }
}
