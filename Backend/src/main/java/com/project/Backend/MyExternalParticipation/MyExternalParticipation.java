package com.project.Backend.MyExternalParticipation;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import com.fasterxml.jackson.annotation.JsonFormat;

@Document(collection = "external_participations")
public class MyExternalParticipation {
    @Id
    private String id;
    private String ownerId;
    private String competitionId;
    private String title;
    private String category;
    private String organizer;
    private String mode;
    private String location;
    private String scale;
    private String description;
    private String participationResult;
    private String eligibility;
    private String participationType;
    private Integer teamSizeMin;
    private Integer teamSizeMax;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate startDate;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate endDate;
    private String websiteLink;
    private List<String> proofFiles = new ArrayList<>();

    private String submissionNotes;
    private String sourceConfirmation;
    private Boolean declarationConfirmed;
    private String source;
    // If this student-created announcement matches an admin-created competition,
    // this stores the admin competition id and a flag for frontend display.
    private String matchedAdminCompetitionId;
    private Boolean duplicateWithAdmin;
    private java.time.LocalDateTime proofDeadline;
    private String status;
    private LocalDate submittedAt;
    private String adminNote;
    private String attendanceRecoveryReport;
    private LocalDateTime attendanceRecoveryGeneratedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public String getCompetitionId() {
        return competitionId;
    }

    public void setCompetitionId(String competitionId) {
        this.competitionId = competitionId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getOrganizer() {
        return organizer;
    }

    public void setOrganizer(String organizer) {
        this.organizer = organizer;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getScale() {
        return scale;
    }

    public void setScale(String scale) {
        this.scale = scale;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getParticipationResult() {
        return participationResult;
    }

    public void setParticipationResult(String participationResult) {
        this.participationResult = participationResult;
    }

    public String getEligibility() {
        return eligibility;
    }

    public void setEligibility(String eligibility) {
        this.eligibility = eligibility;
    }

    public String getParticipationType() {
        return participationType;
    }

    public void setParticipationType(String participationType) {
        this.participationType = participationType;
    }

    public Integer getTeamSizeMin() {
        return teamSizeMin;
    }

    public void setTeamSizeMin(Integer teamSizeMin) {
        this.teamSizeMin = teamSizeMin;
    }

    public Integer getTeamSizeMax() {
        return teamSizeMax;
    }

    public void setTeamSizeMax(Integer teamSizeMax) {
        this.teamSizeMax = teamSizeMax;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public String getWebsiteLink() {
        return websiteLink;
    }

    public void setWebsiteLink(String websiteLink) {
        this.websiteLink = websiteLink;
    }

    public List<String> getProofFiles() {
        return proofFiles;
    }

    public void setProofFiles(List<String> proofFiles) {
        this.proofFiles = proofFiles;
    }

    public String getSubmissionNotes() {
        return submissionNotes;
    }

    public void setSubmissionNotes(String submissionNotes) {
        this.submissionNotes = submissionNotes;
    }

    public String getSourceConfirmation() {
        return sourceConfirmation;
    }

    public void setSourceConfirmation(String sourceConfirmation) {
        this.sourceConfirmation = sourceConfirmation;
    }

    public Boolean getDeclarationConfirmed() {
        return declarationConfirmed;
    }

    public void setDeclarationConfirmed(Boolean declarationConfirmed) {
        this.declarationConfirmed = declarationConfirmed;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getMatchedAdminCompetitionId() {
        return matchedAdminCompetitionId;
    }

    public void setMatchedAdminCompetitionId(String matchedAdminCompetitionId) {
        this.matchedAdminCompetitionId = matchedAdminCompetitionId;
    }

    public Boolean getDuplicateWithAdmin() {
        return duplicateWithAdmin;
    }

    public void setDuplicateWithAdmin(Boolean duplicateWithAdmin) {
        this.duplicateWithAdmin = duplicateWithAdmin;
    }

    public java.time.LocalDateTime getProofDeadline() {
        return proofDeadline;
    }

    public void setProofDeadline(java.time.LocalDateTime proofDeadline) {
        this.proofDeadline = proofDeadline;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDate submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getAdminNote() {
        return adminNote;
    }

    public void setAdminNote(String adminNote) {
        this.adminNote = adminNote;
    }

    public String getAttendanceRecoveryReport() {
        return attendanceRecoveryReport;
    }

    public void setAttendanceRecoveryReport(String attendanceRecoveryReport) {
        this.attendanceRecoveryReport = attendanceRecoveryReport;
    }

    public LocalDateTime getAttendanceRecoveryGeneratedAt() {
        return attendanceRecoveryGeneratedAt;
    }

    public void setAttendanceRecoveryGeneratedAt(LocalDateTime attendanceRecoveryGeneratedAt) {
        this.attendanceRecoveryGeneratedAt = attendanceRecoveryGeneratedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
