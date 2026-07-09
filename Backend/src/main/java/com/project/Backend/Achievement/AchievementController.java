package com.project.Backend.Achievement;

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
@RequestMapping("/api/achievements")
@RequiredArgsConstructor
public class AchievementController {

    private final AchievementRepository achievementRepository;

    @GetMapping("/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> myAchievements() {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        return ResponseEntity.ok(achievementRepository.findByStudentIdOrderByAchievedAtDesc(studentId));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<Achievement> getAll() {
        return achievementRepository.findAll();
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl principal) {
            return principal.getId();
        }
        return null;
    }
}
