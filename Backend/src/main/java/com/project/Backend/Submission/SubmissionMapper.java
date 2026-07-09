package com.project.Backend.Submission;

import java.time.LocalDateTime;

import com.project.Backend.Competition.Competition;
import com.project.Backend.Submission.RequestDTO.AssignmentSubmissionRequestDTO;
import com.project.Backend.Submission.RequestDTO.ProjectSubmissionRequestDTO;
import com.project.Backend.Submission.RequestDTO.QuizSubmissionRequestDTO;
import com.project.Backend.Submission.ResponseDTO.SubmissionCoreDTO;
import com.project.Backend.Team.TeamContext;

public class SubmissionMapper {

        private SubmissionMapper() {
        }

        // ================= CREATE =================

        public static Submission newAssignment(
                        String competitionId,
                        String submittedBy,
                        TeamContext ctx,
                        AssignmentSubmissionRequestDTO dto) {

                return Submission.builder()
                                .competitionId(competitionId)
                                .submittedBy(submittedBy)
                                .submissionType("ASSIGNMENT")
                                .file(dto.file())
                                .description(dto.description())
                                .isTeamSubmission(ctx.isTeamSubmission())
                                .teamId(ctx.teamId())
                                .submissionStatus(SubmissionStatus.SUBMITTED)
                                .submittedAt(LocalDateTime.now())
                                .build();
        }

        public static Submission newProject(
                        String competitionId,
                        String submittedBy,
                        TeamContext ctx,
                        ProjectSubmissionRequestDTO dto) {

                return Submission.builder()
                                .competitionId(competitionId)
                                .submittedBy(submittedBy)
                                .submissionType("PROJECT")
                                .repoLink(dto.repoLink())
                                .description(dto.description())
                                .isTeamSubmission(ctx.isTeamSubmission())
                                .teamId(ctx.teamId())
                                .submissionStatus(SubmissionStatus.SUBMITTED)
                                .submittedAt(LocalDateTime.now())
                                .build();
        }

        public static Submission newQuiz(
                        String competitionId,
                        String submittedBy,
                        TeamContext ctx,
                        QuizSubmissionRequestDTO dto) {

                return Submission.builder()
                                .competitionId(competitionId)
                                .submittedBy(submittedBy)
                                .submissionType("QUIZ")
                                .quizAnswers(dto.quizAnswers())
                                .isTeamSubmission(ctx.isTeamSubmission())
                                .teamId(ctx.teamId())
                                .submissionStatus(SubmissionStatus.SUBMITTED)
                                .submittedAt(LocalDateTime.now())
                                .build();
        }

        // ================= UPDATE =================

        public static void applyAssignmentUpdate(
                        Submission s,
                        AssignmentSubmissionRequestDTO dto,
                        TeamContext ctx) {

                s.setFile(dto.file());
                s.setDescription(dto.description());
                s.setRepoLink(null);
                s.setQuizAnswers(null);
                s.setTeamSubmission(ctx.isTeamSubmission());
                s.setTeamId(ctx.teamId());
                s.setSubmittedAt(LocalDateTime.now());
        }

        public static void applyProjectUpdate(
                        Submission s,
                        ProjectSubmissionRequestDTO dto,
                        TeamContext ctx) {

                s.setRepoLink(dto.repoLink());
                s.setDescription(dto.description());
                s.setFile(null);
                s.setQuizAnswers(null);
                s.setTeamSubmission(ctx.isTeamSubmission());
                s.setTeamId(ctx.teamId());
                s.setSubmittedAt(LocalDateTime.now());
        }

        // ================= RESPONSE =================

        public static SubmissionCoreDTO toResponse(
                        Submission s,
                        Competition competition,
                        String teamName) {
                LocalDateTime now = LocalDateTime.now();

                LocalDateTime registrationDeadline = competition != null
                                ? (competition.getRegistrationClose() != null
                                                ? competition.getRegistrationClose()
                                                : competition.getRegistrationDeadline())
                                : null;
                LocalDateTime submissionDeadline = competition != null
                                ? competition.getSubmissionDeadline()
                                : null;

                boolean afterOpen = registrationDeadline == null || !now.isBefore(registrationDeadline);
                boolean beforeClose = submissionDeadline == null || !now.isAfter(submissionDeadline);
                boolean submissionOpen = afterOpen && beforeClose;

                boolean canSubmit = submissionOpen;

                boolean canEdit = canSubmit &&
                                competition != null &&
                                !"QUIZ".equalsIgnoreCase(competition.getFormat());

                Integer marksAwarded = s.getEvaluation() != null
                                ? s.getEvaluation().getMarksAwarded()
                                : s.getMarksAwarded();
                String feedback = s.getEvaluation() != null
                                ? s.getEvaluation().getFeedback()
                                : s.getFeedback();
                var questionScores = s.getEvaluation() != null
                                ? s.getEvaluation().getQuestionScores()
                                : null;

                Integer autoMarksAwarded = s.getAutoMarksAwarded();
                var autoQuestionScores = s.getAutoQuestionScores();

                return new SubmissionCoreDTO(
                                s.getSubmissionId(),
                                s.getCompetitionId(),
                                s.getTeamId(),
                                teamName,
                                s.getSubmittedBy(),
                                s.getSubmissionType(),
                                s.getRepoLink(),
                                s.getFile(),
                                s.getQuizQuestionIds(),
                                s.getQuizAnswers(),
                                s.isTeamSubmission(),
                                s.getDescription(),
                                s.getSubmissionStatus(),
                                autoMarksAwarded,
                                marksAwarded,
                                feedback,
                                autoQuestionScores,
                                questionScores,
                                s.getSubmittedAt(),
                                canSubmit,
                                canEdit);
        }

}
