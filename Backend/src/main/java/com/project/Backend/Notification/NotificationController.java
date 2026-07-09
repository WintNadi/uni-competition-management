package com.project.Backend.Notification;

import com.project.Backend.Notification.Notification;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Auth.JwtUtils;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;
import com.project.Backend.User.ResponseDTO.MessageResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import com.project.Backend.Auth.UserDetailsImpl;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private JwtUtils jwtUtils;
    @Autowired
    private UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public List<Notification> getUserNotifications() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return notificationService.getUserNotifications(userDetails.getId());
    }

    @GetMapping("/unread")
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public List<Notification> getUnreadNotifications() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        return notificationService.getUnreadNotifications(userDetails.getId());
    }

    @GetMapping("/stream")
    public SseEmitter stream(@RequestParam("token") String token) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        try {
            if (token == null || !jwtUtils.validateJwtToken(token)) {
                emitter.completeWithError(new IllegalArgumentException("Invalid token"));
                return emitter;
            }
            String subject = jwtUtils.getUserNameFromJwtToken(token);
            User user = userRepository.findByEmail(subject)
                    .orElseGet(() -> userRepository.findByUsername(subject).orElse(null));
            if (user == null) {
                emitter.completeWithError(new IllegalArgumentException("User not found"));
                return emitter;
            }
            notificationService.registerEmitter(user.getId(), emitter);
            List<Notification> current = notificationService.getUnreadNotifications(user.getId());
            try {
                emitter.send(SseEmitter.event().name("bootstrap").data(current));
            } catch (Exception ignored) {
            }
            emitter.onCompletion(() -> notificationService.unregisterEmitter(user.getId(), emitter));
            emitter.onTimeout(() -> notificationService.unregisterEmitter(user.getId(), emitter));
            return emitter;
        } catch (Exception e) {
            try {
                emitter.send(SseEmitter.event().name("error").data("stream error"));
            } catch (Exception ignored) {
            }
            emitter.completeWithError(e);
            return emitter;
        }
    }

    @PutMapping("/{id}/read")
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> markAsRead(@PathVariable String id) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        try {
            Notification notification = notificationService.markAsReadForUser(id, userDetails.getId());
            if (notification == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(notification);
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(403).body(new MessageResponse(ex.getMessage()));
        }
    }

    @PutMapping("/read-all")
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> markAllAsRead() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        notificationService.markAllAsRead(userDetails.getId());
        return ResponseEntity.ok().build();
    }
}
