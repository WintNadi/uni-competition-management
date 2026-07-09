package com.project.Backend.Team;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.Team.RequestDTO.AcceptTeamInvitationRequestDTO;
import com.project.Backend.Team.RequestDTO.CreateTeamRequestDTO;
import com.project.Backend.Team.ResponseDTO.TeamResponseDTO;
import com.project.Backend.User.ResponseDTO.MessageResponse;

import lombok.AllArgsConstructor;

@RestController
@RequestMapping("/teams")
@PreAuthorize("hasRole('STUDENT')")
@AllArgsConstructor
public class TeamController {

    private final TeamService teamService;

    @GetMapping
    public ResponseEntity<?> listTeams(@RequestParam(value = "competitionId", required = false) String competitionId) {
        if (competitionId == null || competitionId.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("competitionId is required"));
        }
        List<TeamResponseDTO> teams = teamService.listTeamsByCompetition(competitionId);
        return ResponseEntity.ok(teams);
    }

    @GetMapping("/my")
    public ResponseEntity<?> listMyTeams() {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        List<TeamResponseDTO> teams = teamService.listTeamsForUser(studentId);
        return ResponseEntity.ok(teams);
    }

    @PostMapping
    public ResponseEntity<?> createTeam(@RequestBody CreateTeamRequestDTO request) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        if (request == null) {
            return ResponseEntity.badRequest().body(new MessageResponse("Request body is required"));
        }
        try {
            TeamResponseDTO response = teamService.createTeam(request, studentId);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PostMapping("/{teamId}/join")
    public ResponseEntity<?> joinTeam(@PathVariable String teamId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            TeamResponseDTO response = teamService.joinTeam(teamId, studentId);
            return ResponseEntity.ok()
                    .header(HttpHeaders.WARNING, "199 - Join request sent")
                    .body(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PostMapping("/{teamId}/accept-invitation")
    public ResponseEntity<?> acceptInvitation(@PathVariable String teamId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            AcceptTeamInvitationRequestDTO dto = new AcceptTeamInvitationRequestDTO(teamId);
            TeamResponseDTO response = teamService.acceptInvitation(dto, studentId);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PostMapping("/{teamId}/decline-invitation")
    public ResponseEntity<?> declineInvitation(@PathVariable String teamId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            TeamResponseDTO response = teamService.declineInvitation(teamId, studentId);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PostMapping("/{teamId}/invite")
    public ResponseEntity<?> inviteMember(
            @PathVariable String teamId,
            @RequestBody Map<String, String> body) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        String targetStudentId = body != null ? body.get("studentId") : null;
        try {
            TeamResponseDTO response = teamService.inviteMember(teamId, targetStudentId, studentId);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PostMapping("/{teamId}/requests/{requesterId}/accept")
    public ResponseEntity<?> acceptJoinRequest(
            @PathVariable String teamId,
            @PathVariable String requesterId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            TeamResponseDTO response = teamService.acceptJoinRequest(teamId, requesterId, studentId);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PostMapping("/{teamId}/requests/{requesterId}/reject")
    public ResponseEntity<?> rejectJoinRequest(
            @PathVariable String teamId,
            @PathVariable String requesterId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            TeamResponseDTO response = teamService.rejectJoinRequest(teamId, requesterId, studentId);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @DeleteMapping("/{teamId}/members/{memberId}")
    public ResponseEntity<?> removeMember(
            @PathVariable String teamId,
            @PathVariable String memberId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            TeamResponseDTO response = teamService.removeMember(teamId, memberId, studentId);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    // Convenience endpoint for UI: leader can cancel a pending invite without
    // needing a refresh.
    // (Internally uses the same removeMember logic; it works for
    // invited/accepted/pending-request ids.)
    @DeleteMapping("/{teamId}/invites/{studentId}")
    public ResponseEntity<?> cancelInvite(
            @PathVariable String teamId,
            @PathVariable String studentId) {
        String leaderId = currentUserId();
        if (leaderId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            TeamResponseDTO response = teamService.removeMember(teamId, studentId, leaderId);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @GetMapping("/{teamId}/members")
    public ResponseEntity<?> listTeamMembers(@PathVariable String teamId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            return ResponseEntity.ok(teamService.listTeamMembers(teamId, studentId));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl principal) {
            return principal.getId();
        }
        return null;
    }
}
