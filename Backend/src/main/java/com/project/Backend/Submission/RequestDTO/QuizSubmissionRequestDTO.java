package com.project.Backend.Submission.RequestDTO;

import java.util.List;

public record QuizSubmissionRequestDTO(
        List<String> quizAnswers,
        List<String> questionIds) {
}
