package com.project.Backend.Question.dto;

import com.project.Backend.Question.enums.DifficultyLevel;
import com.project.Backend.Question.enums.QuestionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class CreateQuestionRequest {

    @NotNull
    //private String competitionId;

    @NotBlank
    private String question;

    @NotNull
    private QuestionType questionType;
    private List<String> options; 

    @NotNull
    private Integer marks;
    private Object correctAnswer; 
    private DifficultyLevel difficulty;

    //private Integer orderIndex;
    //private Boolean isActive = true; // default to true

    //public String getCompetitionId() { return competitionId; }
    //public void setCompetitionId(String competitionId) { this.competitionId = competitionId; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public QuestionType getQuestionType() { return questionType; }
    public void setQuestionType(QuestionType questionType) { this.questionType = questionType; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public Integer getMarks() { return marks; }
    public void setMarks(Integer marks) { this.marks = marks; }

    public Object getCorrectAnswer() { return correctAnswer; }
    public void setCorrectAnswer(Object correctAnswer) { this.correctAnswer = correctAnswer; }

    //public Integer getOrderIndex() { return orderIndex; }
    //public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }

    //public Boolean getIsActive() { return isActive; }
    //public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public DifficultyLevel getDifficulty() { return difficulty; }
    public void setDifficulty(DifficultyLevel difficulty) { this.difficulty = difficulty; }
}
