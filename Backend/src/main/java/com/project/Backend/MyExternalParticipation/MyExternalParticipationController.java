package com.project.Backend.MyExternalParticipation;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.multipart.MultipartFile;

import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import com.project.Backend.Achievement.RecognitionService;
import com.project.Backend.Auth.JwtUtils;
import com.project.Backend.Auth.Role;
import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Notification.NotificationType;
import com.project.Backend.User.ResponseDTO.MessageResponse;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import jakarta.servlet.http.HttpServletRequest;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/external/participations")
public class MyExternalParticipationController {
    @Autowired
    private MyExternalParticipationRepository repository;
    @Autowired
    private JwtUtils jwtUtils;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private CompetitionRepository competitionRepository;
    @Autowired
    private RecognitionService recognitionService;

    @Autowired
    private GridFsTemplate gridFsTemplate;

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        try {
            Object principalObj = auth.getPrincipal();
            if (principalObj instanceof UserDetailsImpl principal) {
                return principal.getId();
            }
        } catch (Exception ignored) {
        }
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest req = attrs.getRequest();
                String header = req.getHeader("Authorization");
                if (header != null && header.startsWith("Bearer ")) {
                    String token = header.substring(7);
                    if (jwtUtils.validateJwtToken(token)) {
                        String subject = jwtUtils.getUserNameFromJwtToken(token);
                        Optional<User> userOpt = userRepository.findByUsername(subject);
                        if (userOpt.isEmpty()) {
                            userOpt = userRepository.findByEmail(subject);
                        }
                        if (userOpt.isPresent()) {
                            return userOpt.get().getId();
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    @GetMapping
    @PreAuthorize("hasRole('STUDENT') or hasRole('ADMIN')")
    public List<MyExternalParticipation> listMine() {
        String uid = currentUserId();
        if (uid == null)
            return List.of();
        return repository.findByOwnerIdOrderBySubmittedAtDesc(uid);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('STUDENT') or hasRole('ADMIN')")
    public ResponseEntity<?> getOne(@PathVariable String id) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        String uid = currentUserId();
        if (uid == null) {
            return ResponseEntity.status(401).body(new MessageResponse("Unauthorized"));
        }
        boolean isAdmin = userRepository.findById(uid)
                .map(user -> user.getRoles() != null && user.getRoles().contains(Role.ROLE_ADMIN))
                .orElse(false);
        if (!isAdmin && !ep.getOwnerId().equals(uid))
            return ResponseEntity.status(403).build();
        return ResponseEntity.ok(ep);
    }

    @PostMapping
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> create(@RequestBody MyExternalParticipation body) {
        String uid = currentUserId();
        if (uid == null)
            return ResponseEntity.status(401).body(new MessageResponse("Unauthorized"));
        String competitionId = body.getCompetitionId() != null ? body.getCompetitionId().trim() : null;
        Competition externalCompetition = null;
        MyExternalParticipation existingForCompetition = null;
        if (competitionId != null && !competitionId.isBlank()) {
            externalCompetition = competitionRepository.findById(competitionId).orElse(null);
            if (externalCompetition == null || !"EXTERNAL".equalsIgnoreCase(externalCompetition.getCompetitionType())) {
                return ResponseEntity.badRequest().body(new MessageResponse("External competition not found"));
            }
            if (externalCompetition.getProofDeadline() == null) {
                return ResponseEntity.badRequest()
                        .body(new MessageResponse("Proof submission is not opened by admin yet"));
            }
            LocalDate submissionStartDate = externalCompetition.getEndDate() != null
                    ? externalCompetition.getEndDate().toLocalDate()
                    : null;
            ResponseEntity<?> submissionStartValidation = validateSubmissionStartDate(submissionStartDate);
            if (submissionStartValidation != null) {
                return submissionStartValidation;
            }
            if (LocalDateTime.now().isAfter(externalCompetition.getProofDeadline())) {
                return ResponseEntity.badRequest().body(new MessageResponse("Proof submission deadline has passed"));
            }
            existingForCompetition = repository.findByOwnerIdAndCompetitionId(uid, competitionId).orElse(null);
            if (existingForCompetition != null
                    && (existingForCompetition.getStatus() == null
                            || !"rejected".equalsIgnoreCase(existingForCompetition.getStatus()))) {
                return ResponseEntity.badRequest()
                        .body(new MessageResponse("Proof has already been submitted for this competition"));
            }
        }

        if (existingForCompetition != null) {
            existingForCompetition.setCompetitionId(competitionId);
            existingForCompetition
                    .setTitle(externalCompetition != null ? externalCompetition.getTitle() : body.getTitle());
            existingForCompetition
                    .setCategory(externalCompetition != null ? externalCompetition.getCategory() : body.getCategory());
            existingForCompetition
                    .setOrganizer(
                            externalCompetition != null ? externalCompetition.getOrganizer() : body.getOrganizer());
            existingForCompetition
                    .setMode(externalCompetition != null ? externalCompetition.getMode() : body.getMode());
            existingForCompetition
                    .setLocation(externalCompetition != null ? externalCompetition.getLocation() : body.getLocation());
            existingForCompetition
                    .setScale(externalCompetition != null ? externalCompetition.getScale() : body.getScale());
            existingForCompetition.setDescription(body.getDescription());
            existingForCompetition.setEligibility(
                    externalCompetition != null ? externalCompetition.getEligibility() : body.getEligibility());
            existingForCompetition.setParticipationType(body.getParticipationType());
            existingForCompetition.setTeamSizeMin(body.getTeamSizeMin());
            existingForCompetition.setTeamSizeMax(body.getTeamSizeMax());
            existingForCompetition.setWebsiteLink(
                    externalCompetition != null ? externalCompetition.getWebsiteLink() : body.getWebsiteLink());
            existingForCompetition
                    .setStartDate(externalCompetition != null && externalCompetition.getStartDate() != null
                            ? externalCompetition.getStartDate().toLocalDate()
                            : parseDate(body.getStartDate()));
            existingForCompetition.setEndDate(externalCompetition != null && externalCompetition.getEndDate() != null
                    ? externalCompetition.getEndDate().toLocalDate()
                    : parseDate(body.getEndDate()));
            existingForCompetition.setProofFiles(new ArrayList<>());
            existingForCompetition.setSubmissionNotes(body.getSubmissionNotes());
            existingForCompetition.setSourceConfirmation(body.getSourceConfirmation());
            existingForCompetition.setDeclarationConfirmed(body.getDeclarationConfirmed());
            existingForCompetition.setParticipationResult(body.getParticipationResult());
            existingForCompetition.setSource("admin_created");
            existingForCompetition.setStatus("pending");
            existingForCompetition.setAdminNote(null);
            existingForCompetition.setSubmittedAt(LocalDate.now());
            existingForCompetition.setUpdatedAt(LocalDateTime.now());
            MyExternalParticipation savedResubmission = repository.save(existingForCompetition);
            notifyAdmins(savedResubmission, "Resubmitted");
            return ResponseEntity.ok(savedResubmission);
        }

        // detect if student's announcement matches an existing admin-created external
        // competition
        Competition matchedAdmin = null;
        if (externalCompetition == null) {
            matchedAdmin = findMatchingAdminCompetition(body);
            if (matchedAdmin != null) {
                return ResponseEntity.status(409)
                        .body(new ExistingAdminCompetitionResponse(
                                "A matching admin-created external competition already exists. Please use the admin competition instead of creating a duplicate.",
                                matchedAdmin.getCompetitionId(),
                                matchedAdmin.getTitle()));
            }
        }

        MyExternalParticipation ep = new MyExternalParticipation();
        ep.setOwnerId(uid);
        ep.setCompetitionId(competitionId);
        ep.setTitle(externalCompetition != null ? externalCompetition.getTitle() : body.getTitle());
        ep.setCategory(externalCompetition != null ? externalCompetition.getCategory() : body.getCategory());
        ep.setOrganizer(externalCompetition != null ? externalCompetition.getOrganizer() : body.getOrganizer());
        ep.setMode(externalCompetition != null ? externalCompetition.getMode() : body.getMode());
        ep.setLocation(externalCompetition != null ? externalCompetition.getLocation() : body.getLocation());
        ep.setScale(externalCompetition != null ? externalCompetition.getScale() : body.getScale());
        ep.setDescription(body.getDescription());
        ep.setEligibility(externalCompetition != null ? externalCompetition.getEligibility() : body.getEligibility());
        ep.setParticipationType(body.getParticipationType());
        ep.setTeamSizeMin(body.getTeamSizeMin());
        ep.setTeamSizeMax(body.getTeamSizeMax());
        ep.setWebsiteLink(externalCompetition != null ? externalCompetition.getWebsiteLink() : body.getWebsiteLink());
        ep.setStartDate(externalCompetition != null && externalCompetition.getStartDate() != null
                ? externalCompetition.getStartDate().toLocalDate()
                : parseDate(body.getStartDate()));
        ep.setEndDate(externalCompetition != null && externalCompetition.getEndDate() != null
                ? externalCompetition.getEndDate().toLocalDate()
                : parseDate(body.getEndDate()));
        List<String> initialProofs = body.getProofFiles() != null ? new ArrayList<>(body.getProofFiles())
                : new ArrayList<>();
        ep.setProofFiles(initialProofs);
        ep.setSubmissionNotes(body.getSubmissionNotes());
        ep.setSourceConfirmation(body.getSourceConfirmation());
        ep.setDeclarationConfirmed(body.getDeclarationConfirmed());
        ep.setParticipationResult(body.getParticipationResult());
        ep.setSource(externalCompetition != null ? "admin_created" : "student_created");
        ep.setDuplicateWithAdmin(false);
        ep.setMatchedAdminCompetitionId(null);
        ep.setStatus("pending");
        ep.setSubmittedAt(LocalDate.now());
        ep.setCreatedAt(LocalDateTime.now());
        ep.setUpdatedAt(LocalDateTime.now());
        MyExternalParticipation saved = repository.save(ep);
        notifyAdmins(saved, "Submitted");
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody MyExternalParticipation body) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        String uid = currentUserId();
        if (uid == null)
            return ResponseEntity.status(401).body(new MessageResponse("Unauthorized"));
        if (!ep.getOwnerId().equals(uid))
            return ResponseEntity.status(403).build();
        if (ep.getCompetitionId() != null && !ep.getCompetitionId().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse(
                            "Proof for admin-created external competitions can only be submitted once"));
        }
        ep.setTitle(body.getTitle());
        ep.setCategory(body.getCategory());
        ep.setOrganizer(body.getOrganizer());
        ep.setMode(body.getMode());
        ep.setLocation(body.getLocation());
        ep.setScale(body.getScale());
        ep.setDescription(body.getDescription());
        ep.setEligibility(body.getEligibility());
        ep.setParticipationType(body.getParticipationType());
        ep.setTeamSizeMin(body.getTeamSizeMin());
        ep.setTeamSizeMax(body.getTeamSizeMax());
        ep.setWebsiteLink(body.getWebsiteLink());
        ep.setStartDate(parseDate(body.getStartDate()));
        ep.setEndDate(parseDate(body.getEndDate()));
        ep.setSubmissionNotes(body.getSubmissionNotes());
        ep.setSourceConfirmation(body.getSourceConfirmation());
        ep.setDeclarationConfirmed(body.getDeclarationConfirmed());
        ep.setParticipationResult(body.getParticipationResult());
        ep.setSource("student_created");
        // re-run duplicate detection on updates
        Competition matched = findMatchingAdminCompetition(body);
        if (matched != null) {
            return ResponseEntity.status(409)
                    .body(new ExistingAdminCompetitionResponse(
                            "A matching admin-created external competition already exists. Please use the admin competition instead of creating a duplicate.",
                            matched.getCompetitionId(),
                            matched.getTitle()));
        }
        ep.setDuplicateWithAdmin(false);
        ep.setMatchedAdminCompetitionId(null);
        String currentStatus = ep.getStatus() == null ? "" : ep.getStatus().trim().toLowerCase();
        if ("confirmed".equals(currentStatus)) {
            // Editing confirmed draft should not re-submit to admin automatically.
            ep.setStatus("confirmed");
            ep.setUpdatedAt(LocalDateTime.now());
            MyExternalParticipation savedDraft = repository.save(ep);
            return ResponseEntity.ok(savedDraft);
        }
        ep.setStatus("pending");
        ep.setSubmittedAt(LocalDate.now());
        ep.setAdminNote(null);
        ep.setUpdatedAt(LocalDateTime.now());
        MyExternalParticipation saved = repository.save(ep);
        notifyAdmins(saved, "Resubmitted");
        return ResponseEntity.ok(saved);
    }

    public static class ResultUpdate {
        public String participationResult;
    }

    @PatchMapping("/{id}/result")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> updateResult(@PathVariable String id, @RequestBody ResultUpdate body) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        String uid = currentUserId();
        if (uid == null)
            return ResponseEntity.status(401).body(new MessageResponse("Unauthorized"));
        if (!ep.getOwnerId().equals(uid))
            return ResponseEntity.status(403).build();
        if (body == null || body.participationResult == null || body.participationResult.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("participationResult is required"));
        }
        if (ep.getSource() != null && "student_created".equalsIgnoreCase(ep.getSource())
                && !"confirmed".equalsIgnoreCase(ep.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Admin confirmation is required before updating the result"));
        }
        Competition linkedCompetition = null;
        if (ep.getCompetitionId() != null && !ep.getCompetitionId().isBlank()) {
            linkedCompetition = competitionRepository.findById(ep.getCompetitionId()).orElse(null);
        }
        LocalDate submissionStartDate = resolveSubmissionStartDate(ep, linkedCompetition);
        ResponseEntity<?> submissionStartValidation = validateSubmissionStartDate(submissionStartDate);
        if (submissionStartValidation != null) {
            return submissionStartValidation;
        }
        LocalDateTime deadline = ep.getProofDeadline();
        if (deadline == null && linkedCompetition != null) {
            deadline = linkedCompetition.getProofDeadline();
        }
        if (deadline == null) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Proof submission is not opened by admin yet"));
        }
        if (LocalDateTime.now().isAfter(deadline)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Proof submission deadline has passed"));
        }
        ep.setParticipationResult(body.participationResult.trim());
        ep.setUpdatedAt(LocalDateTime.now());
        repository.save(ep);
        return ResponseEntity.ok(new MessageResponse("result_updated"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> deleteMine(@PathVariable String id) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        String uid = currentUserId();
        if (uid == null)
            return ResponseEntity.status(401).body(new MessageResponse("Unauthorized"));
        if (!ep.getOwnerId().equals(uid))
            return ResponseEntity.status(403).build();
        if (ep.getSource() == null || !"student_created".equalsIgnoreCase(ep.getSource())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Only student-created competitions can be deleted"));
        }
        if (ep.getStatus() == null || !"rejected".equalsIgnoreCase(ep.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Can delete only after admin rejection"));
        }
        repository.deleteById(id);
        return ResponseEntity.ok(new MessageResponse("deleted"));
    }

    @PostMapping("/{id}/proof")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> uploadProof(@PathVariable String id, @RequestParam("file") MultipartFile file) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        if (!ep.getOwnerId().equals(currentUserId()))
            return ResponseEntity.status(403).build();
        if (ep.getSource() != null && "student_created".equalsIgnoreCase(ep.getSource())
                && !"confirmed".equalsIgnoreCase(ep.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Admin confirmation is required before uploading proof"));
        }
        java.time.LocalDateTime deadline = null;
        Competition linkedCompetition = null;
        if (ep.getCompetitionId() != null && !ep.getCompetitionId().isBlank()) {
            linkedCompetition = competitionRepository.findById(ep.getCompetitionId()).orElse(null);
            if (linkedCompetition != null) {
                deadline = linkedCompetition.getProofDeadline();
            }
        }
        LocalDate submissionStartDate = resolveSubmissionStartDate(ep, linkedCompetition);
        ResponseEntity<?> submissionStartValidation = validateSubmissionStartDate(submissionStartDate);
        if (submissionStartValidation != null) {
            return submissionStartValidation;
        }
        if (deadline == null && ep.getProofDeadline() != null) {
            deadline = ep.getProofDeadline();
        }
        if (deadline == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Proof submission is not opened by admin yet"));
        }
        if (LocalDateTime.now().isAfter(deadline)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Proof submission deadline has passed"));
        }
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Empty file"));
        }
        try {
            DBObject metaData = new BasicDBObject();
            metaData.put("type", "proof");
            metaData.put("participationId", id);
            metaData.put("contentType", file.getContentType());

            String filename = "proof_" + UUID.randomUUID() + "_" + file.getOriginalFilename();
            ObjectId fileId = gridFsTemplate.store(file.getInputStream(), filename, file.getContentType(), metaData);

            String originalName = file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                    ? file.getOriginalFilename().trim()
                    : filename;
            String encodedOriginalName = sanitizePathSegment(originalName);
            String url = "/api/files/" + fileId.toString() + "/" + encodedOriginalName;
            List<String> proofs = ep.getProofFiles();
            proofs = proofs != null ? new ArrayList<>(proofs) : new ArrayList<>();
            proofs.add(url);
            ep.setProofFiles(proofs);
            repository.save(ep);
            return ResponseEntity.ok(new MessageResponse(url));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new MessageResponse("Error: Upload failed"));
        }
    }

    @DeleteMapping("/{id}/proof")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> deleteProof(@PathVariable String id, @RequestParam("file") String fileUrl) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        if (!ep.getOwnerId().equals(currentUserId()))
            return ResponseEntity.status(403).build();
        if (ep.getSource() != null && "student_created".equalsIgnoreCase(ep.getSource())
                && !"confirmed".equalsIgnoreCase(ep.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Proof can only be edited while waiting for submission"));
        }
        java.time.LocalDateTime deadline = null;
        if (ep.getCompetitionId() != null && !ep.getCompetitionId().isBlank()) {
            Competition competition = competitionRepository.findById(ep.getCompetitionId()).orElse(null);
            if (competition != null) {
                deadline = competition.getProofDeadline();
            }
        }
        if (deadline == null && ep.getProofDeadline() != null) {
            deadline = ep.getProofDeadline();
        }
        if (deadline != null && LocalDateTime.now().isAfter(deadline)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Proof deadline has passed; edits are closed"));
        }
        List<String> proofs = ep.getProofFiles() != null ? new ArrayList<>(ep.getProofFiles()) : new ArrayList<>();
        if (fileUrl == null || fileUrl.isBlank() || !proofs.contains(fileUrl)) {
            return ResponseEntity.badRequest().body(new MessageResponse("File not found in submission"));
        }
        String[] parts = fileUrl.split("/");
        String fileIdStr = null;
        for (int i = 0; i < parts.length - 1; i++) {
            if ("files".equals(parts[i]) && i + 1 < parts.length) {
                fileIdStr = parts[i + 1];
                break;
            }
        }
        try {
            if (fileIdStr != null && ObjectId.isValid(fileIdStr)) {
                ObjectId objectId = new ObjectId(fileIdStr);
                gridFsTemplate.delete(new Query(Criteria.where("_id").is(objectId)));
            }
        } catch (Exception ignored) {
        }
        proofs.remove(fileUrl);
        ep.setProofFiles(proofs);
        ep.setUpdatedAt(LocalDateTime.now());
        repository.save(ep);
        return ResponseEntity.ok(new MessageResponse("removed"));
    }

    private LocalDate parseDate(LocalDate d) {
        return d;
    }

    private LocalDate resolveSubmissionStartDate(MyExternalParticipation participation, Competition linkedCompetition) {
        if (linkedCompetition != null && linkedCompetition.getEndDate() != null) {
            return linkedCompetition.getEndDate().toLocalDate();
        }
        if (participation == null) {
            return null;
        }
        return participation.getEndDate();
    }

    private ResponseEntity<?> validateSubmissionStartDate(LocalDate submissionStartDate) {
        if (submissionStartDate != null && LocalDate.now().isBefore(submissionStartDate)) {
            return ResponseEntity.badRequest().body(
                    new MessageResponse("Proof submission opens on the competition end date (" + submissionStartDate
                            + ")"));
        }
        return null;
    }

    /**
     * Attempt to find an admin-created external competition that matches the
     * student's announcement.
     * Exact match fields: title, location, category, organizer, startDate,
     * endDate.
     */
    private Competition findMatchingAdminCompetition(MyExternalParticipation body) {
        if (body == null)
            return null;
        String normalizedTitle = normalizeText(body.getTitle());
        String normalizedLocation = normalizeText(body.getLocation());
        String normalizedOrganizer = normalizeText(body.getOrganizer());
        String normalizedCategory = normalizeStudentCategory(body);
        LocalDate studentStartDate = body.getStartDate();
        LocalDate studentEndDate = body.getEndDate();
        if (normalizedTitle.isBlank() || normalizedLocation.isBlank() || normalizedOrganizer.isBlank()
                || normalizedCategory.isBlank() || studentStartDate == null || studentEndDate == null) {
            return null;
        }
        List<Competition> all = competitionRepository.findAll();
        for (Competition c : all) {
            if (c == null)
                continue;
            if (c.getCompetitionType() == null || !"EXTERNAL".equalsIgnoreCase(c.getCompetitionType()))
                continue;
            String compTitle = normalizeText(c.getTitle());
            String compLocation = normalizeText(c.getLocation());
            String compOrganizer = normalizeText(c.getOrganizer());
            String compCategory = normalizeCompetitionCategory(c);
            LocalDate compStartDate = c.getStartDate() != null ? c.getStartDate().toLocalDate() : null;
            LocalDate compEndDate = c.getEndDate() != null ? c.getEndDate().toLocalDate() : null;
            boolean exactMatch = compTitle.equals(normalizedTitle)
                    && compLocation.equals(normalizedLocation)
                    && compOrganizer.equals(normalizedOrganizer)
                    && compCategory.equals(normalizedCategory)
                    && compStartDate != null
                    && compEndDate != null
                    && compStartDate.equals(studentStartDate)
                    && compEndDate.equals(studentEndDate);
            if (exactMatch) {
                return c;
            }
        }
        return null;
    }

    private String normalizeCompetitionCategory(Competition competition) {
        if (competition == null) {
            return "";
        }
        String category = normalizeText(competition.getCategory());
        String customCategory = normalizeText(competition.getCustomCategory());
        if ("other".equals(category) && !customCategory.isBlank()) {
            return customCategory;
        }
        return category;
    }

    private String normalizeStudentCategory(MyExternalParticipation body) {
        if (body == null) {
            return "";
        }
        return normalizeText(body.getCategory());
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    public static class ExistingAdminCompetitionResponse {
        public String message;
        public String competitionId;
        public String title;

        public ExistingAdminCompetitionResponse(String message, String competitionId, String title) {
            this.message = message;
            this.competitionId = competitionId;
            this.title = title;
        }
    }

    private String sanitizePathSegment(String value) {
        if (value == null || value.isBlank()) {
            return "proof-file";
        }
        return URLEncoder.encode(value.trim(), StandardCharsets.UTF_8)
                .replace("+", "%20");
    }

    private void notifyAdmins(MyExternalParticipation ep, String actionLabel) {
        List<User> admins = userRepository.findByRoles(Role.ROLE_ADMIN);
        if (admins == null || admins.isEmpty())
            return;
        User owner = userRepository.findById(ep.getOwnerId()).orElse(null);
        String ownerName = owner != null && owner.getFullName() != null && !owner.getFullName().isBlank()
                ? owner.getFullName()
                : owner != null ? owner.getUsername() : "A student";
        String title = "External Participation " + actionLabel;
        String message = ownerName + " " + actionLabel.toLowerCase()
                + " an external participation: " + (ep.getTitle() != null ? ep.getTitle() : "Untitled");
        for (User admin : admins) {
            notificationService.createNotification(
                    admin.getId(),
                    title,
                    message,
                    NotificationType.EXTERNAL_PARTICIPATION_SUBMITTED,
                    ep.getId());
        }
    }

    @PatchMapping("/{id}/submit-review")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> submitForAdminReview(@PathVariable String id) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        String uid = currentUserId();
        if (uid == null)
            return ResponseEntity.status(401).body(new MessageResponse("Unauthorized"));
        if (!ep.getOwnerId().equals(uid))
            return ResponseEntity.status(403).build();
        if (ep.getSource() == null || !"student_created".equalsIgnoreCase(ep.getSource())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Only student-announced competitions use this flow"));
        }
        if (!"confirmed".equalsIgnoreCase(ep.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Admin confirmation is required before submission"));
        }
        if (ep.getProofFiles() == null || ep.getProofFiles().isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Please upload at least one proof file"));
        }
        if (ep.getParticipationResult() == null || ep.getParticipationResult().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Please select your level of achievement"));
        }
        Competition linkedCompetition = null;
        if (ep.getCompetitionId() != null && !ep.getCompetitionId().isBlank()) {
            linkedCompetition = competitionRepository.findById(ep.getCompetitionId()).orElse(null);
        }
        LocalDate submissionStartDate = resolveSubmissionStartDate(ep, linkedCompetition);
        ResponseEntity<?> submissionStartValidation = validateSubmissionStartDate(submissionStartDate);
        if (submissionStartValidation != null) {
            return submissionStartValidation;
        }
        java.time.LocalDateTime deadline = ep.getProofDeadline();
        if (deadline == null && linkedCompetition != null) {
            deadline = linkedCompetition.getProofDeadline();
        }
        if (deadline == null) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Admin confirmation and proof deadline are required before submission"));
        }
        if (deadline != null && LocalDateTime.now().isAfter(deadline)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Proof deadline has passed"));
        }
        ep.setStatus("pending");
        ep.setUpdatedAt(LocalDateTime.now());
        repository.save(ep);
        notifyAdmins(ep, "Submitted");
        return ResponseEntity.ok(new MessageResponse("submitted_for_review"));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public List<AdminApprovalItem> listForAdmin(
            @RequestParam(value = "status", required = false, defaultValue = "pending") String status,
            @RequestParam(value = "source", required = false) String source) {
        List<MyExternalParticipation> base;
        if ("all".equals(status)) {
            if (source != null && !source.isEmpty() && !"all".equals(source)) {
                base = repository.findAll().stream()
                        .filter(ep -> source.equals(ep.getSource()))
                        .sorted(adminSortComparator())
                        .toList();
            } else {
                base = repository.findAll().stream()
                        .sorted(adminSortComparator())
                        .toList();
            }
        } else {
            if (source != null && !source.isEmpty() && !"all".equals(source)) {
                base = repository.findByStatusAndSourceOrderBySubmittedAtDesc(status, source);
            } else {
                base = repository.findByStatusOrderBySubmittedAtDesc(status);
            }
            base = base.stream().sorted(adminSortComparator()).toList();
        }

        List<AdminApprovalItem> out = new ArrayList<>();
        for (MyExternalParticipation ep : base) {
            AdminApprovalItem item = new AdminApprovalItem();
            item.id = ep.getId();
            item.competitionId = ep.getCompetitionId();
            item.type = "admin_created".equalsIgnoreCase(ep.getSource()) ? "external_proof" : "student_created";
            item.source = ep.getSource() != null ? ep.getSource() : "student_created";

            var userOpt = userRepository.findById(ep.getOwnerId());
            String username = userOpt
                    .map(User::getUsername)
                    .filter(name -> name != null && !name.isBlank())
                    .orElse("Unknown");
            String email = userOpt.map(User::getEmail).orElse("");
            item.student = new StudentInfo(username, email, username);

            item.competition = ep.getTitle();
            item.category = ep.getCategory() != null ? ep.getCategory() : "other";
            item.organizer = ep.getOrganizer();
            item.mode = ep.getMode();
            item.location = ep.getLocation();
            item.scale = ep.getScale();
            item.description = ep.getDescription();
            item.eligibility = ep.getEligibility();
            item.participationType = ep.getParticipationType();
            item.teamSizeMin = ep.getTeamSizeMin();
            item.teamSizeMax = ep.getTeamSizeMax();
            item.startDate = ep.getStartDate() != null ? ep.getStartDate().toString() : null;
            item.endDate = ep.getEndDate() != null ? ep.getEndDate().toString() : null;
            item.websiteLink = ep.getWebsiteLink();

            String normalizedStatus = ep.getStatus() != null && !ep.getStatus().isBlank() ? ep.getStatus() : "pending";
            boolean hideStudentDraftSubmission = "student_created".equalsIgnoreCase(item.source)
                    && "confirmed".equalsIgnoreCase(normalizedStatus);
            item.result = hideStudentDraftSubmission ? null : ep.getParticipationResult();
            item.proofFiles = hideStudentDraftSubmission
                    ? List.of()
                    : (ep.getProofFiles() != null ? ep.getProofFiles() : List.of());

            // Set deadline info (still useful for reference)
            Competition comp = ep.getCompetitionId() != null
                    ? competitionRepository.findById(ep.getCompetitionId()).orElse(null)
                    : null;
            if (ep.getProofDeadline() != null) {
                item.proofDeadline = ep.getProofDeadline().toString();
            } else {
                item.proofDeadline = comp != null && comp.getProofDeadline() != null
                        ? comp.getProofDeadline().toString()
                        : null;
            }

            item.submissionNotes = ep.getSubmissionNotes();
            item.sourceConfirmation = ep.getSourceConfirmation();
            item.declarationConfirmed = ep.getDeclarationConfirmed();
            item.submittedAt = ep.getCreatedAt() != null
                    ? ep.getCreatedAt().toString()
                    : ep.getSubmittedAt() != null ? ep.getSubmittedAt().toString() : LocalDate.now().toString();
            item.status = normalizedStatus;
            item.notes = ep.getAdminNote();
            item.attendanceRecoveryReport = ep.getAttendanceRecoveryReport();
            item.attendanceRecoveryGeneratedAt = ep.getAttendanceRecoveryGeneratedAt() != null
                    ? ep.getAttendanceRecoveryGeneratedAt().toString()
                    : null;

            out.add(item);
        }
        return out;
    }

    private Comparator<MyExternalParticipation> adminSortComparator() {
        return Comparator
                .comparing(MyExternalParticipation::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed()
                .thenComparing(ep -> ep.getId() == null ? "" : ep.getId());
    }

    public static class AdminApprovalItem {
        public String id;
        public String competitionId;
        public String type;
        public String source;
        public StudentInfo student;
        public String competition;
        public String category;
        public String organizer;
        public String mode;
        public String location;
        public String scale;
        public String description;
        public String eligibility;
        public String participationType;
        public Integer teamSizeMin;
        public Integer teamSizeMax;
        public String startDate;
        public String endDate;
        public String websiteLink;
        public String result;
        public List<String> proofFiles;
        public String proofDeadline;

        public String submissionNotes;
        public String sourceConfirmation;
        public Boolean declarationConfirmed;
        public String submittedAt;
        public String status;
        public String notes;
        public String attendanceRecoveryReport;
        public String attendanceRecoveryGeneratedAt;
    }

    public static class StudentInfo {
        public String name;
        public String email;
        public String studentId;

        public StudentInfo(String name, String email, String studentId) {
            this.name = name;
            this.email = email;
            this.studentId = studentId;
        }
    }

    public static class AdminAction {
        public String notes;
        public String reason;
        public java.time.LocalDateTime proofDeadline;
    }

    public static class AttendanceReportAction {
        public String report;
    }

    public static class BulkAction {
        public List<String> ids;
        public String notes;
        public String reason;
    }

    @PatchMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approve(@PathVariable String id, @RequestBody(required = false) AdminAction action) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        // If admin provided a proofDeadline, validate it against the student's end date
        if (action != null && action.proofDeadline != null) {
            java.time.LocalDateTime pd = action.proofDeadline;
            if (ep.getEndDate() != null) {
                java.time.LocalDate ed = ep.getEndDate();
                if (pd.toLocalDate().isBefore(ed)) {
                    return ResponseEntity.badRequest()
                            .body(new MessageResponse("proofDeadline must be on or after the competition end date"));
                }
            }
            if (pd.isBefore(java.time.LocalDateTime.now())) {
                return ResponseEntity.badRequest().body(new MessageResponse("proofDeadline cannot be in the past"));
            }
            // set on the participation
            ep.setProofDeadline(pd);
            // also set on linked competition if present so uploads check competition
            // deadline
            if (ep.getCompetitionId() != null && !ep.getCompetitionId().isBlank()) {
                Competition c = competitionRepository.findById(ep.getCompetitionId()).orElse(null);
                if (c != null) {
                    c.setProofDeadline(pd);
                    competitionRepository.save(c);
                }
            }
        }

        boolean isStudentCreated = ep.getSource() != null && "student_created".equalsIgnoreCase(ep.getSource());
        String currentStatus = ep.getStatus() == null || ep.getStatus().isBlank() ? "pending" : ep.getStatus();
        if (isStudentCreated) {
            boolean hasProof = ep.getProofFiles() != null && !ep.getProofFiles().isEmpty();
            boolean hasResult = ep.getParticipationResult() != null && !ep.getParticipationResult().isBlank();
            if ("pending".equalsIgnoreCase(currentStatus) && !hasProof) {
                ep.setStatus("confirmed");
            } else if ("confirmed".equalsIgnoreCase(currentStatus)) {
                ep.setStatus("confirmed");
            } else if ("pending".equalsIgnoreCase(currentStatus) && hasProof) {
                if (!hasResult) {
                    return ResponseEntity.badRequest()
                            .body(new MessageResponse("participationResult is required before approval"));
                }
                ep.setStatus("approved");
            } else {
                ep.setStatus("confirmed");
            }
        } else {
            ep.setStatus("approved");
        }
        if (action != null && action.notes != null && !action.notes.isBlank()) {
            ep.setAdminNote(action.notes);
        } else if (!"rejected".equalsIgnoreCase(ep.getStatus())) {
            // Keep rejection/revision note for student-created confirmed records so student can
            // still see why resubmission is required after deadline is updated.
            boolean keepRevisionNote = isStudentCreated
                    && "confirmed".equalsIgnoreCase(ep.getStatus())
                    && ep.getAdminNote() != null
                    && !ep.getAdminNote().isBlank();
            if (!keepRevisionNote) {
                // Clear stale rejection note when record is confirmed/pending/approved again.
                ep.setAdminNote(null);
            }
        }
        ep.setUpdatedAt(LocalDateTime.now());
        repository.save(ep);
        if ("approved".equalsIgnoreCase(ep.getStatus())) {
            recognitionService.processExternalApproval(ep);
        }

        // Send notification
        boolean approved = "approved".equalsIgnoreCase(ep.getStatus());
        boolean confirmed = "confirmed".equalsIgnoreCase(ep.getStatus());
        notificationService.createNotification(
                ep.getOwnerId(),
                approved ? "Participation Approved" : confirmed ? "Participation Confirmed" : "Participation Pending",
                (approved
                        ? "Your participation in '" + ep.getTitle() + "' has been approved by the admin."
                        : confirmed
                                ? "Your announced external competition '" + ep.getTitle()
                                        + "' has been confirmed by admin. Submit your proof before the deadline."
                                : "Your participation in '" + ep.getTitle() + "' is pending review."),
                NotificationType.GENERAL,
                ep.getId());

        return ResponseEntity.ok(
                new MessageResponse(approved ? "approved" : confirmed ? "confirmed" : "pending"));
    }

    @PatchMapping("/{id}/attendance-report")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> generateAttendanceRecoveryReport(
            @PathVariable String id,
            @RequestBody(required = false) AttendanceReportAction action) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        MyExternalParticipation ep = opt.get();
        if (!"approved".equalsIgnoreCase(ep.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Attendance report can only be generated after approval"));
        }

        String defaultReport = "Attendance recovery report approved for '" + ep.getTitle()
                + "'. Submit this to your department office for attendance recovery processing.";
        String report = action != null && action.report != null && !action.report.isBlank()
                ? action.report.trim()
                : defaultReport;

        ep.setAttendanceRecoveryReport(report);
        ep.setAttendanceRecoveryGeneratedAt(LocalDateTime.now());
        ep.setUpdatedAt(LocalDateTime.now());
        repository.save(ep);

        notificationService.createNotification(
                ep.getOwnerId(),
                "Attendance Recovery Report Ready",
                "Attendance recovery report for '" + ep.getTitle() + "' is now available in your submissions.",
                NotificationType.ATTENDANCE_RECOVERY_APPROVAL,
                ep.getId());

        return ResponseEntity.ok(new MessageResponse("attendance_report_generated"));
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> reject(@PathVariable String id, @RequestBody(required = false) AdminAction action) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        boolean studentCreated = ep.getSource() != null && "student_created".equalsIgnoreCase(ep.getSource());
        String currentStatus = ep.getStatus() == null ? "" : ep.getStatus().trim().toLowerCase();
        boolean hasProof = ep.getProofFiles() != null && !ep.getProofFiles().isEmpty();
        if (studentCreated && "confirmed".equalsIgnoreCase(ep.getStatus())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Announcement already confirmed; use deadline update and wait for submission"));
        }
        String reason = action != null ? (action.reason != null ? action.reason : action.notes) : null;

        if (studentCreated && "pending".equals(currentStatus) && hasProof) {
            // Rejection for submitted proof goes back to confirmed so student can revise and submit again.
            ep.setStatus("confirmed");
            if (reason != null && !reason.isBlank()) {
                ep.setAdminNote(reason.trim());
            } else {
                ep.setAdminNote("Submission needs revision before re-submit.");
            }
            ep.setAttendanceRecoveryReport(null);
            ep.setAttendanceRecoveryGeneratedAt(null);
            ep.setUpdatedAt(LocalDateTime.now());
            repository.save(ep);
            recognitionService.rollbackExternalApproval(ep.getId());

            notificationService.createNotification(
                    ep.getOwnerId(),
                    "Submission Needs Revision",
                    "Your submission for '" + ep.getTitle()
                            + "' was returned for revision. Update description, result, and files, then submit again.",
                    NotificationType.REJECTION,
                    ep.getId());

            return ResponseEntity.ok(new MessageResponse("confirmed"));
        }

        ep.setStatus("rejected");
        if (reason != null && !reason.isBlank()) {
            ep.setAdminNote(reason.trim());
        }
        ep.setAttendanceRecoveryReport(null);
        ep.setAttendanceRecoveryGeneratedAt(null);
        ep.setUpdatedAt(LocalDateTime.now());
        repository.save(ep);
        recognitionService.rollbackExternalApproval(ep.getId());

        // Send notification
        notificationService.createNotification(
                ep.getOwnerId(),
                "Participation Rejected",
                "Your participation in '" + ep.getTitle() + "' was rejected. Reason: "
                        + (reason != null ? reason : "No reason provided."),
                NotificationType.REJECTION,
                ep.getId());

        return ResponseEntity.ok(new MessageResponse("rejected"));
    }

    @PatchMapping("/{id}/rollback")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> rollback(@PathVariable String id) {
        Optional<MyExternalParticipation> opt = repository.findById(id);
        if (opt.isEmpty())
            return ResponseEntity.notFound().build();
        MyExternalParticipation ep = opt.get();
        ep.setStatus("pending");
        ep.setAttendanceRecoveryReport(null);
        ep.setAttendanceRecoveryGeneratedAt(null);
        ep.setUpdatedAt(LocalDateTime.now());
        repository.save(ep);
        recognitionService.rollbackExternalApproval(ep.getId());

        // Send notification
        notificationService.createNotification(
                ep.getOwnerId(),
                "Participation Rollback",
                "Your participation in '" + ep.getTitle() + "' has been rolled back to pending by the admin.",
                NotificationType.ROLLBACK,
                ep.getId());

        return ResponseEntity.ok(new MessageResponse("pending"));
    }

    @PatchMapping("/bulk/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> bulkApprove(@RequestBody BulkAction action) {
        if (action == null || action.ids == null || action.ids.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: ids required"));
        }
        List<MyExternalParticipation> items = repository.findAllById(action.ids);
        for (MyExternalParticipation ep : items) {
            boolean isStudentCreated = ep.getSource() != null && "student_created".equalsIgnoreCase(ep.getSource());
            if (isStudentCreated) {
                boolean hasProof = ep.getProofFiles() != null && !ep.getProofFiles().isEmpty();
                boolean hasResult = ep.getParticipationResult() != null && !ep.getParticipationResult().isBlank();
                if (hasProof && hasResult) {
                    ep.setStatus("approved");
                } else {
                    ep.setStatus("confirmed");
                }
            } else {
                ep.setStatus("approved");
            }
            if (action.notes != null && !action.notes.isBlank()) {
                ep.setAdminNote(action.notes);
            }
            ep.setUpdatedAt(LocalDateTime.now());

            // Send notification
            notificationService.createNotification(
                    ep.getOwnerId(),
                    "approved".equalsIgnoreCase(ep.getStatus()) ? "Participation Approved (Bulk)"
                            : "Participation Confirmed (Bulk)",
                    ("approved".equalsIgnoreCase(ep.getStatus())
                            ? "Your participation in '" + ep.getTitle() + "' has been approved."
                            : "Your announced external competition '" + ep.getTitle()
                                    + "' has been confirmed by admin."),
                    NotificationType.GENERAL,
                    ep.getId());
        }
        repository.saveAll(items);
        for (MyExternalParticipation ep : items) {
            if ("approved".equalsIgnoreCase(ep.getStatus())) {
                recognitionService.processExternalApproval(ep);
            }
        }
        return ResponseEntity.ok(new MessageResponse("bulk_approved_or_confirmed"));
    }

    @PatchMapping("/bulk/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> bulkReject(@RequestBody BulkAction action) {
        if (action == null || action.ids == null || action.ids.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: ids required"));
        }
        String reason = action.reason != null ? action.reason : action.notes;
        List<MyExternalParticipation> items = repository.findAllById(action.ids);
        for (MyExternalParticipation ep : items) {
            ep.setStatus("rejected");
            if (reason != null && !reason.isBlank()) {
                ep.setAdminNote(reason);
            }
            ep.setAttendanceRecoveryReport(null);
            ep.setAttendanceRecoveryGeneratedAt(null);
            ep.setUpdatedAt(LocalDateTime.now());
            recognitionService.rollbackExternalApproval(ep.getId());

            // Send notification
            notificationService.createNotification(
                    ep.getOwnerId(),
                    "Participation Rejected (Bulk)",
                    "Your participation in '" + ep.getTitle() + "' was rejected.",
                    NotificationType.REJECTION,
                    ep.getId());
        }
        repository.saveAll(items);
        return ResponseEntity.ok(new MessageResponse("bulk_rejected"));
    }
}
