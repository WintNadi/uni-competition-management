package com.project.Backend.Evaluation.DTO;

import java.util.List;

public record EvaluationRequestDTO(
        Integer marksAwarded,
        String feedback,
        List<Integer> questionScores) {
}
