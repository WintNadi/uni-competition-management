package com.project.Backend.Evaluation;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.Evaluation.DTO.EvaluationRequestDTO;
import com.project.Backend.Evaluation.DTO.EvaluationResponseDTO;
import com.project.Backend.User.ResponseDTO.MessageResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/evaluation")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class EvaluationController {

    private final EvaluationService evaluationService;

    @PostMapping("/{submissionId}")
    public ResponseEntity<?> evaluateSubmission(
            @PathVariable String submissionId,
            @RequestBody @Valid EvaluationRequestDTO dto) {
        try {
            String teacherId = currentUserId();
            if (teacherId == null) {
                return ResponseEntity.status(401).body(new MessageResponse("Unauthorized"));
            }
            EvaluationResponseDTO response = evaluationService.evaluateSubmission(submissionId, dto, teacherId);
            return ResponseEntity.ok(response);
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
