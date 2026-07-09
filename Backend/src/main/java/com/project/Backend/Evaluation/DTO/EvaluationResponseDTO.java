package com.project.Backend.Evaluation.DTO;

import java.time.LocalDateTime;
import java.util.List;

import com.project.Backend.Submission.ResponseDTO.SubmissionCoreDTO;

public record EvaluationResponseDTO(
        SubmissionCoreDTO submission,
        Integer marksAwarded,
        String feedback,
        List<Integer> questionScores,
        LocalDateTime evaluatedAt) {

    public EvaluationResponseDTO(
            Integer marksAwarded,
            String feedback,
            List<Integer> questionScores,
            LocalDateTime evaluatedAt) {
        this(null, marksAwarded, feedback, questionScores, evaluatedAt);
    }
}
