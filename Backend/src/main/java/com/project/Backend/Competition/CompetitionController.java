package com.project.Backend.Competition;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.Competition.dto.CompetitionResponse;
import com.project.Backend.Competition.dto.CreateCompetitionRequest;
import com.project.Backend.User.ResponseDTO.MessageResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping({ "/api/competitions", "/competitions" })
@RequiredArgsConstructor
public class CompetitionController {

    private final CompetitionService competitionService;

    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createCompetition(
            @Valid @RequestPart("data") CreateCompetitionRequest request,
            @RequestPart(value = "materials", required = false) MultipartFile[] materials,
            @AuthenticationPrincipal UserDetailsImpl user) {
        try {
            UserDetailsImpl currentUser = resolveCurrentUser(user);
            if (currentUser == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
            }
            String role = currentUser.getAuthorities().stream()
                    .findFirst()
                    .map(Object::toString)
                    .orElse("");
            CompetitionResponse response = competitionService.createCompetition(request, materials, currentUser.getId(),
                    role);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateCompetition(
            @PathVariable String id,
            @Valid @RequestPart("data") CreateCompetitionRequest request,
            @RequestPart(value = "materials", required = false) MultipartFile[] materials) {
        try {
            CompetitionResponse response = competitionService.updateCompetition(id, request, materials);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<CompetitionResponse>> getAll(@AuthenticationPrincipal UserDetailsImpl user) {
        UserDetailsImpl currentUser = resolveCurrentUser(user);
        String role = currentUser != null && !currentUser.getAuthorities().isEmpty()
                ? currentUser.getAuthorities().iterator().next().getAuthority()
                : "";
        String userId = currentUser != null ? currentUser.getId() : null;
        return ResponseEntity.ok(competitionService.getAllCompetitions(userId, role));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        try {
            UserDetailsImpl currentUser = resolveCurrentUser(user);
            String role = currentUser != null && !currentUser.getAuthorities().isEmpty()
                    ? currentUser.getAuthorities().iterator().next().getAuthority()
                    : null;
            String userId = currentUser != null ? currentUser.getId() : null;

            return ResponseEntity.ok(
                    competitionService.getCompetitionById(id, userId, role));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    @PutMapping("/{id}/publish")
    public ResponseEntity<?> publish(@PathVariable String id) {
        try {
            competitionService.publishCompetition(id);
            return ResponseEntity.ok(new MessageResponse("Competition published"));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        try {
            competitionService.deleteCompetition(id);
            return ResponseEntity.ok(new MessageResponse("Competition deleted"));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    @DeleteMapping("/{id}/materials")
    public ResponseEntity<?> deleteMaterial(@PathVariable String id) {
        try {
            competitionService.deleteCompetitionMaterial(id);
            return ResponseEntity.ok(new MessageResponse("Material deleted successfully"));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    private UserDetailsImpl resolveCurrentUser(UserDetailsImpl injectedUser) {
        if (injectedUser != null) {
            return injectedUser;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetailsImpl details) {
            return details;
        }
        return null;
    }
}
