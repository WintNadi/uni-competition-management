package com.project.Backend.Milestone;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "milestones")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Milestone {
    @Id
    private String milestoneId;
    private String studentId;
    private String title;
    private String achievedAt;
    private Integer points;
}
