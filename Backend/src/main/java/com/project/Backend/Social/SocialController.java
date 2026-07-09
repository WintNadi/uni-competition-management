package com.project.Backend.Social;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.User.ResponseDTO.MessageResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/social-feed")
@RequiredArgsConstructor
public class SocialController {

    private final SocialService socialService;

    @GetMapping("/posts")
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> listPosts() {
        return ResponseEntity.ok(socialService.listPosts(currentUserId()));
    }

    @GetMapping("/admin/posts")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> listPostsForModeration() {
        return ResponseEntity.ok(socialService.adminListPosts(currentUserId()));
    }

    @PostMapping("/posts/{postId}/likes")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> likePost(@PathVariable String postId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            return ResponseEntity.ok(socialService.likePost(postId, studentId));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PostMapping("/posts/{postId}/comments")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> commentPost(
            @PathVariable String postId,
            @RequestBody CommentRequest request) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            String text = request == null ? null : request.text();
            return ResponseEntity.ok(socialService.commentPost(postId, studentId, text));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @PutMapping("/posts/{postId}/comments/{commentId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> editComment(
            @PathVariable String postId,
            @PathVariable String commentId,
            @RequestBody CommentRequest request) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            String text = request == null ? null : request.text();
            return ResponseEntity.ok(socialService.editComment(postId, commentId, studentId, text));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
        }
    }

    @DeleteMapping("/posts/{postId}/comments/{commentId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> deleteComment(
            @PathVariable String postId,
            @PathVariable String commentId) {
        String studentId = currentUserId();
        if (studentId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }
        try {
            return ResponseEntity.ok(socialService.deleteComment(postId, commentId, studentId));
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

    public record CommentRequest(String text) {
    }

    // ================= ADMIN MODERATION =================

    @PutMapping("/admin/posts/{postId}/hide")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> hidePost(@PathVariable String postId) {
        socialService.adminHidePost(postId);
        return ResponseEntity.ok(new MessageResponse("Post hidden"));
    }

    @PutMapping("/admin/posts/{postId}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> restorePost(@PathVariable String postId) {
        socialService.adminRestorePost(postId);
        return ResponseEntity.ok(new MessageResponse("Post restored"));
    }

    @DeleteMapping("/admin/posts/{postId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deletePost(@PathVariable String postId) {
        socialService.adminDeletePost(postId);
        return ResponseEntity.ok(new MessageResponse("Post deleted"));
    }

    @PutMapping("/admin/posts/{postId}/comments/{commentId}/hide")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> hideComment(
            @PathVariable String postId,
            @PathVariable String commentId) {

        socialService.adminHideComment(postId, commentId);
        return ResponseEntity.ok(new MessageResponse("Comment hidden"));
    }

    @PutMapping("/admin/posts/{postId}/comments/{commentId}/restore")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> restoreComment(
            @PathVariable String postId,
            @PathVariable String commentId) {

        socialService.adminRestoreComment(postId, commentId);
        return ResponseEntity.ok(new MessageResponse("Comment restored"));
    }

    @DeleteMapping("/admin/posts/{postId}/comments/{commentId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteCommentAdmin(
            @PathVariable String postId,
            @PathVariable String commentId) {

        socialService.adminDeleteComment(postId, commentId);
        return ResponseEntity.ok(new MessageResponse("Comment deleted"));
    }
}
