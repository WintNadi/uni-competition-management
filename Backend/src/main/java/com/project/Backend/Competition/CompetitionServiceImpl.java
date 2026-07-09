package com.project.Backend.Competition;

import java.io.File;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.project.Backend.Auth.Role;
import com.project.Backend.Competition.dto.CompetitionResponse;
import com.project.Backend.Competition.dto.CreateCompetitionRequest;
import com.project.Backend.CompetitionRegistration.CompetitionRegistration;
import com.project.Backend.CompetitionRegistration.CompetitionRegistrationRepository;
import com.project.Backend.CompetitionRegistration.RegistrationStatus;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Notification.NotificationType;
import com.project.Backend.Question.QuestionRepository;
import com.project.Backend.Submission.SubmissionRepository;
import com.project.Backend.Team.Team;
import com.project.Backend.Team.TeamRepository;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CompetitionServiceImpl implements CompetitionService {

    private static final String UPLOAD_DIR_RELATIVE = "uploads/competitions";
    private static final String UPLOAD_WEB_PREFIX = "/uploads/competitions/";

    private final CompetitionRepository competitionRepository;
    private final QuestionRepository questionRepository;
    private final SubmissionRepository submissionRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Override
    public CompetitionResponse createCompetition(
            CreateCompetitionRequest request,
            MultipartFile[] materials,
            String userId,
            String role) {

        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }

        String competitionType = resolveCompetitionType(request.getCompetitionType(), role);
        validateRequest(request, competitionType, null);

        Competition competition = new Competition();
        applyRequest(competition, request, competitionType);
        competition.setCreatedBy(userId);
        competition.setCreatedAt(LocalDateTime.now());
        competition.setStatus(resolveInitialStatus(competition));

        handleMaterials(competition, materials, request.isDeleteMaterials(), request.getKeepMaterialPaths());

        Competition saved = competitionRepository.save(competition);
        if ("EXTERNAL".equalsIgnoreCase(saved.getCompetitionType())) {
            notifyStudentsAboutCompetitionPublished(saved);
        }
        return mapToResponse(saved, userId, role);
    }

    @Override
    public List<CompetitionResponse> getAllCompetitions(String userId, String role) {
        List<Competition> competitions;
        if (role == null) {
            competitions = competitionRepository.findAll();
        } else {
            String normalizedRole = role.toUpperCase(Locale.ROOT);
            if (normalizedRole.contains("TEACHER")) {
                competitions = competitionRepository.findByCreatedByAndCompetitionType(userId, "INTERNAL");
            } else if (normalizedRole.contains("ADMIN")) {
                competitions = competitionRepository.findByCreatedByAndCompetitionType(userId, "EXTERNAL");
            } else if (normalizedRole.contains("STUDENT")) {
                competitions = competitionRepository.findAll().stream()
                        .filter(c -> c.getStatus() == null || !"DRAFT".equalsIgnoreCase(c.getStatus()))
                        .toList();
            } else {
                competitions = competitionRepository.findAll();
            }
        }

        return competitions.stream()
                .sorted(Comparator
                        .comparing(this::resolveSortTimestamp, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(c -> c.getCompetitionId() == null ? "" : c.getCompetitionId()))
                .map(c -> mapToResponse(c, userId, role))
                .toList();
    }

    @Override
    public CompetitionResponse getCompetitionById(String id, String userId, String role) {
        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));
        return mapToResponse(competition, userId, role);
    }

    @Override
    public CompetitionResponse updateCompetition(
            String id,
            CreateCompetitionRequest request,
            MultipartFile[] materials) {

        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }

        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

        assertInternalCompetitionEditable(competition);
        assertExternalCompetitionUpdateAllowed(competition, request, materials);

        boolean wasPublished = "PUBLISHED".equalsIgnoreCase(competition.getStatus());
        String competitionType = competition.getCompetitionType();
        validateRequest(request, competitionType, competition);
        applyRequest(competition, request, competitionType);
        competition.setStatus(resolveInitialStatus(competition));

        handleMaterials(competition, materials, request.isDeleteMaterials(), request.getKeepMaterialPaths());

        Competition saved = competitionRepository.save(competition);
        if (wasPublished && "INTERNAL".equalsIgnoreCase(saved.getCompetitionType())) {
            notifyStudentsAboutCompetitionUpdated(saved);
        }
        return mapToResponse(saved, null, null);
    }

    @Override
    public void publishCompetition(String id) {
        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

        assertInternalCompetitionPublishable(competition);

        if ("QUIZ".equalsIgnoreCase(competition.getFormat())) {
            boolean hasQuestions = !questionRepository.findByCompetitionId(competition.getCompetitionId()).isEmpty();
            if (!hasQuestions) {
                throw new IllegalStateException("Quiz must have at least one question before publishing");
            }
        }

        competition.setStatus("PUBLISHED");
        competition.setPublishDate(LocalDateTime.now());
        competitionRepository.save(competition);
        notifyStudentsAboutCompetitionPublished(competition);
    }

    @Override
    public void deleteCompetition(String id) {
        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));
        assertInternalCompetitionDeletable(competition);
        notifyStudentsAboutCompetitionDeleted(competition);
        competitionRegistrationRepository.deleteByCompetitionId(competition.getCompetitionId());
        teamRepository.deleteByCompetitionId(competition.getCompetitionId());
        questionRepository.deleteByCompetitionId(competition.getCompetitionId());
        clearMaterialFiles(competition);
        competitionRepository.delete(competition);
    }

    @Override
    public void deleteCompetitionMaterial(String id) {
        Competition competition = competitionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));
        assertInternalCompetitionEditable(competition);
        clearMaterialFiles(competition);
        competitionRepository.save(competition);
    }

    private String resolveCompetitionType(String explicitType, String role) {
        if (explicitType != null && !explicitType.isBlank()) {
            return explicitType.toUpperCase(Locale.ROOT);
        }
        if (role == null) {
            throw new IllegalStateException("Unable to resolve competition type");
        }
        String normalizedRole = role.toUpperCase(Locale.ROOT);
        if (normalizedRole.contains("TEACHER")) {
            return "INTERNAL";
        }
        if (normalizedRole.contains("ADMIN")) {
            return "EXTERNAL";
        }
        throw new IllegalStateException("Only teacher or admin can create competitions");
    }

    private void validateRequest(CreateCompetitionRequest request, String competitionType,
            Competition existingCompetition) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new IllegalArgumentException("title is required");
        }
        if (request.getParticipationType() == null || request.getParticipationType().isBlank()) {
            throw new IllegalArgumentException("participationType is required");
        }
        if (request.getFormat() == null || request.getFormat().isBlank()) {
            throw new IllegalArgumentException("format is required");
        }

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime registrationDeadline = pickRegistrationDeadline(request);
        LocalDateTime submissionDeadline = request.getSubmissionDeadline();

        if ("INTERNAL".equalsIgnoreCase(competitionType)) {
            if (registrationDeadline == null || submissionDeadline == null) {
                throw new IllegalArgumentException("registrationDeadline and submissionDeadline are required");
            }

            ensureNotPast(registrationDeadline, "registrationDeadline", todayStart);
            ensureNotPast(submissionDeadline, "submissionDeadline", todayStart);
            ensureNotPast(request.getRegistrationOpen(), "registrationOpen", todayStart);
            ensureNotPast(request.getRegistrationClose(), "registrationClose", todayStart);

            if (registrationDeadline.isAfter(submissionDeadline)) {
                throw new IllegalArgumentException("registrationDeadline must be before submissionDeadline");
            }

            if (request.getRegistrationOpen() != null && request.getRegistrationClose() != null
                    && request.getRegistrationOpen().isAfter(request.getRegistrationClose())) {
                throw new IllegalArgumentException("registrationOpen must be before registrationClose");
            }

            if (request.getRegistrationClose() != null && submissionDeadline.isBefore(request.getRegistrationClose())) {
                throw new IllegalArgumentException("submissionDeadline must be after registrationClose");
            }
        }

        if ("EXTERNAL".equalsIgnoreCase(competitionType)) {
            if (request.getStartDate() == null || request.getEndDate() == null) {
                throw new IllegalArgumentException("startDate and endDate are required for external competitions");
            }

            boolean unchangedDatesOnUpdate = existingCompetition != null
                    && existingCompetition.getStartDate() != null
                    && existingCompetition.getEndDate() != null
                    && request.getStartDate().equals(existingCompetition.getStartDate())
                    && request.getEndDate().equals(existingCompetition.getEndDate());

            if (!unchangedDatesOnUpdate) {
                ensureNotPast(request.getStartDate(), "startDate", todayStart);
                ensureNotPast(request.getEndDate(), "endDate", todayStart);
            }

            if (request.getEndDate().isBefore(request.getStartDate())) {
                throw new IllegalArgumentException("endDate must be on or after startDate");
            }

            LocalDateTime registrationOpen = request.getRegistrationOpen();
            LocalDateTime registrationClose = request.getRegistrationClose() != null
                    ? request.getRegistrationClose()
                    : request.getRegistrationDeadline();
            if (registrationOpen == null || registrationClose == null) {
                throw new IllegalArgumentException("registrationOpen and registrationClose are required for external competitions");
            }

            boolean unchangedRegistrationWindow = existingCompetition != null
                    && Objects.equals(registrationOpen, existingCompetition.getRegistrationOpen())
                    && Objects.equals(registrationClose, resolveRegistrationClose(existingCompetition));
            if (!unchangedRegistrationWindow) {
                ensureNotPast(registrationOpen, "registrationOpen", todayStart);
                ensureNotPast(registrationClose, "registrationClose", todayStart);
            }

            if (registrationOpen.isAfter(registrationClose)) {
                throw new IllegalArgumentException("registrationOpen must be before registrationClose");
            }

            LocalDate startDateOnly = request.getStartDate().toLocalDate();
            if (registrationOpen.toLocalDate().isAfter(startDateOnly)) {
                throw new IllegalArgumentException("registrationOpen must be on or before startDate");
            }
            if (registrationClose.toLocalDate().isAfter(startDateOnly)) {
                throw new IllegalArgumentException("registrationClose must be on or before startDate");
            }

            if (request.getProofDeadline() != null) {
                if (existingCompetition == null) {
                    throw new IllegalArgumentException(
                            "proofDeadline cannot be set during external competition creation");
                }

                LocalDate endDateOnly = request.getEndDate().toLocalDate();
                if (LocalDate.now().isBefore(endDateOnly)) {
                    throw new IllegalArgumentException("proofDeadline can only be set on or after endDate");
                }

                if (request.getProofDeadline().toLocalDate().isBefore(endDateOnly)) {
                    throw new IllegalArgumentException("proofDeadline must be on or after endDate");
                }

                ensureNotPast(request.getProofDeadline(), "proofDeadline", LocalDateTime.now());
            }
            if (existingCompetition != null
                    && existingCompetition.getProofDeadline() != null
                    && request.getProofDeadline() == null) {
                throw new IllegalArgumentException("proofDeadline cannot be removed once it has been set");
            }
        }

        if ("TEAM".equalsIgnoreCase(request.getParticipationType())) {
            if (request.getMinTeamSize() == null || request.getMaxTeamSize() == null) {
                throw new IllegalArgumentException("minTeamSize and maxTeamSize are required for TEAM competitions");
            }
            if (request.getMinTeamSize() > request.getMaxTeamSize()) {
                throw new IllegalArgumentException("minTeamSize cannot be greater than maxTeamSize");
            }
        }
    }

    private void ensureNotPast(LocalDateTime value, String fieldName, LocalDateTime todayStart) {
        if (value != null && value.isBefore(todayStart)) {
            throw new IllegalArgumentException(fieldName + " cannot be in the past");
        }
    }

    private void applyRequest(Competition competition, CreateCompetitionRequest request, String competitionType) {
        competition.setTitle(request.getTitle());
        competition.setDescription(request.getDescription());

        competition.setCompetitionType(competitionType);
        competition.setFormat(upperOrNull(request.getFormat()));
        competition.setParticipationType(upperOrNull(request.getParticipationType()));

        competition.setRegistrationOpen(request.getRegistrationOpen());
        competition.setRegistrationClose(request.getRegistrationClose());
        competition.setRegistrationDeadline(pickRegistrationDeadline(request));
        competition.setSubmissionDeadline(request.getSubmissionDeadline());
        competition.setProofDeadline(request.getProofDeadline());

        competition.setStartDate(request.getStartDate());
        competition.setEndDate(request.getEndDate());

        if ("QUIZ".equalsIgnoreCase(request.getFormat())) {
            competition.setTotalMarks(resolveQuizTotalMarks(competition.getCompetitionId()));
        } else {
            competition.setTotalMarks(request.getTotalMarks());
        }
        competition.setMinTeamSize(request.getMinTeamSize());
        competition.setMaxTeamSize(request.getMaxTeamSize());
        competition.setQuizDurationMinutes(resolveQuizDurationMinutes(request));

        competition.setRules(request.getRules());
        competition.setAllowedFileTypes(request.getAllowedFileTypes());
        competition.setMaterials(request.getMaterials());

        competition.setOrganizer(request.getOrganizer());
        competition.setWebsiteLink(resolveWebsiteLink(request));
        competition.setLocation(request.getLocation());
        competition.setEligibility(request.getEligibility());
        competition.setMode(request.getMode());
        competition.setScale(request.getScale());
        competition.setCategory(request.getCategory());
        competition.setCustomCategory(request.getCustomCategory());
    }

    private Integer resolveQuizDurationMinutes(CreateCompetitionRequest request) {
        if (request.getQuizDurationMinutes() != null) {
            return request.getQuizDurationMinutes();
        }
        return request.getQuizTimeAllowed();
    }

    private LocalDateTime pickRegistrationDeadline(CreateCompetitionRequest request) {
        if (request.getRegistrationDeadline() != null) {
            return request.getRegistrationDeadline();
        }
        if (request.getRegistrationClose() != null) {
            return request.getRegistrationClose();
        }
        return request.getRegistrationOpen();
    }

    private String resolveWebsiteLink(CreateCompetitionRequest request) {
        if (request.getWebsiteLink() != null && !request.getWebsiteLink().isBlank()) {
            return request.getWebsiteLink();
        }
        return request.getWebsite();
    }

    private String resolveInitialStatus(Competition competition) {
        String type = competition.getCompetitionType();
        if ("INTERNAL".equalsIgnoreCase(type)) {
            if (competition.getSubmissionDeadline() != null
                    && LocalDateTime.now().isAfter(competition.getSubmissionDeadline())) {
                return "CLOSED";
            }
            if ("PUBLISHED".equalsIgnoreCase(competition.getStatus())) {
                return "PUBLISHED";
            }
            return "DRAFT";
        }
        return computeExternalStatus(competition.getStartDate(), competition.getEndDate());
    }

    private String computeExternalStatus(LocalDateTime start, LocalDateTime end) {
        LocalDateTime now = LocalDateTime.now();
        if (start != null && now.isBefore(start)) {
            return "UPCOMING";
        }
        if (end != null && now.isAfter(end)) {
            return "COMPLETED";
        }
        return "ACTIVE";
    }

    private void handleMaterials(
            Competition competition,
            MultipartFile[] materials,
            boolean deleteMaterials,
            List<String> keepMaterialPaths) {

        List<String> names = new ArrayList<>(resolveMaterialNames(competition));
        List<String> paths = new ArrayList<>(resolveMaterialPaths(competition));

        if (deleteMaterials) {
            for (String path : paths) {
                deleteOldFile(path);
            }
            names.clear();
            paths.clear();
        } else if (keepMaterialPaths != null) {
            Set<String> keep = new HashSet<>(keepMaterialPaths.stream()
                    .filter(v -> v != null && !v.isBlank())
                    .toList());

            List<String> keptNames = new ArrayList<>();
            List<String> keptPaths = new ArrayList<>();
            for (int i = 0; i < paths.size(); i++) {
                String path = paths.get(i);
                String name = i < names.size() ? names.get(i) : null;
                if (path != null && keep.contains(path)) {
                    keptPaths.add(path);
                    keptNames.add(name != null ? name : path);
                } else {
                    deleteOldFile(path);
                }
            }
            names = keptNames;
            paths = keptPaths;
        }

        List<MultipartFile> incoming = normalizeFiles(materials);
        for (MultipartFile material : incoming) {
            MaterialFile stored = storeMaterial(material);
            names.add(stored.fileName());
            paths.add(stored.filePath());
        }

        competition.setMaterialsFileNames(names);
        competition.setMaterialsFilePaths(paths);
        competition.setMaterialsFileName(names.isEmpty() ? null : names.get(0));
        competition.setMaterialsFilePath(paths.isEmpty() ? null : paths.get(0));
    }

    private List<MultipartFile> normalizeFiles(MultipartFile[] materials) {
        List<MultipartFile> out = new ArrayList<>();
        if (materials == null) {
            return out;
        }
        for (MultipartFile material : materials) {
            if (material != null && !material.isEmpty()) {
                out.add(material);
            }
        }
        return out;
    }

    private void clearMaterialFiles(Competition competition) {
        List<String> oldPaths = resolveMaterialPaths(competition);
        for (String path : oldPaths) {
            deleteOldFile(path);
        }

        competition.setMaterialsFileNames(new ArrayList<>());
        competition.setMaterialsFilePaths(new ArrayList<>());
        competition.setMaterialsFileName(null);
        competition.setMaterialsFilePath(null);
    }

    private MaterialFile storeMaterial(MultipartFile material) {
        try {
            File directory = new File(System.getProperty("user.dir"), UPLOAD_DIR_RELATIVE);
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("Failed to create competition upload directory");
            }

            String safeName = material.getOriginalFilename() == null
                    ? "materials.bin"
                    : material.getOriginalFilename().replaceAll("[^a-zA-Z0-9._-]", "_");
            String fileName = System.currentTimeMillis() + "_" + safeName;
            File target = new File(directory, fileName);
            material.transferTo(target);

            return new MaterialFile(
                    material.getOriginalFilename() == null ? fileName : material.getOriginalFilename(),
                    UPLOAD_WEB_PREFIX + fileName);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to store competition material", ex);
        }
    }

    private void deleteOldFile(String path) {
        if (path == null || path.isBlank()) {
            return;
        }

        File file = resolveFile(path);
        if (file.exists()) {
            file.delete();
        }
    }

    private File resolveFile(String path) {
        String normalized = path.replace('\\', '/');
        if (normalized.startsWith("/uploads/")) {
            String relative = normalized.substring(1);
            return new File(System.getProperty("user.dir"), relative);
        }
        if (normalized.startsWith("uploads/")) {
            return new File(System.getProperty("user.dir"), normalized);
        }
        return new File(path);
    }

    private CompetitionResponse mapToResponse(Competition competition, String userId, String role) {
        CompetitionResponse response = new CompetitionResponse();
        if (role != null && role.contains("STUDENT")) {

            boolean registered = competitionRegistrationRepository
                    .existsByCompetitionIdAndStudentIdAndStatus(
                            competition.getCompetitionId(),
                            userId,
                            RegistrationStatus.REGISTERED);

            response.setRegistered(registered);

            if (!registered) {
                response.setMySubmissionStatus("NOT_REGISTERED");
            } else {
                submissionRepository
                        .findByCompetitionIdAndSubmittedBy(
                                competition.getCompetitionId(),
                                userId)
                        .ifPresentOrElse(
                                s -> response.setMySubmissionStatus(
                                        s.getSubmissionStatus().name()),
                                () -> response.setMySubmissionStatus("NOT_SUBMITTED"));
            }
        }
        response.setCompetitionId(competition.getCompetitionId());
        response.setTitle(competition.getTitle());
        response.setDescription(competition.getDescription());
        response.setCompetitionType(competition.getCompetitionType());
        response.setFormat(competition.getFormat());
        response.setParticipationType(competition.getParticipationType());
        response.setStatus(competition.getStatus());
        response.setRegistrationDeadline(resolveRegistrationClose(competition));
        response.setRegistrationOpen(competition.getRegistrationOpen());
        response.setRegistrationClose(resolveRegistrationClose(competition));
        response.setSubmissionDeadline(competition.getSubmissionDeadline());
        response.setStartDate(competition.getStartDate());
        response.setEndDate(competition.getEndDate());
        response.setProofDeadline(competition.getProofDeadline());
        response.setTotalMarks(resolveTotalMarks(competition));
        response.setMinTeamSize(competition.getMinTeamSize());
        response.setMaxTeamSize(competition.getMaxTeamSize());
        response.setQuizDurationMinutes(competition.getQuizDurationMinutes());
        response.setRules(competition.getRules());
        response.setAllowedFileTypes(competition.getAllowedFileTypes());
        response.setMaterials(competition.getMaterials());
        response.setOrganizer(competition.getOrganizer());
        response.setWebsiteLink(competition.getWebsiteLink());
        response.setWebsite(competition.getWebsiteLink());
        response.setLocation(competition.getLocation());
        response.setEligibility(competition.getEligibility());
        response.setMode(competition.getMode());
        response.setScale(competition.getScale());
        response.setCategory(competition.getCategory());
        response.setCustomCategory(competition.getCustomCategory());
        response.setCreatedBy(competition.getCreatedBy());
        response.setCreatedByName(resolveCreatorName(competition.getCreatedBy()));
        response.setCreatedAt(competition.getCreatedAt());
        response.setPublishDate(competition.getPublishDate());

        List<String> materialNames = resolveMaterialNames(competition);
        List<String> materialPaths = resolveMaterialPaths(competition);

        response.setMaterialsFileNames(materialNames);
        response.setMaterialsFilePaths(materialPaths);
        response.setMaterialsFileName(materialNames.isEmpty() ? null : materialNames.get(0));
        response.setMaterialsFilePath(materialPaths.isEmpty() ? null : materialPaths.get(0));

        int registeredCount = 0;
        if ("TEAM".equalsIgnoreCase(competition.getParticipationType())) {
            List<CompetitionRegistration> registrations = competitionRegistrationRepository
                    .findByCompetitionIdAndStatus(competition.getCompetitionId(), RegistrationStatus.REGISTERED);
            if (registrations != null && !registrations.isEmpty()) {
                List<String> teamIds = registrations.stream()
                        .filter(CompetitionRegistration::isTeamRegistration)
                        .map(CompetitionRegistration::getTeamId)
                        .filter(id -> id != null && !id.isBlank())
                        .distinct()
                        .toList();

                Map<String, Team> teamMap = new HashMap<>();
                if (!teamIds.isEmpty()) {
                    for (Team team : teamRepository.findAllById(teamIds)) {
                        if (team != null && team.getTeamId() != null) {
                            teamMap.put(team.getTeamId(), team);
                        }
                    }
                }

                for (CompetitionRegistration registration : registrations) {
                    if (!registration.isTeamRegistration()) {
                        registeredCount += 1;
                        continue;
                    }
                    Team team = teamMap.get(registration.getTeamId());
                    if (team != null) {
                        registeredCount += resolveAcceptedMemberIds(team).size();
                    }
                }
            }
        } else {
            registeredCount = (int) competitionRegistrationRepository
                    .countByCompetitionIdAndStatus(competition.getCompetitionId(), RegistrationStatus.REGISTERED);
        }
        response.setRegisteredParticipants(registeredCount);

        // Actual submissions count
        int submissionCount = (int) submissionRepository.countByCompetitionId(competition.getCompetitionId());
        response.setSubmissions(submissionCount);
        return response;
    }

    private LocalDateTime resolveRegistrationClose(Competition competition) {
        if (competition.getRegistrationClose() != null) {
            return competition.getRegistrationClose();
        }
        return competition.getRegistrationDeadline();
    }

    private Integer resolveTotalMarks(Competition competition) {
        if (competition == null) {
            return null;
        }
        if ("QUIZ".equalsIgnoreCase(competition.getFormat())) {
            return resolveQuizTotalMarks(competition.getCompetitionId());
        }
        return competition.getTotalMarks();
    }

    private Integer resolveQuizTotalMarks(String competitionId) {
        if (competitionId == null || competitionId.isBlank()) {
            return 0;
        }
        return questionRepository.findByCompetitionId(competitionId)
                .stream()
                .map(question -> question.getMarks() == null ? 0 : question.getMarks())
                .reduce(0, Integer::sum);
    }

    private void assertInternalCompetitionEditable(Competition competition) {
        if (competition == null || !"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            return;
        }
        LocalDateTime registrationClose = resolveRegistrationClose(competition);
        if (registrationClose == null) {
            return;
        }
        if (!LocalDateTime.now().isBefore(registrationClose)) {
            throw new IllegalStateException("Competition cannot be edited after registration closes");
        }
    }

    private void assertInternalCompetitionPublishable(Competition competition) {
        if (competition == null || !"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            return;
        }
        LocalDateTime registrationClose = resolveRegistrationClose(competition);
        if (registrationClose == null) {
            return;
        }
        if (!LocalDateTime.now().isBefore(registrationClose)) {
            throw new IllegalStateException("Competition cannot be published after registration closes");
        }
    }

    private void assertInternalCompetitionDeletable(Competition competition) {
        if (competition == null || !"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            return;
        }
        LocalDateTime submissionDeadline = competition.getSubmissionDeadline();
        if (submissionDeadline == null) {
            throw new IllegalStateException("Competition cannot be deleted because submission deadline is missing");
        }
        if (LocalDateTime.now().isBefore(submissionDeadline)) {
            throw new IllegalStateException("Competition can only be deleted after submission deadline");
        }
    }

    private void assertExternalCompetitionUpdateAllowed(
            Competition competition,
            CreateCompetitionRequest request,
            MultipartFile[] materials) {
        if (competition == null || !"EXTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            return;
        }
        if (!hasReachedExternalEndDate(competition)) {
            return;
        }
        if (hasMaterialChanges(request, materials)) {
            throw new IllegalStateException(
                    "Competition cannot be edited on or after end date. Only proofDeadline can be changed.");
        }
        if (hasExternalMetadataChanges(competition, request)) {
            throw new IllegalStateException(
                    "Competition cannot be edited on or after end date. Only proofDeadline can be changed.");
        }
    }

    private boolean hasReachedExternalEndDate(Competition competition) {
        if (competition == null || competition.getEndDate() == null) {
            return false;
        }
        LocalDate endDate = competition.getEndDate().toLocalDate();
        return !LocalDate.now().isBefore(endDate);
    }

    private boolean hasMaterialChanges(CreateCompetitionRequest request, MultipartFile[] materials) {
        if (request != null) {
            if (request.isDeleteMaterials()) {
                return true;
            }
            if (request.getKeepMaterialPaths() != null) {
                return true;
            }
        }
        if (materials == null) {
            return false;
        }
        for (MultipartFile material : materials) {
            if (material != null && !material.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private boolean hasExternalMetadataChanges(Competition competition, CreateCompetitionRequest request) {
        if (request == null) {
            return true;
        }
        if (!Objects.equals(trimToNull(request.getTitle()), trimToNull(competition.getTitle()))) {
            return true;
        }
        if (!Objects.equals(trimToNull(request.getDescription()), trimToNull(competition.getDescription()))) {
            return true;
        }
        if (!Objects.equals(upperOrNull(request.getFormat()), upperOrNull(competition.getFormat()))) {
            return true;
        }
        if (!Objects.equals(upperOrNull(request.getParticipationType()),
                upperOrNull(competition.getParticipationType()))) {
            return true;
        }
        if (!Objects.equals(request.getRegistrationOpen(), competition.getRegistrationOpen())) {
            return true;
        }
        LocalDateTime requestRegistrationClose = request.getRegistrationClose() != null
                ? request.getRegistrationClose()
                : request.getRegistrationDeadline();
        if (!Objects.equals(requestRegistrationClose, resolveRegistrationClose(competition))) {
            return true;
        }
        if (!Objects.equals(request.getStartDate(), competition.getStartDate())) {
            return true;
        }
        if (!Objects.equals(request.getEndDate(), competition.getEndDate())) {
            return true;
        }
        if (!Objects.equals(trimToNull(request.getOrganizer()), trimToNull(competition.getOrganizer()))) {
            return true;
        }
        if (!Objects.equals(trimToNull(resolveWebsiteLink(request)), trimToNull(competition.getWebsiteLink()))) {
            return true;
        }
        if (!Objects.equals(trimToNull(request.getLocation()), trimToNull(competition.getLocation()))) {
            return true;
        }
        if (!Objects.equals(trimToNull(request.getEligibility()), trimToNull(competition.getEligibility()))) {
            return true;
        }
        if (!Objects.equals(upperOrNull(request.getMode()), upperOrNull(competition.getMode()))) {
            return true;
        }
        if (!Objects.equals(upperOrNull(request.getScale()), upperOrNull(competition.getScale()))) {
            return true;
        }
        if (!Objects.equals(upperOrNull(request.getCategory()), upperOrNull(competition.getCategory()))) {
            return true;
        }
        if (!Objects.equals(trimToNull(request.getCustomCategory()), trimToNull(competition.getCustomCategory()))) {
            return true;
        }
        return false;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private LocalDateTime resolveSortTimestamp(Competition competition) {
        if (competition == null) {
            return LocalDateTime.MIN;
        }
        if (competition.getCreatedAt() != null) {
            return competition.getCreatedAt();
        }
        if (competition.getPublishDate() != null) {
            return competition.getPublishDate();
        }
        if (competition.getStartDate() != null) {
            return competition.getStartDate();
        }
        return LocalDateTime.MIN;
    }

    private String resolveCreatorName(String creatorId) {
        if (creatorId == null || creatorId.isBlank()) {
            return null;
        }
        return userRepository.findById(creatorId)
                .map(user -> {
                    if (user.getFullName() != null && !user.getFullName().isBlank()) {
                        return user.getFullName();
                    }
                    return user.getUsername();
                })
                .orElse(null);
    }

    private List<String> resolveMaterialNames(Competition competition) {
        List<String> names = new ArrayList<>();
        if (competition.getMaterialsFileNames() != null) {
            names.addAll(competition.getMaterialsFileNames().stream()
                    .filter(v -> v != null && !v.isBlank())
                    .toList());
        }
        if (names.isEmpty() && competition.getMaterialsFileName() != null
                && !competition.getMaterialsFileName().isBlank()) {
            names.add(competition.getMaterialsFileName());
        }
        return names;
    }

    private List<String> resolveMaterialPaths(Competition competition) {
        List<String> paths = new ArrayList<>();
        if (competition.getMaterialsFilePaths() != null) {
            paths.addAll(competition.getMaterialsFilePaths().stream()
                    .filter(v -> v != null && !v.isBlank())
                    .toList());
        }
        if (paths.isEmpty() && competition.getMaterialsFilePath() != null
                && !competition.getMaterialsFilePath().isBlank()) {
            paths.add(competition.getMaterialsFilePath());
        }
        return paths;
    }

    private void notifyStudentsAboutCompetitionPublished(Competition competition) {
        if (competition == null || competition.getCompetitionId() == null) {
            return;
        }

        List<User> students = userRepository.findByRoles(Role.ROLE_STUDENT);
        if (students == null || students.isEmpty()) {
            return;
        }

        String title = "Competition Published";
        String typeLabel = "EXTERNAL".equalsIgnoreCase(competition.getCompetitionType()) ? "external" : "internal";
        String message = "A " + typeLabel + " competition has been published: " + competition.getTitle();

        for (User student : students) {
            notificationService.createNotification(
                    student.getId(),
                    title,
                    message,
                    NotificationType.COMPETITION_CREATED,
                    competition.getCompetitionId());
        }
    }

    private void notifyStudentsAboutCompetitionUpdated(Competition competition) {
        if (competition == null || competition.getCompetitionId() == null) {
            return;
        }

        List<User> students = userRepository.findByRoles(Role.ROLE_STUDENT);
        if (students == null || students.isEmpty()) {
            return;
        }

        String typeLabel = "EXTERNAL".equalsIgnoreCase(competition.getCompetitionType()) ? "external" : "internal";
        String title = "Competition Updated";
        String message = "A " + typeLabel + " competition has been updated: " + competition.getTitle();

        for (User student : students) {
            notificationService.createNotification(
                    student.getId(),
                    title,
                    message,
                    NotificationType.COMPETITION_UPDATED,
                    competition.getCompetitionId());
        }
    }

    private void notifyStudentsAboutCompetitionDeleted(Competition competition) {
        if (competition == null || competition.getCompetitionId() == null) {
            return;
        }

        Set<String> registeredStudentIds = resolveRegisteredStudentIds(competition.getCompetitionId());
        if (registeredStudentIds.isEmpty()) {
            return;
        }

        String title = "Competition Deleted";
        String message = "A competition you registered for has been deleted: " + competition.getTitle();
        for (String studentId : registeredStudentIds) {
            notificationService.createNotification(
                    studentId,
                    title,
                    message,
                    NotificationType.COMPETITION_UPDATED,
                    competition.getCompetitionId());
        }
    }

    private Set<String> resolveRegisteredStudentIds(String competitionId) {
        Set<String> out = new HashSet<>();
        if (competitionId == null || competitionId.isBlank()) {
            return out;
        }

        List<CompetitionRegistration> registrations = competitionRegistrationRepository
                .findByCompetitionIdAndStatus(competitionId, RegistrationStatus.REGISTERED);
        if (registrations == null || registrations.isEmpty()) {
            return out;
        }

        List<String> teamIds = registrations.stream()
                .filter(CompetitionRegistration::isTeamRegistration)
                .map(CompetitionRegistration::getTeamId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        Map<String, Team> teamMap = new HashMap<>();
        if (!teamIds.isEmpty()) {
            for (Team team : teamRepository.findAllById(teamIds)) {
                if (team != null && team.getTeamId() != null) {
                    teamMap.put(team.getTeamId(), team);
                }
            }
        }

        for (CompetitionRegistration registration : registrations) {
            if (!registration.isTeamRegistration()) {
                if (registration.getStudentId() != null && !registration.getStudentId().isBlank()) {
                    out.add(registration.getStudentId());
                }
                continue;
            }

            if (registration.getTeamId() == null || registration.getTeamId().isBlank()) {
                continue;
            }
            Team team = teamMap.get(registration.getTeamId());
            if (team == null) {
                continue;
            }
            out.addAll(resolveAcceptedMemberIds(team));
        }

        return out;
    }

    private List<String> resolveAcceptedMemberIds(Team team) {
        List<String> memberIds = new ArrayList<>();
        if (team.getAcceptedMemberIds() != null) {
            memberIds.addAll(team.getAcceptedMemberIds());
        }
        if (team.getLeaderId() != null && !team.getLeaderId().isBlank()) {
            memberIds.add(team.getLeaderId());
        }
        return memberIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
    }

    private String upperOrNull(String value) {
        if (value == null) {
            return null;
        }
        return value.toUpperCase(Locale.ROOT);
    }

    private record MaterialFile(String fileName, String filePath) {
    }
}
