package com.project.Backend.Question;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.Question.dto.CreateQuestionRequest;
import com.project.Backend.Question.dto.QuestionResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {

    private final QuestionRepository questionRepository;
    private final CompetitionRepository competitionRepository;

    @Override
    public QuestionResponse addQuestion(String competitionId, CreateQuestionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }

        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

        if (!"QUIZ".equalsIgnoreCase(competition.getFormat())) {
            throw new IllegalStateException("Questions can only be added for QUIZ competitions");
        }
        assertCompetitionQuestionEditable(competition);

        Question question = new Question();
        question.setCompetitionId(competitionId);
        question.setQuestionType(request.getQuestionType());
        question.setQuestion(request.getQuestion());
        List<String> normalizedOptions = normalizeQuestionOptions(request.getQuestionType(), request.getOptions());
        question.setOptions(normalizedOptions);
        question.setCorrectAnswer(normalizeCorrectAnswer(
                request.getQuestionType(),
                request.getCorrectAnswer(),
                normalizedOptions));
        question.setMarks(request.getMarks());
        question.setDifficulty(request.getDifficulty());
        question.setCreatedAt(LocalDateTime.now());

        Question saved = questionRepository.save(question);
        recalculateQuizTotalMarks(competitionId);
        return mapToResponse(saved);
    }

    @Override
    public List<QuestionResponse> getQuestionsByCompetition(String competitionId) {
        return questionRepository.findByCompetitionId(competitionId)
                .stream()
                .sorted(Comparator
                        .comparing(Question::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(question -> question.getId() == null ? "" : question.getId()))
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    public QuestionResponse updateQuestion(String questionId, CreateQuestionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found"));
        Competition competition = competitionRepository.findById(question.getCompetitionId())
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));
        assertCompetitionQuestionEditable(competition);

        question.setQuestionType(request.getQuestionType());
        question.setQuestion(request.getQuestion());
        List<String> normalizedOptions = normalizeQuestionOptions(request.getQuestionType(), request.getOptions());
        question.setOptions(normalizedOptions);
        question.setCorrectAnswer(normalizeCorrectAnswer(
                request.getQuestionType(),
                request.getCorrectAnswer(),
                normalizedOptions));
        question.setMarks(request.getMarks());
        question.setDifficulty(request.getDifficulty());

        Question saved = questionRepository.save(question);
        recalculateQuizTotalMarks(question.getCompetitionId());
        return mapToResponse(saved);
    }

    @Override
    public void deleteQuestion(String questionId) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found"));
        Competition competition = competitionRepository.findById(question.getCompetitionId())
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));
        assertCompetitionQuestionEditable(competition);
        questionRepository.deleteById(questionId);
        recalculateQuizTotalMarks(question.getCompetitionId());
    }

    @Override
    public void deleteBulkQuestions(String competitionId, List<String> questionIds) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));
        assertCompetitionQuestionEditable(competition);
        if (questionIds == null || questionIds.isEmpty()) {
            throw new IllegalArgumentException("questionIds are required");
        }
        questionRepository.deleteAllById(questionIds);
        recalculateQuizTotalMarks(competitionId);
    }

    private QuestionResponse mapToResponse(Question question) {
        QuestionResponse response = new QuestionResponse();
        response.setId(question.getId());
        response.setCompetitionId(question.getCompetitionId());
        response.setQuestionType(question.getQuestionType());
        response.setQuestion(question.getQuestion());
        response.setOptions(normalizeQuestionOptions(question.getQuestionType(), question.getOptions()));
        response.setCorrectAnswer(question.getCorrectAnswer());
        response.setMarks(question.getMarks());
        response.setDifficulty(question.getDifficulty());
        return response;
    }

    private List<String> normalizeQuestionOptions(
            com.project.Backend.Question.enums.QuestionType type,
            List<String> options) {
        if (type == null || type != com.project.Backend.Question.enums.QuestionType.MULTIPLE_CHOICE) {
            return options;
        }
        List<String> normalized = new ArrayList<>();
        if (options == null) {
            return normalized;
        }
        for (String option : options) {
            if (option == null) {
                continue;
            }
            String value = option.trim();
            if (!value.isBlank()) {
                normalized.add(value);
            }
        }
        return normalized;
    }

    private Object normalizeCorrectAnswer(
            com.project.Backend.Question.enums.QuestionType type,
            Object correctAnswer,
            List<String> normalizedOptions) {
        if (type == null) {
            return correctAnswer;
        }
        if (type != com.project.Backend.Question.enums.QuestionType.MULTIPLE_CHOICE) {
            return correctAnswer;
        }
        if (correctAnswer == null) {
            throw new IllegalArgumentException("Correct answer is required");
        }

        int index;
        if (correctAnswer instanceof Number number) {
            index = number.intValue();
        } else {
            String raw = String.valueOf(correctAnswer).trim();
            try {
                index = Integer.parseInt(raw);
            } catch (NumberFormatException ex) {
                if (normalizedOptions != null) {
                    int found = normalizedOptions.indexOf(raw);
                    if (found >= 0) {
                        return found;
                    }
                }
                throw new IllegalArgumentException("Correct answer must match an option index");
            }
        }

        if (normalizedOptions == null || normalizedOptions.isEmpty()) {
            throw new IllegalArgumentException("At least two options are required for multiple choice questions");
        }
        if (normalizedOptions.size() < 2) {
            throw new IllegalArgumentException("At least two options are required for multiple choice questions");
        }
        if (index < 0 || index >= normalizedOptions.size()) {
            throw new IllegalArgumentException("Correct answer index is out of range for provided options");
        }
        return index;
    }

    private void recalculateQuizTotalMarks(String competitionId) {
        if (competitionId == null || competitionId.isBlank()) {
            return;
        }

        Competition competition = competitionRepository.findById(competitionId).orElse(null);
        if (competition == null || !"QUIZ".equalsIgnoreCase(competition.getFormat())) {
            return;
        }

        int totalMarks = questionRepository.findByCompetitionId(competitionId)
                .stream()
                .map(question -> question.getMarks() == null ? 0 : question.getMarks())
                .reduce(0, Integer::sum);
        competition.setTotalMarks(totalMarks);
        competitionRepository.save(competition);
    }

    private void assertCompetitionQuestionEditable(Competition competition) {
        if (competition == null || !"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            return;
        }
        LocalDateTime registrationClose = competition.getRegistrationClose() != null
                ? competition.getRegistrationClose()
                : competition.getRegistrationDeadline();
        if (registrationClose != null && !LocalDateTime.now().isBefore(registrationClose)) {
            throw new IllegalStateException("Questions cannot be edited after registration closes");
        }
    }
}
