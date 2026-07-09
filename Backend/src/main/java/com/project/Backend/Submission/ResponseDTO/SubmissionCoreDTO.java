package com.project.Backend.Submission.ResponseDTO;

import java.time.LocalDateTime;
import java.util.List;

import com.project.Backend.Submission.SubmissionStatus;

public record SubmissionCoreDTO(
                String submissionId,
                String competitionId,
                String teamId,
                String teamName,
                String submittedBy,

                String submissionType,
                String repoLink,
                String file,
                List<String> quizQuestionIds, //
                List<String> quizAnswers,

                boolean isTeamSubmission,
                String description,

                SubmissionStatus submissionStatus,
                Integer autoMarksAwarded,
                Integer marksAwarded,
                String feedback,
                List<Integer> autoQuestionScores,
                List<Integer> questionScores,
                LocalDateTime submittedAt,

                boolean canSubmit, // used ONLY in competition view
                boolean canEdit // used in submission view
) {
}
