package com.project.Backend.Competition.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import jakarta.validation.constraints.NotBlank;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateCompetitionRequest {

    @NotBlank
    private String title;
    private String description;

    private String competitionType;
    private String format;
    private String participationType;

    // Frontend compatibility aliases
    private LocalDateTime registrationDeadline;
    private LocalDateTime registrationOpen;
    private LocalDateTime registrationClose;
    private LocalDateTime submissionDeadline;

    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private LocalDateTime proofDeadline;

    private Integer totalMarks;
    private Integer minTeamSize;
    private Integer maxTeamSize;
    private Integer quizDurationMinutes;
    private Integer quizTimeAllowed;

    private String rules;
    private String allowedFileTypes;
    private String materials;

    private String organizer;
    private String websiteLink;
    private String website;
    private String location;
    private String eligibility;
    private String mode;
    private String scale;
    private String category;
    private String customCategory;

    @JsonAlias({"removeMaterials"})
    private boolean deleteMaterials;

    @JsonAlias({"retainedMaterialPaths", "keptMaterialPaths"})
    private List<String> keepMaterialPaths;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCompetitionType() {
        return competitionType;
    }

    public void setCompetitionType(String competitionType) {
        this.competitionType = competitionType;
    }

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }

    public String getParticipationType() {
        return participationType;
    }

    public void setParticipationType(String participationType) {
        this.participationType = participationType;
    }

    public LocalDateTime getRegistrationDeadline() {
        return registrationDeadline;
    }

    public void setRegistrationDeadline(LocalDateTime registrationDeadline) {
        this.registrationDeadline = registrationDeadline;
    }

    public LocalDateTime getRegistrationOpen() {
        return registrationOpen;
    }

    public void setRegistrationOpen(LocalDateTime registrationOpen) {
        this.registrationOpen = registrationOpen;
    }

    public LocalDateTime getRegistrationClose() {
        return registrationClose;
    }

    public void setRegistrationClose(LocalDateTime registrationClose) {
        this.registrationClose = registrationClose;
    }

    public LocalDateTime getSubmissionDeadline() {
        return submissionDeadline;
    }

    public void setSubmissionDeadline(LocalDateTime submissionDeadline) {
        this.submissionDeadline = submissionDeadline;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
    }

    public LocalDateTime getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDateTime endDate) {
        this.endDate = endDate;
    }

    public LocalDateTime getProofDeadline() {
        return proofDeadline;
    }

    public void setProofDeadline(LocalDateTime proofDeadline) {
        this.proofDeadline = proofDeadline;
    }

    public Integer getTotalMarks() {
        return totalMarks;
    }

    public void setTotalMarks(Integer totalMarks) {
        this.totalMarks = totalMarks;
    }

    public Integer getMinTeamSize() {
        return minTeamSize;
    }

    public void setMinTeamSize(Integer minTeamSize) {
        this.minTeamSize = minTeamSize;
    }

    public Integer getMaxTeamSize() {
        return maxTeamSize;
    }

    public void setMaxTeamSize(Integer maxTeamSize) {
        this.maxTeamSize = maxTeamSize;
    }

    public Integer getQuizDurationMinutes() {
        return quizDurationMinutes;
    }

    public void setQuizDurationMinutes(Integer quizDurationMinutes) {
        this.quizDurationMinutes = quizDurationMinutes;
    }

    public Integer getQuizTimeAllowed() {
        return quizTimeAllowed;
    }

    public void setQuizTimeAllowed(Integer quizTimeAllowed) {
        this.quizTimeAllowed = quizTimeAllowed;
    }

    public String getRules() {
        return rules;
    }

    public void setRules(String rules) {
        this.rules = rules;
    }

    public String getAllowedFileTypes() {
        return allowedFileTypes;
    }

    public void setAllowedFileTypes(String allowedFileTypes) {
        this.allowedFileTypes = allowedFileTypes;
    }

    public String getMaterials() {
        return materials;
    }

    public void setMaterials(String materials) {
        this.materials = materials;
    }

    public String getOrganizer() {
        return organizer;
    }

    public void setOrganizer(String organizer) {
        this.organizer = organizer;
    }

    public String getWebsiteLink() {
        return websiteLink;
    }

    public void setWebsiteLink(String websiteLink) {
        this.websiteLink = websiteLink;
    }

    public String getWebsite() {
        return website;
    }

    public void setWebsite(String website) {
        this.website = website;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getEligibility() {
        return eligibility;
    }

    public void setEligibility(String eligibility) {
        this.eligibility = eligibility;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getScale() {
        return scale;
    }

    public void setScale(String scale) {
        this.scale = scale;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getCustomCategory() {
        return customCategory;
    }

    public void setCustomCategory(String customCategory) {
        this.customCategory = customCategory;
    }

    public boolean isDeleteMaterials() {
        return deleteMaterials;
    }

    public void setDeleteMaterials(boolean deleteMaterials) {
        this.deleteMaterials = deleteMaterials;
    }

    public List<String> getKeepMaterialPaths() {
        return keepMaterialPaths;
    }

    public void setKeepMaterialPaths(List<String> keepMaterialPaths) {
        this.keepMaterialPaths = keepMaterialPaths;
    }
}
