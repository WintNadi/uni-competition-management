package com.project.Backend.Evaluation;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Evaluation {
    private Integer marksAwarded;
    private String feedback;
    private List<Integer> questionScores;
    private LocalDateTime evaluatedAt;
}
