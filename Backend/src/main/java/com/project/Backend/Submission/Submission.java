package com.project.Backend.Submission;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import com.project.Backend.Evaluation.Evaluation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "submissions")
@CompoundIndexes({
        @CompoundIndex(name = "submission_competition_submitter_idx", def = "{'competitionId': 1, 'submittedBy': 1}"),
        @CompoundIndex(name = "submission_competition_team_idx", def = "{'competitionId': 1, 'teamId': 1}")
})
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Submission {

    @Id
    private String submissionId;

    @Indexed
    private String competitionId;
    @Indexed
    private String submittedBy;
    @Indexed
    private String teamId;

    private String submissionType; // QUIZ, ASSIGNMENT, PROJECT

    private String repoLink; // PROJECT
    private String file; // ASSIGNMENT
    private List<String> quizAnswers; // QUIZ

    // For quizzes we must keep the exact question order shown to the student
    // (questions are randomized per attempt).
    // This prevents incorrect grading when questions are shuffled.
    private List<String> quizQuestionIds; // QUIZ

    // Auto-generated (system) score for quiz submissions. Teacher can override
    // later in evaluation.
    private Integer autoMarksAwarded; // QUIZ
    private List<Integer> autoQuestionScores; // QUIZ

    private Integer marksAwarded;
    private boolean isTeamSubmission;
    private String description;
    private SubmissionStatus submissionStatus; // student ==> pending, submitted, teacher ==> submitted, evaluated
    private String feedback;
    private Evaluation evaluation;
    @Indexed
    private LocalDateTime submittedAt;
}
