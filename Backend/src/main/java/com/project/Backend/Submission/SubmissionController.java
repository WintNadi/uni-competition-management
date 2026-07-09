package com.project.Backend.Submission;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.project.Backend.Auth.UserDetailsImpl;
import com.project.Backend.Submission.RequestDTO.AssignmentSubmissionRequestDTO;
import com.project.Backend.Submission.RequestDTO.ProjectSubmissionRequestDTO;
import com.project.Backend.Submission.RequestDTO.QuizSubmissionRequestDTO;
import com.project.Backend.User.ResponseDTO.MessageResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class SubmissionController {

        private final SubmissionService service;

        // ================= GET =================

        @PreAuthorize("hasRole('STUDENT')")
        @GetMapping("/submissions")
        public ResponseEntity<?> findMySubmissions() {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                return ResponseEntity.ok(service.getMySubmissions(studentId));
        }

        @PreAuthorize("hasRole('STUDENT')")
        @GetMapping("/competitions/{competitionId}/submissions")
        public ResponseEntity<?> findMySubmissionsByCompetition(
                        @PathVariable String competitionId) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.ok(
                                        service.getMySubmissionsByCompetition(competitionId, studentId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        @PreAuthorize("hasRole('STUDENT')")
        @GetMapping("/submissions/{submissionId}")
        public ResponseEntity<?> findMySubmissionById(
                        @PathVariable String submissionId) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.ok(
                                        service.getMySubmissionById(studentId, submissionId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        // ================= ASSIGNMENT =================

        @PreAuthorize("hasRole('STUDENT')")
        @PostMapping("/competitions/{competitionId}/submissions/assignment")
        public ResponseEntity<?> submitAssignment(
                        @PathVariable String competitionId,
                        @RequestBody AssignmentSubmissionRequestDTO dto) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.status(HttpStatus.CREATED)
                                        .body(service.submitOrUpdateAssignment(competitionId, dto, studentId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        @PreAuthorize("hasRole('STUDENT')")
        @PutMapping("/competitions/{competitionId}/submissions/assignment")
        public ResponseEntity<?> updateAssignment(
                        @PathVariable String competitionId,
                        @RequestBody AssignmentSubmissionRequestDTO dto) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.ok(
                                        service.submitOrUpdateAssignment(competitionId, dto, studentId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        // ================= PROJECT =================

        @PreAuthorize("hasRole('STUDENT')")
        @PostMapping("/competitions/{competitionId}/submissions/project")
        public ResponseEntity<?> submitProject(
                        @PathVariable String competitionId,
                        @RequestBody ProjectSubmissionRequestDTO dto) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.status(HttpStatus.CREATED)
                                        .body(service.submitOrUpdateProject(competitionId, dto, studentId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        @PreAuthorize("hasRole('STUDENT')")
        @PutMapping("/competitions/{competitionId}/submissions/project")
        public ResponseEntity<?> updateProject(
                        @PathVariable String competitionId,
                        @RequestBody ProjectSubmissionRequestDTO dto) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.ok(
                                        service.submitOrUpdateProject(competitionId, dto, studentId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        // ================= QUIZ =================

        @PreAuthorize("hasRole('STUDENT')")
        @PostMapping("/competitions/{competitionId}/submissions/quiz")
        public ResponseEntity<?> submitQuiz(
                        @PathVariable String competitionId,
                        @RequestBody QuizSubmissionRequestDTO dto) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.status(HttpStatus.CREATED)
                                        .body(service.submitQuiz(competitionId, dto, studentId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        @PreAuthorize("hasRole('STUDENT')")
        @GetMapping("/competitions/{competitionId}/submissions/quiz/questions")
        public ResponseEntity<?> getQuizQuestions(@PathVariable String competitionId) {
                String studentId = currentUserId();
                if (studentId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.ok(service.getQuizQuestionsForAttempt(competitionId, studentId));
                } catch (IllegalStateException | IllegalArgumentException ex) {
                        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
                }
        }

        // ================= TEACHER VIEW =================

        @PreAuthorize("hasRole('TEACHER')")
        @GetMapping("/teacher/submissions")
        public ResponseEntity<?> findTeacherSubmissions() {
                String teacherId = currentUserId();
                if (teacherId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                return ResponseEntity.ok(service.getTeacherSubmissions(teacherId));
        }

        @PreAuthorize("hasRole('TEACHER')")
        @GetMapping("/teacher/competitions/{competitionId}/submissions")
        public ResponseEntity<?> findTeacherSubmissionsByCompetition(@PathVariable String competitionId) {
                String teacherId = currentUserId();
                if (teacherId == null) {
                        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                        .body(new MessageResponse("Unauthorized"));
                }
                try {
                        return ResponseEntity.ok(service.getTeacherSubmissionsByCompetition(competitionId, teacherId));
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
