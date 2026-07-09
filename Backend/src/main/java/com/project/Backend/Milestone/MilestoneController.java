package com.project.Backend.Milestone;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.User.ResponseDTO.MessageResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/milestones")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class MilestoneController {
    private final MilestoneRepository repository;

    @GetMapping
    public ResponseEntity<?> findMyMilestones() {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        List<Milestone> milestones = repository.findByStudentId(studentId);
        return ResponseEntity.ok(milestones);
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl principal) {
            return principal.getId();
        }
        return null;
    }
}
