package com.project.Backend.Competition;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "competitions")
@CompoundIndexes({
    @CompoundIndex(name = "competition_created_type_idx", def = "{'createdBy': 1, 'competitionType': 1}"),
    @CompoundIndex(name = "competition_type_status_idx", def = "{'competitionType': 1, 'status': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Competition {

    @Id
    private String competitionId;

    @Indexed
    private String title;
    private String description;

    // INTERNAL or EXTERNAL
    @Indexed
    private String competitionType;

    // QUIZ, ASSIGNMENT, PROJECT
    private String format;

    // INDIVIDUAL or TEAM
    @Indexed
    private String participationType;

    @Indexed
    private String createdBy;

    // Business flow uses this as a registration close point.
    private LocalDateTime registrationOpen;
    private LocalDateTime registrationClose;
    private LocalDateTime registrationDeadline;
    private LocalDateTime submissionDeadline;
    private LocalDateTime proofDeadline;

    private Integer totalMarks;
    private Integer minTeamSize;
    private Integer maxTeamSize;
    private Integer quizDurationMinutes;

    private String rules;
    private String allowedFileTypes;
    private String materials;

    // External competition fields
    private String organizer;
    private String websiteLink;
    private String location;
    private String eligibility;
    private String mode;
    private String scale;
    private String category;
    private String customCategory;

    // DRAFT, PUBLISHED, UPCOMING, ACTIVE, COMPLETED, CLOSED
    @Indexed
    private String status;

    @Indexed
    private LocalDateTime startDate;
    @Indexed
    private LocalDateTime endDate;

    @Indexed
    private LocalDateTime createdAt;
    private LocalDateTime publishDate;

    private String materialsFileName;
    private String materialsFilePath;
    private List<String> materialsFileNames;
    private List<String> materialsFilePaths;
}
