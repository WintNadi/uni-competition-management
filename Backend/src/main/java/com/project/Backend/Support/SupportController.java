package com.project.Backend.Support;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

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

import com.project.Backend.Auth.Role;
import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.User.ResponseDTO.MessageResponse;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @GetMapping("/conversations/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> myConversations() {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        List<SupportConversation> list = conversationRepository.findByStudentIdOrderByLastMessageAtDesc(studentId);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/conversations/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminConversations() {
        List<SupportConversation> open = conversationRepository.findByStatusOrderByLastMessageAtDesc("OPEN");
        List<SupportConversation> closed = conversationRepository.findByStatusOrderByLastMessageAtDesc("CLOSED");
        java.util.ArrayList<SupportSummaryView> out = new java.util.ArrayList<>();
        open.forEach(c -> out.add(toSummary(c)));
        closed.forEach(c -> out.add(toSummary(c)));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/conversations/{id}")
    @PreAuthorize("hasRole('STUDENT') or hasRole('ADMIN')")
    public ResponseEntity<?> getConversation(@PathVariable String id) {
        Optional<SupportConversation> opt = conversationRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        SupportConversation conv = opt.get();
        String userId = currentUserId();
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        if (!userId.equals(conv.getStudentId()) && !isAdmin(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        markRead(conv, userId);
        conversationRepository.save(conv);
        return ResponseEntity.ok(conv);
    }

    @PostMapping("/conversations")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> createConversation(@RequestBody CreateConversationRequest request) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        String subject = request == null ? null : request.subject();
        String text = request == null ? null : request.message();
        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Message text is required"));
        }
        SupportConversation conv = new SupportConversation();
        conv.setStudentId(studentId);
        conv.setSubject(subject == null || subject.isBlank() ? "Student enquiry" : subject.trim());
        conv.setStatus("OPEN");
        LocalDateTime now = LocalDateTime.now();
        conv.setCreatedAt(now);
        conv.setUpdatedAt(now);
        conv.setLastMessageAt(now);
        SupportConversation.SupportMessage msg = new SupportConversation.SupportMessage();
        msg.setId(UUID.randomUUID().toString());
        msg.setSenderId(studentId);
        msg.setSenderRole("STUDENT");
        msg.setText(text.trim());
        msg.setCreatedAt(now);
        msg.setReadByStudent(true);
        msg.setReadByAdmin(false);
        java.util.ArrayList<SupportConversation.SupportMessage> messages = new java.util.ArrayList<>();
        messages.add(msg);
        conv.setMessages(messages);
        conv.setUnreadForStudent(0);
        conv.setUnreadForAdmin(1);
        SupportConversation saved = conversationRepository.save(conv);

        notifyAdminsNewMessage(saved, msg);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/conversations/{id}/messages")
    @PreAuthorize("hasRole('STUDENT') or hasRole('ADMIN')")
    public ResponseEntity<?> sendMessage(@PathVariable String id, @RequestBody SendMessageRequest request) {
        String userId = currentUserId();
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        Optional<SupportConversation> opt = conversationRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        SupportConversation conv = opt.get();
        boolean isAdmin = isAdmin(userId);
        if (!isAdmin && !userId.equals(conv.getStudentId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String text = request == null ? null : request.message();
        if (text == null || text.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Message text is required"));
        }
        if (!"OPEN".equalsIgnoreCase(conv.getStatus())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Conversation is closed"));
        }
        LocalDateTime now = LocalDateTime.now();
        SupportConversation.SupportMessage msg = new SupportConversation.SupportMessage();
        msg.setId(UUID.randomUUID().toString());
        msg.setSenderId(userId);
        msg.setSenderRole(isAdmin ? "ADMIN" : "STUDENT");
        msg.setText(text.trim());
        msg.setCreatedAt(now);
        msg.setReadByAdmin(isAdmin);
        msg.setReadByStudent(!isAdmin);

        java.util.ArrayList<SupportConversation.SupportMessage> messages = new java.util.ArrayList<>(
                conv.getMessages() == null ? java.util.List.of() : conv.getMessages());
        messages.add(msg);
        conv.setMessages(messages);
        conv.setLastMessageAt(now);
        conv.setUpdatedAt(now);
        if (isAdmin) {
            if (conv.getAdminId() == null) {
                conv.setAdminId(userId);
            }
            conv.setUnreadForStudent(conv.getUnreadForStudent() + 1);
        } else {
            conv.setUnreadForAdmin(conv.getUnreadForAdmin() + 1);
        }
        SupportConversation saved = conversationRepository.save(conv);

        if (isAdmin) {
            notifyStudentNewMessage(saved, msg);
        } else {
            notifyAdminsNewMessage(saved, msg);
        }
        return ResponseEntity.ok(saved);
    }

    private void markRead(SupportConversation conv, String viewerId) {
        boolean isAdmin = isAdmin(viewerId);
        List<SupportConversation.SupportMessage> messages = conv.getMessages();
        if (messages == null) {
            return;
        }
        for (SupportConversation.SupportMessage msg : messages) {
            if (isAdmin) {
                msg.setReadByAdmin(true);
            } else {
                msg.setReadByStudent(true);
            }
        }
        if (isAdmin) {
            conv.setUnreadForAdmin(0);
        } else {
            conv.setUnreadForStudent(0);
        }
        conv.setUpdatedAt(LocalDateTime.now());
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl principal) {
            return principal.getId();
        }
        return null;
    }

    private boolean isAdmin(String userId) {
        if (userId == null) return false;
        return userRepository.findById(userId)
                .map(user -> user.getRoles() != null && user.getRoles().contains(Role.ROLE_ADMIN))
                .orElse(false);
    }

    private SupportSummaryView toSummary(SupportConversation conv) {
        User student = conv.getStudentId() != null
                ? userRepository.findById(conv.getStudentId()).orElse(null)
                : null;
        String studentName = student != null && student.getFullName() != null && !student.getFullName().isBlank()
                ? student.getFullName()
                : student != null ? student.getUsername() : "Student";
        String studentEmail = student != null ? student.getEmail() : "";
        return new SupportSummaryView(
                conv.getId(),
                conv.getSubject(),
                conv.getStatus(),
                conv.getLastMessageAt(),
                conv.getUnreadForAdmin(),
                studentName,
                studentEmail);
    }

    private void notifyAdminsNewMessage(SupportConversation conv, SupportConversation.SupportMessage msg) {
        List<User> admins = userRepository.findByRoles(Role.ROLE_ADMIN);
        if (admins == null || admins.isEmpty()) {
            return;
        }
        User student = conv.getStudentId() != null
                ? userRepository.findById(conv.getStudentId()).orElse(null)
                : null;
        String studentName = student != null && student.getFullName() != null && !student.getFullName().isBlank()
                ? student.getFullName()
                : student != null ? student.getUsername() : "A student";
        String title = "New message from " + studentName;
        String preview = msg.getText() == null ? "" : msg.getText();
        String shortPreview = preview.length() > 80 ? preview.substring(0, 77) + "..." : preview;
        String content = "Support conversation: " + conv.getSubject() + " — " + shortPreview;
        for (User admin : admins) {
            notificationService.createNotification(
                    admin.getId(),
                    title,
                    content,
                    com.project.Backend.Notification.NotificationType.GENERAL,
                    conv.getId());
        }
    }

    private void notifyStudentNewMessage(SupportConversation conv, SupportConversation.SupportMessage msg) {
        if (conv.getStudentId() == null) {
            return;
        }
        User admin = conv.getAdminId() != null
                ? userRepository.findById(conv.getAdminId()).orElse(null)
                : null;
        String adminName = admin != null && admin.getFullName() != null && !admin.getFullName().isBlank()
                ? admin.getFullName()
                : admin != null ? admin.getUsername() : "Admin";
        String title = "New reply from " + adminName;
        String preview = msg.getText() == null ? "" : msg.getText();
        String shortPreview = preview.length() > 80 ? preview.substring(0, 77) + "..." : preview;
        String content = "Support conversation: " + conv.getSubject() + " — " + shortPreview;
        notificationService.createNotification(
                conv.getStudentId(),
                title,
                content,
                com.project.Backend.Notification.NotificationType.GENERAL,
                conv.getId());
    }

    public record CreateConversationRequest(String subject, String message) {
    }

    public record SendMessageRequest(String message) {
    }

    public record SupportSummaryView(
            String id,
            String subject,
            String status,
            LocalDateTime lastMessageAt,
            int unreadForAdmin,
            String studentName,
            String studentEmail) {
        public String statusLabel() {
            String value = status == null ? "OPEN" : status;
            return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1).toLowerCase(Locale.ROOT);
        }
    }
}

