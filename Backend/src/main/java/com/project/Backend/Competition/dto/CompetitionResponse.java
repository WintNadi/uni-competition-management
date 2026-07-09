package com.project.Backend.Competition.dto;

import java.time.LocalDateTime;
import java.util.List;

public class CompetitionResponse {

    private String competitionId;
    private String title;
    private String description;

    private String competitionType;
    private String format;
    private String participationType;
    private String status;

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

    private String createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime publishDate;

    private String materialsFileName;
    private String materialsFilePath;
    private List<String> materialsFileNames;
    private List<String> materialsFilePaths;

    private int submissions;
    private int registeredParticipants;
    private Boolean registered;
    private String mySubmissionStatus;

    public String getCompetitionId() {
        return competitionId;
    }

    public void setCompetitionId(String competitionId) {
        this.competitionId = competitionId;
    }

    public Boolean getRegistered() {
        return registered;
    }

    public void setRegistered(Boolean registered) {
        this.registered = registered;
    }

    public String getMySubmissionStatus() {
        return mySubmissionStatus;
    }

    public void setMySubmissionStatus(String mySubmissionStatus) {
        this.mySubmissionStatus = mySubmissionStatus;
    }

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

    public int getSubmissions() {
        return submissions;
    }

    public void setSubmissions(int submissions) {
        this.submissions = submissions;
    }

    public int getRegisteredParticipants() {
        return registeredParticipants;
    }

    public void setRegisteredParticipants(int registeredParticipants) {
        this.registeredParticipants = registeredParticipants;
    }

    public String getParticipationType() {
        return participationType;
    }

    public void setParticipationType(String participationType) {
        this.participationType = participationType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public void setCreatedByName(String createdByName) {
        this.createdByName = createdByName;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getPublishDate() {
        return publishDate;
    }

    public void setPublishDate(LocalDateTime publishDate) {
        this.publishDate = publishDate;
    }

    public String getMaterialsFileName() {
        return materialsFileName;
    }

    public void setMaterialsFileName(String materialsFileName) {
        this.materialsFileName = materialsFileName;
    }

    public String getMaterialsFilePath() {
        return materialsFilePath;
    }

    public void setMaterialsFilePath(String materialsFilePath) {
        this.materialsFilePath = materialsFilePath;
    }

    public List<String> getMaterialsFileNames() {
        return materialsFileNames;
    }

    public void setMaterialsFileNames(List<String> materialsFileNames) {
        this.materialsFileNames = materialsFileNames;
    }

    public List<String> getMaterialsFilePaths() {
        return materialsFilePaths;
    }

    public void setMaterialsFilePaths(List<String> materialsFilePaths) {
        this.materialsFilePaths = materialsFilePaths;
    }
}
