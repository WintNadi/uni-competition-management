package com.project.Backend.CompetitionRegistration;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.CompetitionRegistration.RequestDTO.CompetitionRegistrationRequestDTO;
import com.project.Backend.CompetitionRegistration.ResponseDTO.CompetitionRegistrationResponseDTO;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Notification.NotificationType;
import com.project.Backend.Team.Team;
import com.project.Backend.Team.TeamRepository;
import com.project.Backend.User.ResponseDTO.MessageResponse;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/competitions")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class CompetitionRegistrationController {

    private final CompetitionRegistrationService registrationService;
    private final CompetitionRegistrationRepository registrationRepository;
    private final TeamRepository teamRepository;
    private final CompetitionRepository competitionRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @GetMapping("/registrations/me")
    public ResponseEntity<?> myRegistrations() {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }

        List<CompetitionRegistration> out = new ArrayList<>();
        out.addAll(registrationRepository.findByStudentIdAndStatus(studentId, RegistrationStatus.REGISTERED));

        List<String> teamIds = teamRepository
                .findByLeaderIdOrAcceptedMemberIdsContaining(studentId, studentId)
                .stream()
                .map(Team::getTeamId)
                .toList();

        if (!teamIds.isEmpty()) {
            out.addAll(registrationRepository.findByTeamIdInAndStatus(teamIds, RegistrationStatus.REGISTERED));
        }

        List<CompetitionRegistrationResponseDTO> resp = out.stream()
                .sorted(Comparator
                        .comparing(CompetitionRegistration::getRegisteredAt,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(reg -> reg.getId() == null ? "" : reg.getId()))
                .map(reg -> {
                    User user = null;
                    if (reg.getStudentId() != null) {
                        user = userRepository.findById(reg.getStudentId()).orElse(null);
                    }
                    return CompetitionRegistrationMapper.toResponse(reg, user);
                })
                .toList();

        notifySubmissionOpenForRegisteredCompetitions(studentId, resp);

        return ResponseEntity.ok(resp);
    }

    @PostMapping("/{competitionId}/registrations")
    public ResponseEntity<?> register(
            @PathVariable String competitionId,
            @RequestBody CompetitionRegistrationRequestDTO request) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        if (request == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Request body is required"));
        }
        // enforce competitionId from path
        CompetitionRegistrationRequestDTO dto = new CompetitionRegistrationRequestDTO(
                competitionId,
                request.teamId());

        try {
            CompetitionRegistrationResponseDTO response = registrationService.register(dto, studentId);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/{competitionId}/registrations")
    public ResponseEntity<?> getRegisteredStudentsForAdmin(
            @PathVariable String competitionId) {

        try {
            return ResponseEntity.ok(
                    registrationService.getRegisteredStudents(competitionId));
        } catch (Exception ex) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse(ex.getMessage()));
        }
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl principal) {
            return principal.getId();
        }
        return null;
    }

    private void notifySubmissionOpenForRegisteredCompetitions(
            String studentId,
            List<CompetitionRegistrationResponseDTO> registrations) {
        if (studentId == null || registrations == null || registrations.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Set<String> competitionIds = new HashSet<>(registrations.stream()
                .map(CompetitionRegistrationResponseDTO::competitionId)
                .filter(id -> id != null && !id.isBlank())
                .toList());

        for (String competitionId : competitionIds) {
            Competition competition = competitionRepository.findById(competitionId).orElse(null);
            if (competition == null || !"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
                continue;
            }

            LocalDateTime openAt = competition.getRegistrationClose() != null
                    ? competition.getRegistrationClose()
                    : competition.getRegistrationDeadline();
            LocalDateTime submissionDeadline = competition.getSubmissionDeadline();

            boolean isSubmissionOpen = (openAt == null || !now.isBefore(openAt))
                    && (submissionDeadline == null || !now.isAfter(submissionDeadline));
            if (!isSubmissionOpen) {
                continue;
            }

            notificationService.createNotificationIfAbsent(
                    studentId,
                    "Submission Open",
                    "Submission is now open for: " + competition.getTitle(),
                    NotificationType.SUBMISSION_OPEN,
                    competition.getCompetitionId());
        }
    }
}
