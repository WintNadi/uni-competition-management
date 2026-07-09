package com.project.Backend.Submission;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.CompetitionRegistration.CompetitionRegistrationRepository;
import com.project.Backend.CompetitionRegistration.RegistrationStatus;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Notification.NotificationType;
import com.project.Backend.Question.Question;
import com.project.Backend.Question.QuestionRepository;
import com.project.Backend.Question.enums.QuestionType;
import com.project.Backend.Submission.RequestDTO.AssignmentSubmissionRequestDTO;
import com.project.Backend.Submission.RequestDTO.ProjectSubmissionRequestDTO;
import com.project.Backend.Submission.RequestDTO.QuizSubmissionRequestDTO;
import com.project.Backend.Submission.ResponseDTO.SubmissionCoreDTO;
import com.project.Backend.Team.TeamContext;
import com.project.Backend.Team.TeamRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SubmissionService {

        private final SubmissionRepository submissionRepository;
        private final CompetitionRepository competitionRepository;
        private final CompetitionRegistrationRepository competitionRegistrationRepository;
        private final TeamRepository teamRepository;
        private final QuestionRepository questionRepository;
        private final NotificationService notificationService;

        // ================= VIEW =================

        public List<SubmissionCoreDTO> getTeacherSubmissions(String teacherId) {
                List<Competition> ownedCompetitions = competitionRepository.findAll()
                                .stream()
                                .filter(c -> teacherId != null && teacherId.equals(c.getCreatedBy()))
                                .toList();

                List<String> competitionIds = ownedCompetitions
                                .stream()
                                .map(Competition::getCompetitionId)
                                .toList();

                if (competitionIds.isEmpty()) {
                        return List.of();
                }

                Map<String, Competition> competitionMap = ownedCompetitions
                                .stream()
                                .collect(Collectors.toMap(Competition::getCompetitionId, c -> c));

                return submissionRepository.findByCompetitionIdIn(competitionIds)
                                .stream()
                                .sorted(submissionSortComparator())
                                .map(s -> SubmissionMapper.toResponse(s, competitionMap.get(s.getCompetitionId()),
                                                s.getSubmittedBy()))
                                .toList();
        }

        public List<SubmissionCoreDTO> getTeacherSubmissionsByCompetition(
                        String competitionId,
                        String teacherId) {
                Competition competition = competitionRepository.findById(competitionId)
                                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

                if (!"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
                        throw new IllegalStateException(
                                        "Only internal competitions are supported for teacher submissions");
                }

                if (teacherId == null || !teacherId.equals(competition.getCreatedBy())) {
                        throw new IllegalStateException(
                                        "Teacher can only view submissions for competitions they created");
                }

                return submissionRepository.findByCompetitionId(competitionId)
                                .stream()
                                .sorted(submissionSortComparator())
                                .map(s -> SubmissionMapper.toResponse(s, competition, s.getSubmittedBy()))
                                .toList();
        }

        public List<SubmissionCoreDTO> getMySubmissions(String studentId) {

                List<Submission> individual = submissionRepository.findBySubmittedBy(studentId);

                List<String> teamIds = teamRepository
                                .findByLeaderIdOrAcceptedMemberIdsContaining(studentId, studentId)
                                .stream()
                                .map(t -> t.getTeamId())
                                .toList();

                List<String> registeredTeamIds = competitionRegistrationRepository
                                .findByTeamIdInAndStatus(teamIds, RegistrationStatus.REGISTERED)
                                .stream()
                                .map(r -> r.getTeamId())
                                .toList();

                List<Submission> teamSubmissions = registeredTeamIds.isEmpty()
                                ? List.of()
                                : submissionRepository.findByTeamIdIn(registeredTeamIds);

                List<Submission> all = new ArrayList<>();
                all.addAll(individual);
                all.addAll(teamSubmissions);

                return mapWithCompetitionsForStudent(all);
        }

        public List<SubmissionCoreDTO> getMySubmissionsByCompetition(
                        String competitionId,
                        String studentId) {

                List<Submission> individual = submissionRepository
                                .findByCompetitionIdAndSubmittedBy(competitionId, studentId)
                                .map(List::of)
                                .orElse(List.of());

                var teams = new ArrayList<>(teamRepository
                                .findByCompetitionIdAndLeaderId(competitionId, studentId));
                teams.addAll(teamRepository
                                .findByCompetitionIdAndAcceptedMemberIdsContaining(competitionId, studentId));

                List<String> teamIds = teams.stream()
                                .map(t -> t.getTeamId())
                                .distinct()
                                .toList();

                List<String> registeredTeamIds = competitionRegistrationRepository
                                .findByCompetitionIdAndTeamIdInAndStatus(
                                                competitionId,
                                                teamIds,
                                                RegistrationStatus.REGISTERED)
                                .stream()
                                .map(r -> r.getTeamId())
                                .toList();

                List<Submission> teamSubmissions = registeredTeamIds.isEmpty()
                                ? List.of()
                                : submissionRepository.findByTeamIdIn(registeredTeamIds);

                List<Submission> all = new ArrayList<>();
                all.addAll(individual);
                all.addAll(teamSubmissions);

                Competition competition = competitionRepository.findById(competitionId)
                                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

                return all.stream()
                                .sorted(submissionSortComparator())
                                .map(s -> mapStudentSubmissionResponse(s, competition, s.getSubmittedBy()))
                                .toList();
        }

        public SubmissionCoreDTO getMySubmissionById(String studentId, String submissionId) {

                Submission submission = submissionRepository
                                .findBySubmissionId(submissionId)
                                .orElseThrow(() -> new IllegalArgumentException("Submission not found"));

                if (submission.getTeamId() != null) {
                        boolean isLeader = teamRepository
                                        .existsByTeamIdAndLeaderId(submission.getTeamId(), studentId);
                        boolean isMember = teamRepository
                                        .existsByTeamIdAndAcceptedMemberIdsContaining(
                                                        submission.getTeamId(), studentId);
                        if (!isLeader && !isMember) {
                                throw new IllegalStateException("Not authorized");
                        }
                } else {
                        if (!submission.getSubmittedBy().equals(studentId)) {
                                throw new IllegalStateException("Not authorized");
                        }
                }

                Competition competition = competitionRepository.findById(submission.getCompetitionId())
                                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

                return mapStudentSubmissionResponse(submission, competition, submission.getSubmittedBy());
        }

        // ================= ASSIGNMENT =================

        public SubmissionCoreDTO submitOrUpdateAssignment(
                        String competitionId,
                        AssignmentSubmissionRequestDTO dto,
                        String studentId) {
                if (dto == null) {
                        throw new IllegalArgumentException("Request body is required");
                }

                Competition competition = validateAndGetCompetition(competitionId, "ASSIGNMENT");
                TeamContext ctx = resolveTeamContext(competition, studentId);
                assertRegistered(competition, ctx);

                if (dto.file() == null || dto.file().isBlank()) {
                        throw new IllegalArgumentException("Assignment file is required");
                }
                if (dto.description() == null || dto.description().isBlank()) {
                        throw new IllegalArgumentException("Description is required for assignment submission");
                }

                Submission submission = submissionRepository
                                .findByCompetitionIdAndSubmittedBy(competitionId, ctx.submittedBy())
                                .orElseGet(() -> SubmissionMapper.newAssignment(
                                                competitionId, ctx.submittedBy(), ctx, dto));

                SubmissionMapper.applyAssignmentUpdate(submission, dto, ctx);
                submission.setSubmissionStatus(SubmissionStatus.SUBMITTED);
                return saveSubmissionAndNotify(submission, competition, ctx);
        }

        // ================= PROJECT =================

        public SubmissionCoreDTO submitOrUpdateProject(
                        String competitionId,
                        ProjectSubmissionRequestDTO dto,
                        String studentId) {
                if (dto == null) {
                        throw new IllegalArgumentException("Request body is required");
                }

                Competition competition = validateAndGetCompetition(competitionId, "PROJECT");
                TeamContext ctx = resolveTeamContext(competition, studentId);
                assertRegistered(competition, ctx);

                if (dto.repoLink() == null || dto.repoLink().isBlank()) {
                        throw new IllegalArgumentException("Repository link is required");
                }
                if (dto.description() == null || dto.description().isBlank()) {
                        throw new IllegalArgumentException("Description is required for project submission");
                }

                Submission submission = submissionRepository
                                .findByCompetitionIdAndSubmittedBy(competitionId, ctx.submittedBy())
                                .orElseGet(() -> SubmissionMapper.newProject(
                                                competitionId, ctx.submittedBy(), ctx, dto));

                SubmissionMapper.applyProjectUpdate(submission, dto, ctx);
                submission.setSubmissionStatus(SubmissionStatus.SUBMITTED);
                return saveSubmissionAndNotify(submission, competition, ctx);
        }

        // ================= QUIZ =================

        public SubmissionCoreDTO submitQuiz(
                        String competitionId,
                        QuizSubmissionRequestDTO dto,
                        String studentId) {
                if (dto == null) {
                        throw new IllegalArgumentException("Request body is required");
                }

                Competition competition = validateAndGetCompetition(competitionId, "QUIZ");
                TeamContext ctx = resolveTeamContext(competition, studentId);
                assertRegistered(competition, ctx);

                if (submissionRepository.existsByCompetitionIdAndSubmittedBy(
                                competitionId, ctx.submittedBy())) {
                        throw new IllegalStateException("Quiz can only be submitted once");
                }

                List<Question> questions = resolveQuizQuestionOrderForSubmission(competitionId, studentId, dto);
                if (questions.isEmpty()) {
                        throw new IllegalStateException("No quiz questions available");
                }

                List<String> normalizedAnswers = normalizeQuizAnswers(dto.quizAnswers(), questions.size());
                List<Integer> autoQuestionScores = buildAutoQuestionScores(normalizedAnswers, questions);
                int autoMarksAwarded = autoQuestionScores.stream().filter(Objects::nonNull).mapToInt(Integer::intValue)
                                .sum();

                Submission submission = SubmissionMapper.newQuiz(competitionId, ctx.submittedBy(), ctx, dto);
                submission.setQuizAnswers(normalizedAnswers);
                submission.setQuizQuestionIds(questions.stream().map(Question::getId).toList());
                submission.setAutoQuestionScores(autoQuestionScores);
                submission.setAutoMarksAwarded(autoMarksAwarded);
                // Teacher UI should immediately see the system score; teacher can override
                // later.
                submission.setMarksAwarded(autoMarksAwarded);
                submission.setFeedback(null);
                submission.setSubmissionStatus(SubmissionStatus.SUBMITTED);
                submission.setEvaluation(null);

                return saveSubmissionAndNotify(submission, competition, ctx);
        }

        public List<QuizQuestionDTO> getQuizQuestionsForAttempt(String competitionId, String studentId) {
                Competition competition = competitionRepository.findById(competitionId)
                                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));
                if (!"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
                        throw new IllegalStateException("Quiz questions are only available for internal competitions");
                }
                if (competition.getFormat() == null || !"QUIZ".equalsIgnoreCase(competition.getFormat())) {
                        throw new IllegalStateException("Invalid submission type");
                }
                TeamContext ctx = resolveTeamContext(competition, studentId);
                assertRegistered(competition, ctx);

                if ("DRAFT".equalsIgnoreCase(competition.getStatus())) {
                        throw new IllegalStateException("Quiz is not published yet");
                }

                List<Question> questions = listQuizQuestionsForStudent(competitionId, studentId);

                if (questions.isEmpty()) {
                        throw new IllegalStateException("No quiz questions available");
                }

                return questions.stream()
                                .map(q -> mapToQuizQuestionDTO(q, competitionId, studentId))
                                .toList();
        }

        // ================= HELPERS =================

        private Competition validateAndGetCompetition(
                        String competitionId,
                        String expectedType) {

                Competition competition = competitionRepository.findById(competitionId)
                                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

                if (!"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
                        throw new IllegalStateException("Submissions are only available for internal competitions");
                }

                LocalDateTime now = LocalDateTime.now();
                LocalDateTime submissionOpenAt = resolveSubmissionOpenAt(competition);

                if (submissionOpenAt != null && now.isBefore(submissionOpenAt)) {
                        throw new IllegalStateException("Submission not open yet");
                }

                if (competition.getSubmissionDeadline() != null
                                && now.isAfter(competition.getSubmissionDeadline())) {
                        throw new IllegalStateException("Submission deadline passed");
                }

                String format = competition.getFormat();
                if (format == null || !format.equalsIgnoreCase(expectedType)) {
                        throw new IllegalStateException("Invalid submission type");
                }

                return competition;
        }

        private LocalDateTime resolveSubmissionOpenAt(Competition competition) {
                if (competition.getRegistrationClose() != null) {
                        return competition.getRegistrationClose();
                }
                return competition.getRegistrationDeadline();
        }

        private TeamContext resolveTeamContext(Competition competition, String studentId) {

                String participationType = competition.getParticipationType();
                if (participationType == null || participationType.isBlank()) {
                        throw new IllegalStateException("Competition participation type is not configured");
                }

                if ("INDIVIDUAL".equalsIgnoreCase(participationType)) {
                        return TeamContext.individual(studentId);
                }

                if (!"TEAM".equalsIgnoreCase(participationType)) {
                        throw new IllegalStateException("Unsupported participation type");
                }

                var teams = teamRepository
                                .findByCompetitionIdAndLeaderId(
                                                competition.getCompetitionId(), studentId);

                if (teams.isEmpty()) {
                        throw new IllegalStateException("Student is not a team leader for this competition");
                }

                String teamId = teams.get(0).getTeamId();
                boolean registered = competitionRegistrationRepository
                                .existsByCompetitionIdAndTeamIdAndStatus(
                                                competition.getCompetitionId(),
                                                teamId,
                                                RegistrationStatus.REGISTERED);

                if (!registered) {
                        throw new IllegalStateException("Team not registered");
                }

                return TeamContext.team(teamId, studentId);
        }

        private void assertRegistered(Competition competition, TeamContext ctx) {

                if ("INDIVIDUAL".equalsIgnoreCase(competition.getParticipationType())) {

                        boolean registered = competitionRegistrationRepository
                                        .existsByCompetitionIdAndStudentIdAndStatus(
                                                        competition.getCompetitionId(),
                                                        ctx.submittedBy(),
                                                        RegistrationStatus.REGISTERED);

                        if (!registered) {
                                throw new IllegalStateException("Student is not registered");
                        }
                        return;
                }

                boolean teamRegistered = competitionRegistrationRepository
                                .existsByCompetitionIdAndTeamIdAndStatus(
                                                competition.getCompetitionId(),
                                                ctx.teamId(),
                                                RegistrationStatus.REGISTERED);

                if (!teamRegistered) {
                        throw new IllegalStateException("Team is not registered");
                }
        }

        private List<SubmissionCoreDTO> mapWithCompetitionsForStudent(List<Submission> submissions) {

                if (submissions.isEmpty())
                        return List.of();

                // Batch load competitions to avoid N+1
                var competitionMap = competitionRepository
                                .findAllById(
                                                submissions.stream()
                                                                .map(Submission::getCompetitionId)
                                                                .distinct()
                                                                .toList())
                                .stream()
                                .collect(Collectors.toMap(
                                                Competition::getCompetitionId,
                                                c -> c));

                return submissions.stream()
                                .sorted(submissionSortComparator())
                                .map(s -> mapStudentSubmissionResponse(
                                                s,
                                                competitionMap.get(s.getCompetitionId()),
                                                s.getSubmittedBy()))
                                .toList();
        }

        private SubmissionCoreDTO mapStudentSubmissionResponse(Submission submission, Competition competition,
                        String submittedBy) {
                SubmissionCoreDTO response = SubmissionMapper.toResponse(submission, competition, submittedBy);
                if (response == null) {
                        return null;
                }
                if (shouldExposeEvaluationToStudent(competition)) {
                        return response;
                }
                return hideEvaluationForStudent(response);
        }

        private boolean shouldExposeEvaluationToStudent(Competition competition) {
                if (competition == null) {
                        return true;
                }
                LocalDateTime submissionDeadline = competition.getSubmissionDeadline();
                if (submissionDeadline == null) {
                        return true;
                }
                return !LocalDateTime.now().isBefore(submissionDeadline);
        }

        private SubmissionCoreDTO hideEvaluationForStudent(SubmissionCoreDTO response) {
                if (response == null)
                        return null;

                // If not evaluated, nothing to hide
                if (response.submissionStatus() != SubmissionStatus.EVALUATED) {
                        return response;
                }

                // ✅ Hide teacher evaluation details BEFORE deadline
                // Keep submission content visible so student can review their submission
                return new SubmissionCoreDTO(
                                response.submissionId(),
                                response.competitionId(),
                                response.teamId(),
                                response.submittedBy(),
                                response.submissionType(),
                                response.repoLink(),
                                response.file(),
                                null, // fileType removed or set to null if not needed
                                response.quizAnswers(),
                                response.quizQuestionIds(),
                                response.isTeamSubmission(),
                                response.description(),
                                SubmissionStatus.SUBMITTED, // ✅ show as submitted
                                null, // marksAwarded hidden
                                null, // autoMarksAwarded hidden
                                null, // feedback hidden
                                null, // questionScores hidden
                                null, // autoQuestionScores hidden
                                response.submittedAt(),
                                response.canSubmit(),
                                response.canEdit());
        }

        private QuizQuestionDTO mapToQuizQuestionDTO(Question question, String competitionId, String studentId) {
                List<String> options = question.getOptions();
                if (question.getQuestionType() == QuestionType.TRUE_FALSE
                                && (options == null || options.isEmpty())) {
                        options = List.of("True", "False");
                }

                // Randomize options deterministically per student + question so grading can
                // rely on answer *text*.
                // (Correctness checks compare submitted text to the stored
                // correctAnswer/options.)
                if (options != null && options.size() > 1) {
                        List<String> shuffled = new ArrayList<>(options);
                        long seed = Objects.hash(
                                        competitionId == null ? "" : competitionId,
                                        studentId == null ? "" : studentId,
                                        question.getId() == null ? "" : question.getId());
                        Collections.shuffle(shuffled, new Random(seed));
                        options = shuffled;
                }

                return new QuizQuestionDTO(
                                question.getId(),
                                mapQuestionTypeForStudent(question.getQuestionType()),
                                question.getQuestion(),
                                options,
                                question.getMarks());
        }

        private List<Integer> buildAutoQuestionScores(List<String> answers, List<Question> questions) {
                List<Integer> scores = new ArrayList<>(questions.size());
                for (int index = 0; index < questions.size(); index++) {
                        Question question = questions.get(index);
                        String submitted = index < answers.size() ? answers.get(index) : "";
                        int marks = question.getMarks() == null ? 0 : Math.max(0, question.getMarks());
                        scores.add(isCorrect(question, submitted) ? marks : 0);
                }
                return scores;
        }

        private String mapQuestionTypeForStudent(QuestionType questionType) {
                if (questionType == null) {
                        return "mcq";
                }
                return switch (questionType) {
                        case MULTIPLE_CHOICE -> "mcq";
                        case TRUE_FALSE -> "truefalse";
                        case FILL_IN_BLANK -> "fillblank";
                };
        }

        public record QuizQuestionDTO(
                        String id,
                        String type,
                        String question,
                        List<String> options,
                        Integer marks) {
        }

        private List<Question> listQuizQuestionsOrdered(String competitionId) {
                return questionRepository.findByCompetitionId(competitionId)
                                .stream()
                                .sorted(Comparator
                                                .comparing(Question::getCreatedAt,
                                                                Comparator.nullsLast(Comparator.naturalOrder()))
                                                .thenComparing(question -> question.getId() == null ? ""
                                                                : question.getId()))
                                .toList();
        }

        private List<Question> listQuizQuestionsForStudent(String competitionId, String studentId) {
                List<Question> questions = new ArrayList<>(listQuizQuestionsOrdered(competitionId));
                if (questions.size() <= 1) {
                        return questions;
                }
                long seed = Objects.hash(
                                competitionId == null ? "" : competitionId,
                                studentId == null ? "" : studentId);
                Collections.shuffle(questions, new Random(seed));
                return questions;
        }

        private List<Question> resolveQuizQuestionOrderForSubmission(
                        String competitionId,
                        String studentId,
                        QuizSubmissionRequestDTO dto) {
                if (dto != null && dto.questionIds() != null && !dto.questionIds().isEmpty()) {
                        List<Question> orderedQuestions = new ArrayList<>();
                        Map<String, Question> questionMap = listQuizQuestionsOrdered(competitionId).stream()
                                        .filter(question -> question.getId() != null && !question.getId().isBlank())
                                        .collect(Collectors.toMap(Question::getId, q -> q, (a, b) -> a));
                        for (String questionId : dto.questionIds()) {
                                if (questionId == null || questionId.isBlank()) {
                                        continue;
                                }
                                Question question = questionMap.get(questionId);
                                if (question != null) {
                                        orderedQuestions.add(question);
                                }
                        }
                        if (!orderedQuestions.isEmpty()) {
                                return orderedQuestions;
                        }
                }
                return listQuizQuestionsForStudent(competitionId, studentId);
        }

        private Comparator<Submission> submissionSortComparator() {
                return Comparator
                                .comparing(Submission::getSubmittedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                                .reversed()
                                .thenComparing(submission -> submission.getSubmissionId() == null ? ""
                                                : submission.getSubmissionId());
        }

        private List<String> normalizeQuizAnswers(List<String> answers, int totalQuestions) {
                List<String> normalized = new ArrayList<>(totalQuestions);
                for (int index = 0; index < totalQuestions; index++) {
                        String value = answers != null && index < answers.size() ? answers.get(index) : "";
                        normalized.add(value == null ? "" : value.trim());
                }
                return normalized;
        }

        private int calculateQuizScore(List<String> answers, List<Question> questions) {
                int score = 0;
                for (int index = 0; index < questions.size(); index++) {
                        Question question = questions.get(index);
                        String submitted = index < answers.size() ? answers.get(index) : "";
                        if (isCorrect(question, submitted)) {
                                score += question.getMarks() == null ? 0 : question.getMarks();
                        }
                }
                return score;
        }

        private boolean isCorrect(Question question, String submittedRaw) {
                if (question == null || question.getCorrectAnswer() == null) {
                        return false;
                }

                String submitted = submittedRaw == null ? "" : submittedRaw.trim();
                Object correctAnswer = question.getCorrectAnswer();
                QuestionType type = question.getQuestionType();

                if (type == QuestionType.MULTIPLE_CHOICE) {
                        if (correctAnswer instanceof Number number) {
                                int index = number.intValue();
                                List<String> options = question.getOptions();
                                if (options != null && index >= 0 && index < options.size()) {
                                        return Objects.equals(submitted, options.get(index));
                                }
                                return Objects.equals(submitted, String.valueOf(index));
                        }

                        String correctText = String.valueOf(correctAnswer).trim();
                        try {
                                int optionIndex = Integer.parseInt(correctText);
                                List<String> options = question.getOptions();
                                if (options != null && optionIndex >= 0 && optionIndex < options.size()) {
                                        return Objects.equals(submitted, options.get(optionIndex));
                                }
                        } catch (NumberFormatException ignored) {
                        }
                        return submitted.equalsIgnoreCase(correctText);
                }

                String correctText = String.valueOf(correctAnswer).trim();
                return submitted.equalsIgnoreCase(correctText);
        }

        private SubmissionCoreDTO saveSubmissionAndNotify(Submission submission, Competition competition,
                        TeamContext ctx) {
                if (submission == null) {
                        throw new IllegalArgumentException("Submission is required");
                }

                // ✅ Ensure correct default status after submit/update
                if (submission.getSubmissionStatus() == null) {
                        submission.setSubmissionStatus(SubmissionStatus.SUBMITTED);
                }

                // ✅ If teacher evaluated already, keep evaluated
                // (don’t downgrade status)
                // If your evaluation flow sets EVALUATED, this won’t change it.

                Submission saved = submissionRepository.save(submission);
                notifySubmissionSaved(saved, competition, ctx);

                // ✅ Use your mapper signature consistently (3-args in your current file)
                return SubmissionMapper.toResponse(saved, competition, saved.getSubmittedBy());
        }

        private void notifySubmissionSaved(Submission submission, Competition competition, TeamContext ctx) {
                if (submission == null || competition == null) {
                        return;
                }

                if (ctx != null && ctx.submittedBy() != null && !ctx.submittedBy().isBlank()) {
                        notificationService.createNotification(
                                        ctx.submittedBy(),
                                        "Submission Successful",
                                        "Your submission for '" + competition.getTitle() + "' has been received.",
                                        NotificationType.SUBMISSION_SUCCESS,
                                        competition.getCompetitionId());
                }

                String teacherId = competition.getCreatedBy();
                if (teacherId == null || teacherId.isBlank()) {
                        return;
                }
                if (ctx != null && teacherId.equals(ctx.submittedBy())) {
                        return;
                }

                String participantText = (ctx != null && ctx.isTeamSubmission())
                                ? "A team submission has been received for: "
                                : "A student submission has been received for: ";

                notificationService.createNotification(
                                teacherId,
                                "New Submission Received",
                                participantText + competition.getTitle(),
                                NotificationType.SUBMISSION_RECEIVED,
                                competition.getCompetitionId());
        }
}
