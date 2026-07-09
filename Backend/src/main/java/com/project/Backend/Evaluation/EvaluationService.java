package com.project.Backend.Evaluation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;

import com.project.Backend.Achievement.RecognitionService;
import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.Evaluation.DTO.EvaluationRequestDTO;
import com.project.Backend.Evaluation.DTO.EvaluationResponseDTO;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Notification.NotificationType;
import com.project.Backend.Question.Question;
import com.project.Backend.Question.QuestionRepository;
import com.project.Backend.Question.enums.QuestionType;
import com.project.Backend.Submission.Submission;
import com.project.Backend.Submission.SubmissionRepository;
import com.project.Backend.Submission.SubmissionStatus;
import com.project.Backend.Team.Team;
import com.project.Backend.Team.TeamRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final SubmissionRepository submissionRepository;
    private final CompetitionRepository competitionRepository;
    private final EvaluationMapper evaluationMapper;
    private final NotificationService notificationService;
    private final TeamRepository teamRepository;
    private final RecognitionService recognitionService;
    private final QuestionRepository questionRepository;

    public EvaluationResponseDTO evaluateSubmission(String submissionId, EvaluationRequestDTO dto, String teacherId) {
        if (dto == null) {
            throw new IllegalArgumentException("Request body is required");
        }

        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found"));

        if (submission.getSubmissionStatus() != SubmissionStatus.SUBMITTED
                && submission.getSubmissionStatus() != SubmissionStatus.EVALUATED) {
            throw new IllegalStateException("Submission cannot be evaluated in current status");
        }

        Competition competition = competitionRepository.findById(submission.getCompetitionId())
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

        if (!"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            throw new IllegalStateException("Only internal competition submissions can be evaluated");
        }

        if (teacherId == null || !teacherId.equals(competition.getCreatedBy())) {
            throw new IllegalStateException("Teacher can only evaluate submissions from competitions they created");
        }

        List<Question> quizQuestions = isQuizSubmission(submission)
                ? listQuizQuestionsOrdered(submission.getCompetitionId())
                : List.of();
        List<Integer> resolvedQuestionScores = resolveQuestionScores(dto, submission, quizQuestions);
        int resolvedMarksAwarded = resolveMarksAwarded(dto, submission, resolvedQuestionScores, quizQuestions);
        int totalMarks = resolveTotalMarks(competition, quizQuestions);
        if (resolvedMarksAwarded < 0) {
            throw new IllegalArgumentException("Score cannot be negative");
        }
        if (totalMarks > 0 && resolvedMarksAwarded > totalMarks) {
            throw new IllegalArgumentException("Score must be between 0 and " + totalMarks);
        }

        Evaluation evaluation = evaluationMapper.toEvaluation(dto);
        evaluation.setMarksAwarded(resolvedMarksAwarded);
        evaluation.setQuestionScores(resolvedQuestionScores);
        if (isQuizSubmission(submission)) {
            evaluation.setFeedback(null);
        }
        submission.setEvaluation(evaluation);
        submission.setMarksAwarded(evaluation.getMarksAwarded());
        submission.setFeedback(evaluation.getFeedback());
        submission.setSubmissionStatus(SubmissionStatus.EVALUATED); // update status
        Submission savedSubmission = submissionRepository.save(submission);
        recognitionService.processInternalEvaluation(competition, savedSubmission);

        for (String recipientId : resolveRecipients(savedSubmission)) {
            notificationService.createNotification(
                    recipientId,
                    "Submission Evaluated",
                    "Your submission for '" + competition.getTitle() + "' has been evaluated.",
                    NotificationType.SUBMISSION_EVALUATED,
                    savedSubmission.getSubmissionId());
        }

        return evaluationMapper.toResponseDTO(evaluation);
    }

    private boolean isQuizSubmission(Submission submission) {
        return submission != null
                && submission.getSubmissionType() != null
                && "QUIZ".equalsIgnoreCase(submission.getSubmissionType());
    }

    private List<Question> listQuizQuestionsOrdered(String competitionId) {
        if (competitionId == null || competitionId.isBlank()) {
            return List.of();
        }
        return questionRepository.findByCompetitionId(competitionId)
                .stream()
                .sorted(Comparator
                        .comparing(Question::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(question -> question.getId() == null ? "" : question.getId()))
                .toList();
    }

    private List<Integer> resolveQuestionScores(
            EvaluationRequestDTO dto,
            Submission submission,
            List<Question> questions) {
        if (!isQuizSubmission(submission) || questions.isEmpty()) {
            return null;
        }

        List<Integer> autoScores = buildAutoQuestionScores(submission, questions);
        if (dto.questionScores() == null || dto.questionScores().isEmpty()) {
            return autoScores;
        }

        List<Integer> resolved = new ArrayList<>(questions.size());
        for (int index = 0; index < questions.size(); index++) {
            int maxScore = Math.max(0, questions.get(index).getMarks() == null ? 0 : questions.get(index).getMarks());
            Integer requested = index < dto.questionScores().size() ? dto.questionScores().get(index) : null;
            int fallback = index < autoScores.size() ? autoScores.get(index) : 0;
            int value = requested == null ? fallback : requested;
            if (value < 0) {
                value = 0;
            }
            if (value > maxScore) {
                value = maxScore;
            }
            resolved.add(value);
        }
        return resolved;
    }

    private int resolveMarksAwarded(
            EvaluationRequestDTO dto,
            Submission submission,
            List<Integer> questionScores,
            List<Question> questions) {
        if (questionScores != null) {
            return questionScores.stream()
                    .filter(Objects::nonNull)
                    .mapToInt(Integer::intValue)
                    .sum();
        }

        if (dto.marksAwarded() != null) {
            return dto.marksAwarded();
        }

        if (isQuizSubmission(submission) && !questions.isEmpty()) {
            return buildAutoQuestionScores(submission, questions)
                    .stream()
                    .filter(Objects::nonNull)
                    .mapToInt(Integer::intValue)
                    .sum();
        }
        return submission.getMarksAwarded() == null ? 0 : submission.getMarksAwarded();
    }

    private int resolveTotalMarks(Competition competition, List<Question> questions) {
        int configured = competition.getTotalMarks() == null ? 0 : competition.getTotalMarks();
        if (configured > 0) {
            return configured;
        }
        if (questions == null || questions.isEmpty()) {
            return 0;
        }
        return questions.stream()
                .mapToInt(question -> question.getMarks() == null ? 0 : Math.max(0, question.getMarks()))
                .sum();
    }

    private List<Integer> buildAutoQuestionScores(Submission submission, List<Question> questions) {
        if (submission == null || questions == null || questions.isEmpty()) {
            return List.of();
        }
        List<String> answers = submission.getQuizAnswers() == null ? Collections.emptyList() : submission.getQuizAnswers();
        List<Integer> perQuestion = new ArrayList<>(questions.size());
        for (int index = 0; index < questions.size(); index++) {
            Question question = questions.get(index);
            String submitted = index < answers.size() ? answers.get(index) : "";
            int marks = question.getMarks() == null ? 0 : Math.max(0, question.getMarks());
            perQuestion.add(isCorrect(question, submitted) ? marks : 0);
        }
        return perQuestion;
    }

    private boolean isCorrect(Question question, String submittedRaw) {
        if (question == null || question.getCorrectAnswer() == null) {
            return false;
        }
        String submitted = submittedRaw == null ? "" : submittedRaw.trim();
        if (submitted.isBlank()) {
            return false;
        }

        Object correctAnswer = question.getCorrectAnswer();
        QuestionType questionType = question.getQuestionType();

        if (questionType == QuestionType.MULTIPLE_CHOICE) {
            if (correctAnswer instanceof Number number) {
                int index = number.intValue();
                List<String> options = question.getOptions();
                if (options != null && index >= 0 && index < options.size()) {
                    String correctText = options.get(index);
                    return submitted.equalsIgnoreCase(correctText == null ? "" : correctText.trim());
                }
                return submitted.equalsIgnoreCase(String.valueOf(index));
            }

            String correctText = String.valueOf(correctAnswer).trim();
            try {
                int optionIndex = Integer.parseInt(correctText);
                List<String> options = question.getOptions();
                if (options != null && optionIndex >= 0 && optionIndex < options.size()) {
                    String optionText = options.get(optionIndex);
                    return submitted.equalsIgnoreCase(optionText == null ? "" : optionText.trim());
                }
            } catch (NumberFormatException ignored) {
            }
            return submitted.equalsIgnoreCase(correctText);
        }

        String correctText = String.valueOf(correctAnswer).trim();
        return submitted.equalsIgnoreCase(correctText);
    }

    private List<String> resolveRecipients(Submission submission) {
        if (submission.getTeamId() == null || submission.getTeamId().isBlank()) {
            return submission.getSubmittedBy() == null || submission.getSubmittedBy().isBlank()
                    ? List.of()
                    : List.of(submission.getSubmittedBy());
        }

        Team team = teamRepository.findById(submission.getTeamId()).orElse(null);
        if (team == null) {
            return submission.getSubmittedBy() == null || submission.getSubmittedBy().isBlank()
                    ? List.of()
                    : List.of(submission.getSubmittedBy());
        }

        List<String> recipients = new ArrayList<>();
        if (team.getAcceptedMemberIds() != null) {
            recipients.addAll(team.getAcceptedMemberIds());
        }
        if (team.getLeaderId() != null && !team.getLeaderId().isBlank()) {
            recipients.add(team.getLeaderId());
        }

        return recipients.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
    }
}
