package com.project.Backend.Question.dto;

import java.util.List;
import com.project.Backend.Question.enums.DifficultyLevel;
import com.project.Backend.Question.enums.QuestionType;
import jakarta.validation.constraints.NotNull;

public class QuestionResponse {

    private String id;
    private String question;
    private String competitionId;

    @NotNull
    private QuestionType questionType;
    private List<String> options; 

    @NotNull
    private Integer marks;
    private Object correctAnswer; 
    private DifficultyLevel difficulty;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getCompetitionId() { return competitionId; }
  public void setCompetitionId(String competitionId) { this.competitionId = competitionId; }

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
