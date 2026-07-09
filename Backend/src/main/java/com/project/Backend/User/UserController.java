package com.project.Backend.User;

import com.project.Backend.User.UpdateProfileRequest;
import com.project.Backend.Common.response.ApiResponse;
import com.project.Backend.User.UserProfileResponse;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;
import com.project.Backend.Auth.Role;
import com.project.Backend.Auth.UserDetailsImpl;
import com.mongodb.BasicDBObject;
import com.mongodb.DBObject;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Comparator;
import java.util.stream.Collectors;
import java.util.regex.Pattern;
import java.util.UUID;
import java.util.LinkedHashSet;
import java.util.ArrayList;

@RestController
@CrossOrigin(origins = "*", maxAge = 3600)
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GridFsTemplate gridFsTemplate;

    @GetMapping("/me")
    public ResponseEntity<?> getMe() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl principal = (UserDetailsImpl) auth.getPrincipal();
        User user = userRepository.findById(principal.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(new ApiResponse("Error: User not found"));
        }
        List<String> roles = user.getRoles().stream().map(Enum::name).collect(Collectors.toList());
        UserProfileResponse resp = new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getPhone(),
                user.getDepartment(),
                user.getAvatarUrl(),
                user.getBio(),
                roles
        );
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateMe(@Valid @RequestBody UpdateProfileRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl principal = (UserDetailsImpl) auth.getPrincipal();
        User user = userRepository.findById(principal.getId()).orElse(null);
        if (user == null) {
            return ResponseEntity.badRequest().body(new ApiResponse("Error: User not found"));
        }
        // Update allowed fields if provided (non-null)
        if (req.getFullName() != null) user.setFullName(req.getFullName());
        if (req.getPhone() != null) user.setPhone(req.getPhone());
        if (req.getDepartment() != null) user.setDepartment(req.getDepartment());
        if (req.getAvatarUrl() != null) user.setAvatarUrl(req.getAvatarUrl());
        if (req.getBio() != null) user.setBio(req.getBio());

        userRepository.save(user);
        return ResponseEntity.ok(new ApiResponse("Profile updated successfully"));
    }

    @PostMapping("/me/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(new ApiResponse("Error: Empty file"));
        }
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            UserDetailsImpl principal = (UserDetailsImpl) auth.getPrincipal();
            User user = userRepository.findById(principal.getId()).orElse(null);
            if (user == null) {
                return ResponseEntity.badRequest().body(new ApiResponse("Error: User not found"));
            }

            DBObject metaData = new BasicDBObject();
            metaData.put("type", "avatar");
            metaData.put("contentType", file.getContentType());
            
            String filename = "avatar_" + UUID.randomUUID() + "_" + file.getOriginalFilename();
            ObjectId fileId = gridFsTemplate.store(file.getInputStream(), filename, file.getContentType(), metaData);
            
            String url = "/api/files/" + fileId.toString();
            user.setAvatarUrl(url);
            userRepository.save(user);
            return ResponseEntity.ok(new ApiResponse(url));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse("Error: Upload failed"));
        }
    }

    @GetMapping("/students")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> searchStudents(@RequestParam(value = "query", required = false) String query) {
        String currentUserId = currentUserId();
        String q = query != null ? query.trim() : "";

        List<User> students = q.isEmpty()
                ? userRepository.findByRoles(Role.ROLE_STUDENT)
                : userRepository.searchStudents(Role.ROLE_STUDENT, ".*" + Pattern.quote(q) + ".*");

        List<StudentDirectoryItem> result = students.stream()
                .filter(user -> currentUserId == null || !currentUserId.equals(user.getId()))
                .sorted(Comparator.comparing(user -> safeString(user.getUsername())))
                .limit(100)
                .map(user -> new StudentDirectoryItem(
                        user.getId(),
                        user.getUsername(),
                        user.getEmail(),
                        user.getFullName()))
                .toList();

        return ResponseEntity.ok(result);
    }

    @GetMapping("/admin/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminUserStats() {
        int students = userRepository.findByRoles(Role.ROLE_STUDENT).size();
        int teachers = userRepository.findByRoles(Role.ROLE_TEACHER).size();
        int admins = userRepository.findByRoles(Role.ROLE_ADMIN).size();
        return ResponseEntity.ok(new AdminUserStats(
                students + teachers + admins,
                students,
                teachers,
                admins));
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetailsImpl principal) {
            return principal.getId();
        }
        return null;
    }

    private String safeString(String value) {
        return value == null ? "" : value.toLowerCase();
    }

    public record StudentDirectoryItem(
            String id,
            String username,
            String email,
            String fullName) {
    }

    public record AdminUserStats(
            int totalUsers,
            int studentCount,
            int teacherCount,
            int adminCount) {
    }

    @GetMapping("/basic")
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> getBasicUsers(@RequestParam(value = "ids", required = false) List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<String> normalizedIds = ids.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        List<User> foundUsers = new ArrayList<>();
        userRepository.findAllById(new LinkedHashSet<>(normalizedIds)).forEach(foundUsers::add);

        List<BasicUserItem> users = foundUsers.stream()
                .map(user -> new BasicUserItem(
                        user.getId(),
                        user.getUsername(),
                        user.getEmail()))
                .toList();

        return ResponseEntity.ok(users);
    }

    public record BasicUserItem(
            String id,
            String username,
            String email) {
    }
}
