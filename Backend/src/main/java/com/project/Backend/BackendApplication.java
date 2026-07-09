package com.project.Backend;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.project.Backend.Auth.Role;
import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.CompetitionRegistration.CompetitionRegistration;
import com.project.Backend.CompetitionRegistration.CompetitionRegistrationRepository;
import com.project.Backend.CompetitionRegistration.RegistrationStatus;
import com.project.Backend.Evaluation.Evaluation;
import com.project.Backend.Milestone.Milestone;
import com.project.Backend.Milestone.MilestoneRepository;
import com.project.Backend.MyExternalParticipation.MyExternalParticipation;
import com.project.Backend.MyExternalParticipation.MyExternalParticipationRepository;
import com.project.Backend.Notification.Notification;
import com.project.Backend.Notification.NotificationRepository;
import com.project.Backend.Notification.NotificationType;
import com.project.Backend.Submission.Submission;
import com.project.Backend.Submission.SubmissionRepository;
import com.project.Backend.Submission.SubmissionStatus;
import com.project.Backend.Team.Team;
import com.project.Backend.Team.TeamRepository;
import com.project.Backend.Team.TeamStatus;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {

        public static void main(String[] args) {
                SpringApplication.run(BackendApplication.class, args);
        }

        // @Bean
        public CommandLineRunner commandLineRunner(
                        CompetitionRepository competitionRepository,
                        UserRepository userRepository,
                        TeamRepository teamRepository,
                        CompetitionRegistrationRepository registrationRepository,
                        SubmissionRepository submissionRepository,
                        MilestoneRepository milestoneRepository,
                        NotificationRepository notificationRepository,
                        MyExternalParticipationRepository externalParticipationRepository,
                        PasswordEncoder passwordEncoder) {
                return args -> {
                        seedSystemTestData(
                                        competitionRepository,
                                        userRepository,
                                        teamRepository,
                                        registrationRepository,
                                        submissionRepository,
                                        milestoneRepository,
                                        notificationRepository,
                                        externalParticipationRepository,
                                        passwordEncoder);
                };
        }

        private void seedSystemTestData(
                        CompetitionRepository competitionRepository,
                        UserRepository userRepository,
                        TeamRepository teamRepository,
                        CompetitionRegistrationRepository registrationRepository,
                        SubmissionRepository submissionRepository,
                        MilestoneRepository milestoneRepository,
                        NotificationRepository notificationRepository,
                        MyExternalParticipationRepository externalParticipationRepository,
                        PasswordEncoder passwordEncoder) {
                LocalDateTime now = LocalDateTime.now();
                String rawSeedPassword = "SeedPass123!";

                List<User> users = List.of(
                                seedUser(
                                                "U-SEED-STU-01",
                                                "seed.student01",
                                                "seed.student01@example.com",
                                                passwordEncoder.encode(rawSeedPassword),
                                                Set.of(Role.ROLE_STUDENT),
                                                "Seed Student One",
                                                "Computer Science",
                                                "+1-555-101"),
                                seedUser(
                                                "U-SEED-STU-02",
                                                "seed.student02",
                                                "seed.student02@example.com",
                                                passwordEncoder.encode(rawSeedPassword),
                                                Set.of(Role.ROLE_STUDENT),
                                                "Seed Student Two",
                                                "Software Engineering",
                                                "+1-555-102"),
                                seedUser(
                                                "U-SEED-STU-03",
                                                "seed.student03",
                                                "seed.student03@example.com",
                                                passwordEncoder.encode(rawSeedPassword),
                                                Set.of(Role.ROLE_STUDENT),
                                                "Seed Student Three",
                                                "Information Technology",
                                                "+1-555-103"),
                                seedUser(
                                                "U-SEED-STU-04",
                                                "seed.student04",
                                                "seed.student04@example.com",
                                                passwordEncoder.encode(rawSeedPassword),
                                                Set.of(Role.ROLE_STUDENT),
                                                "Seed Student Four",
                                                "Data Science",
                                                "+1-555-104"),
                                seedUser(
                                                "U-SEED-TCH-01",
                                                "seed.teacher01",
                                                "seed.teacher01@example.com",
                                                passwordEncoder.encode(rawSeedPassword),
                                                Set.of(Role.ROLE_TEACHER),
                                                "Seed Teacher One",
                                                "Faculty of Engineering",
                                                "+1-555-201"),
                                seedUser(
                                                "U-SEED-TCH-02",
                                                "seed.teacher02",
                                                "seed.teacher02@example.com",
                                                passwordEncoder.encode(rawSeedPassword),
                                                Set.of(Role.ROLE_TEACHER),
                                                "Seed Teacher Two",
                                                "Faculty of Computing",
                                                "+1-555-202"),
                                seedUser(
                                                "U-SEED-ADM-01",
                                                "seed.admin01",
                                                "seed.admin01@example.com",
                                                passwordEncoder.encode(rawSeedPassword),
                                                Set.of(Role.ROLE_ADMIN),
                                                "Seed Admin",
                                                "Academic Affairs",
                                                "+1-555-301"));
                userRepository.saveAll(users);

                List<Competition> competitions = List.of(
                                seedCompetition(
                                                "C-SEED-INT-IND-REG-OPEN-01",
                                                "Internal Assignment (Registration Open)",
                                                "INTERNAL",
                                                "ASSIGNMENT",
                                                "INDIVIDUAL",
                                                "U-SEED-TCH-02",
                                                now.plusDays(4),
                                                now.plusDays(12),
                                                null,
                                                null,
                                                null,
                                                null,
                                                100,
                                                "Upload report and source archive."),
                                seedCompetition(
                                                "C-SEED-INT-IND-SUBMIT-OPEN-01",
                                                "Database Design Challenge",
                                                "INTERNAL",
                                                "ASSIGNMENT",
                                                "INDIVIDUAL",
                                                "U-SEED-TCH-02",
                                                now.minusDays(1),
                                                now.plusDays(5),
                                                null,
                                                null,
                                                null,
                                                null,
                                                80,
                                                "Schema guideline and evaluation rubric."),
                                seedCompetition(
                                                "C-SEED-INT-IND-QUIZ-OPEN-01",
                                                "Algorithm Sprint Quiz",
                                                "INTERNAL",
                                                "QUIZ",
                                                "INDIVIDUAL",
                                                "U-SEED-TCH-01",
                                                now.minusHours(2),
                                                now.plusHours(6),
                                                null,
                                                null,
                                                null,
                                                60,
                                                50,
                                                "Quiz opens during active window."),
                                seedCompetition(
                                                "C-SEED-INT-TEAM-REG-OPEN-01",
                                                "Team App Prototype",
                                                "INTERNAL",
                                                "PROJECT",
                                                "TEAM",
                                                "U-SEED-TCH-01",
                                                now.plusDays(3),
                                                now.plusDays(10),
                                                null,
                                                2,
                                                4,
                                                null,
                                                120,
                                                "Prototype and architecture presentation."),
                                seedCompetition(
                                                "C-SEED-INT-TEAM-SUBMIT-OPEN-01",
                                                "AI Innovation Team Project",
                                                "INTERNAL",
                                                "PROJECT",
                                                "TEAM",
                                                "U-SEED-TCH-01",
                                                now.minusDays(1),
                                                now.plusDays(9),
                                                null,
                                                2,
                                                4,
                                                null,
                                                150,
                                                "Project guideline and dataset links."),
                                seedCompetition(
                                                "C-SEED-INT-TEAM-PENDING-01",
                                                "Security Engineering Team Assignment",
                                                "INTERNAL",
                                                "ASSIGNMENT",
                                                "TEAM",
                                                "U-SEED-TCH-02",
                                                now.plusDays(2),
                                                now.plusDays(14),
                                                null,
                                                3,
                                                5,
                                                null,
                                                100,
                                                "Pending team activation scenario."),
                                seedCompetition(
                                                "C-SEED-EXT-PROOF-OPEN-01",
                                                "External Data Analytics Cup",
                                                "EXTERNAL",
                                                "PROJECT",
                                                "INDIVIDUAL",
                                                "U-SEED-ADM-01",
                                                now.plusDays(20),
                                                now.plusDays(30),
                                                now.plusDays(35),
                                                null,
                                                null,
                                                null,
                                                100,
                                                "External proof upload testing."),
                                seedCompetition(
                                                "C-SEED-EXT-PROOF-CLOSED-01",
                                                "External Hackathon (Proof Closed)",
                                                "EXTERNAL",
                                                "PROJECT",
                                                "TEAM",
                                                "U-SEED-ADM-01",
                                                now.minusDays(20),
                                                now.minusDays(10),
                                                now.minusDays(5),
                                                2,
                                                5,
                                                null,
                                                100,
                                                "Closed proof deadline scenario."));
                competitionRepository.saveAll(competitions);

                List<Team> teams = List.of(
                                seedTeam(
                                                "T-SEED-ALPHA-01",
                                                "Seed Team Alpha",
                                                "C-SEED-INT-TEAM-SUBMIT-OPEN-01",
                                                "U-SEED-STU-01",
                                                List.of("U-SEED-STU-03"),
                                                List.of("U-SEED-STU-01", "U-SEED-STU-02"),
                                                TeamStatus.ACTIVE),
                                seedTeam(
                                                "T-SEED-DELTA-01",
                                                "Seed Team Delta",
                                                "C-SEED-INT-TEAM-SUBMIT-OPEN-01",
                                                "U-SEED-STU-03",
                                                List.of(),
                                                List.of("U-SEED-STU-03", "U-SEED-STU-04"),
                                                TeamStatus.ACTIVE),
                                seedTeam(
                                                "T-SEED-BETA-01",
                                                "Seed Team Beta",
                                                "C-SEED-INT-TEAM-REG-OPEN-01",
                                                "U-SEED-STU-03",
                                                List.of(),
                                                List.of("U-SEED-STU-03", "U-SEED-STU-04"),
                                                TeamStatus.ACTIVE),
                                seedTeam(
                                                "T-SEED-GAMMA-01",
                                                "Seed Team Gamma",
                                                "C-SEED-INT-TEAM-PENDING-01",
                                                "U-SEED-STU-02",
                                                List.of("U-SEED-STU-04"),
                                                List.of("U-SEED-STU-02"),
                                                TeamStatus.PENDING));
                teamRepository.saveAll(teams);

                List<CompetitionRegistration> registrations = List.of(
                                seedIndividualRegistration(
                                                "R-SEED-IND-01",
                                                "C-SEED-INT-IND-SUBMIT-OPEN-01",
                                                "U-SEED-STU-01",
                                                RegistrationStatus.REGISTERED,
                                                now.minusHours(15)),
                                seedIndividualRegistration(
                                                "R-SEED-IND-02",
                                                "C-SEED-INT-IND-SUBMIT-OPEN-01",
                                                "U-SEED-STU-02",
                                                RegistrationStatus.REGISTERED,
                                                now.minusHours(10)),
                                seedIndividualRegistration(
                                                "R-SEED-IND-03",
                                                "C-SEED-INT-IND-SUBMIT-OPEN-01",
                                                "U-SEED-STU-03",
                                                RegistrationStatus.CANCELLED,
                                                now.minusHours(20)),
                                seedIndividualRegistration(
                                                "R-SEED-IND-04",
                                                "C-SEED-INT-IND-QUIZ-OPEN-01",
                                                "U-SEED-STU-01",
                                                RegistrationStatus.REGISTERED,
                                                now.minusHours(4)),
                                seedIndividualRegistration(
                                                "R-SEED-IND-05",
                                                "C-SEED-INT-IND-QUIZ-OPEN-01",
                                                "U-SEED-STU-02",
                                                RegistrationStatus.REGISTERED,
                                                now.minusHours(3)),
                                seedTeamRegistration(
                                                "R-SEED-TEAM-01",
                                                "C-SEED-INT-TEAM-SUBMIT-OPEN-01",
                                                "T-SEED-ALPHA-01",
                                                RegistrationStatus.REGISTERED,
                                                now.minusHours(12)),
                                seedTeamRegistration(
                                                "R-SEED-TEAM-02",
                                                "C-SEED-INT-TEAM-SUBMIT-OPEN-01",
                                                "T-SEED-DELTA-01",
                                                RegistrationStatus.REGISTERED,
                                                now.minusHours(8)),
                                seedTeamRegistration(
                                                "R-SEED-TEAM-03",
                                                "C-SEED-INT-TEAM-REG-OPEN-01",
                                                "T-SEED-BETA-01",
                                                RegistrationStatus.CANCELLED,
                                                now.minusHours(2)));
                registrationRepository.saveAll(registrations);

                List<Submission> submissions = List.of(
                                seedSubmission(
                                                "S-SEED-IND-ASSIGN-SUBMITTED-01",
                                                "C-SEED-INT-IND-SUBMIT-OPEN-01",
                                                "U-SEED-STU-01",
                                                null,
                                                "ASSIGNMENT",
                                                null,
                                                "seed_db_assignment_v1.pdf",
                                                null,
                                                null,
                                                false,
                                                "Initial assignment submission.",
                                                SubmissionStatus.SUBMITTED,
                                                null,
                                                null,
                                                now.minusHours(6)),
                                seedSubmission(
                                                "S-SEED-IND-ASSIGN-EVAL-01",
                                                "C-SEED-INT-IND-SUBMIT-OPEN-01",
                                                "U-SEED-STU-02",
                                                null,
                                                "ASSIGNMENT",
                                                null,
                                                "seed_db_assignment_final.pdf",
                                                null,
                                                88,
                                                false,
                                                "Final submission with normalization details.",
                                                SubmissionStatus.EVALUATED,
                                                "Well structured schema and constraints.",
                                                Evaluation.builder()
                                                                .marksAwarded(88)
                                                                .feedback("Well structured schema and constraints.")
                                                                .evaluatedAt(now.minusHours(2))
                                                                .build(),
                                                now.minusHours(5)),
                                seedSubmission(
                                                "S-SEED-IND-QUIZ-SUBMITTED-01",
                                                "C-SEED-INT-IND-QUIZ-OPEN-01",
                                                "U-SEED-STU-01",
                                                null,
                                                "QUIZ",
                                                null,
                                                null,
                                                List.of("A", "B", "True", "O(n log n)", "D"),
                                                null,
                                                false,
                                                "Quiz attempt in progress window.",
                                                SubmissionStatus.SUBMITTED,
                                                null,
                                                null,
                                                now.minusMinutes(45)),
                                seedSubmission(
                                                "S-SEED-IND-QUIZ-EVAL-01",
                                                "C-SEED-INT-IND-QUIZ-OPEN-01",
                                                "U-SEED-STU-02",
                                                null,
                                                "QUIZ",
                                                null,
                                                null,
                                                List.of("A", "B", "False", "def", "C"),
                                                42,
                                                false,
                                                "Completed quiz.",
                                                SubmissionStatus.EVALUATED,
                                                "Good performance overall.",
                                                Evaluation.builder()
                                                                .marksAwarded(42)
                                                                .feedback("Good performance overall.")
                                                                .evaluatedAt(now.minusMinutes(20))
                                                                .build(),
                                                now.minusMinutes(50)),
                                seedSubmission(
                                                "S-SEED-TEAM-PROJECT-REVIEW-01",
                                                "C-SEED-INT-TEAM-SUBMIT-OPEN-01",
                                                "U-SEED-STU-01",
                                                "T-SEED-ALPHA-01",
                                                "PROJECT",
                                                "https://github.com/seed/team-alpha-ai-project",
                                                null,
                                                null,
                                                null,
                                                true,
                                                "Team Alpha project submission.",
                                                SubmissionStatus.UNDER_REVIEW,
                                                "Under review by teacher.",
                                                null,
                                                now.minusHours(3)),
                                seedSubmission(
                                                "S-SEED-TEAM-PROJECT-EVAL-01",
                                                "C-SEED-INT-TEAM-SUBMIT-OPEN-01",
                                                "U-SEED-STU-03",
                                                "T-SEED-DELTA-01",
                                                "PROJECT",
                                                "https://github.com/seed/team-delta-ai-project",
                                                null,
                                                null,
                                                91,
                                                true,
                                                "Team Delta project submission.",
                                                SubmissionStatus.EVALUATED,
                                                "Excellent architecture and implementation quality.",
                                                Evaluation.builder()
                                                                .marksAwarded(91)
                                                                .feedback("Excellent architecture and implementation quality.")
                                                                .evaluatedAt(now.minusHours(1))
                                                                .build(),
                                                now.minusHours(4)));
                submissionRepository.saveAll(submissions);

                List<Milestone> milestones = List.of(
                                seedMilestone(
                                                "M-SEED-01",
                                                "U-SEED-STU-01",
                                                "Bronze Merit",
                                                "2026-01-15T10:00:00",
                                                100),
                                seedMilestone(
                                                "M-SEED-02",
                                                "U-SEED-STU-01",
                                                "Silver Merit",
                                                "2026-02-10T14:30:00",
                                                200),
                                seedMilestone(
                                                "M-SEED-03",
                                                "U-SEED-STU-02",
                                                "Bronze Merit",
                                                "2026-01-20T09:45:00",
                                                100),
                                seedMilestone(
                                                "M-SEED-04",
                                                "U-SEED-STU-03",
                                                "Starter Milestone",
                                                "2026-02-01T12:15:00",
                                                50));
                milestoneRepository.saveAll(milestones);

                List<Notification> notifications = List.of(
                                seedNotification(
                                                "N-SEED-01",
                                                "U-SEED-STU-01",
                                                "Competition Created",
                                                "A new internal competition is available for registration.",
                                                NotificationType.COMPETITION_CREATED,
                                                "C-SEED-INT-IND-REG-OPEN-01",
                                                false,
                                                now.minusHours(9)),
                                seedNotification(
                                                "N-SEED-02",
                                                "U-SEED-STU-03",
                                                "Team Invitation",
                                                "You have been invited to join Seed Team Alpha.",
                                                NotificationType.TEAM_INVITATION,
                                                "T-SEED-ALPHA-01",
                                                false,
                                                now.minusHours(8)),
                                seedNotification(
                                                "N-SEED-03",
                                                "U-SEED-STU-01",
                                                "Submission Success",
                                                "Your assignment submission was recorded successfully.",
                                                NotificationType.SUBMISSION_SUCCESS,
                                                "S-SEED-IND-ASSIGN-SUBMITTED-01",
                                                true,
                                                now.minusHours(5)),
                                seedNotification(
                                                "N-SEED-04",
                                                "U-SEED-STU-02",
                                                "Achievement Earned",
                                                "You earned an achievement from Algorithm Sprint Quiz.",
                                                NotificationType.ACHIEVEMENT_EARNED,
                                                "S-SEED-IND-QUIZ-EVAL-01",
                                                false,
                                                now.minusHours(2)),
                                seedNotification(
                                                "N-SEED-05",
                                                "U-SEED-ADM-01",
                                                "External Participation Submitted",
                                                "A student submitted external participation proof for review.",
                                                NotificationType.EXTERNAL_PARTICIPATION_SUBMITTED,
                                                "E-SEED-EXT-01",
                                                false,
                                                now.minusHours(1)));
                notificationRepository.saveAll(notifications);

                List<MyExternalParticipation> externalParticipations = List.of(
                                seedExternalParticipation(
                                                "E-SEED-EXT-01",
                                                "U-SEED-STU-01",
                                                "External Data Analytics Cup 2026",
                                                "Data Science",
                                                "National Data Society",
                                                "Online",
                                                "Remote",
                                                "National",
                                                "Submitted participation proof, awaiting admin review.",
                                                "University students",
                                                "INDIVIDUAL",
                                                null,
                                                null,
                                                LocalDate.now().minusDays(5),
                                                LocalDate.now().plusDays(2),
                                                "https://example.org/data-cup",
                                                "Participant",
                                                List.of("/api/files/seed-proof-001"),
                                                "student_created",
                                                "pending",
                                                null,
                                                LocalDate.now().minusDays(1),
                                                now.minusDays(1),
                                                now.minusHours(6)),
                                seedExternalParticipation(
                                                "E-SEED-EXT-02",
                                                "U-SEED-STU-02",
                                                "Global AI Student Contest",
                                                "AI",
                                                "Global AI Association",
                                                "Hybrid",
                                                "Singapore",
                                                "International",
                                                "Approved participation with valid certificate.",
                                                "Undergraduate students",
                                                "INDIVIDUAL",
                                                null,
                                                null,
                                                LocalDate.now().minusDays(20),
                                                LocalDate.now().minusDays(10),
                                                "https://example.org/global-ai",
                                                "Finalist",
                                                List.of("/api/files/seed-proof-002"),
                                                "student_created",
                                                "approved",
                                                "Verified certificate and results link.",
                                                LocalDate.now().minusDays(9),
                                                now.minusDays(12),
                                                now.minusDays(8)),
                                seedExternalParticipation(
                                                "E-SEED-EXT-03",
                                                "U-SEED-STU-03",
                                                "Regional Hack Night",
                                                "Software Development",
                                                "Tech Community Org",
                                                "Physical",
                                                "Yangon",
                                                "Regional",
                                                "Rejected due to insufficient proof.",
                                                "Open to university students",
                                                "TEAM",
                                                2,
                                                4,
                                                LocalDate.now().minusDays(15),
                                                LocalDate.now().minusDays(14),
                                                "https://example.org/hack-night",
                                                "Participant",
                                                List.of("/api/files/seed-proof-003"),
                                                "student_created",
                                                "rejected",
                                                "Please provide an official certificate with name.",
                                                LocalDate.now().minusDays(13),
                                                now.minusDays(14),
                                                now.minusDays(12)));
                externalParticipationRepository.saveAll(externalParticipations);

                System.out.println("Comprehensive seed data prepared for system testing.");
                System.out.println("Seed login password for all seed users: " + rawSeedPassword);
        }

        private User seedUser(
                        String id,
                        String username,
                        String email,
                        String encodedPassword,
                        Set<Role> roles,
                        String fullName,
                        String department,
                        String phone) {
                User user = new User(username, email, encodedPassword);
                user.setId(id);
                user.setRoles(roles);
                user.setFullName(fullName);
                user.setDepartment(department);
                user.setPhone(phone);
                return user;
        }

        private Competition seedCompetition(
                        String competitionId,
                        String title,
                        String competitionType,
                        String format,
                        String participationType,
                        String createdBy,
                        LocalDateTime registrationDeadline,
                        LocalDateTime submissionDeadline,
                        LocalDateTime proofDeadline,
                        Integer minTeamSize,
                        Integer maxTeamSize,
                        Integer quizDurationMinutes,
                        Integer totalMarks,
                        String materials) {
                return Competition.builder()
                                .competitionId(competitionId)
                                .title(title)
                                .competitionType(competitionType)
                                .format(format)
                                .participationType(participationType)
                                .createdBy(createdBy)
                                .registrationDeadline(registrationDeadline)
                                .submissionDeadline(submissionDeadline)
                                .proofDeadline(proofDeadline)
                                .minTeamSize(minTeamSize)
                                .maxTeamSize(maxTeamSize)
                                .quizDurationMinutes(quizDurationMinutes)
                                .totalMarks(totalMarks)
                                .materials(materials)
                                .build();
        }

        private Team seedTeam(
                        String teamId,
                        String teamName,
                        String competitionId,
                        String leaderId,
                        List<String> invitedMemberIds,
                        List<String> acceptedMemberIds,
                        TeamStatus status) {
                return Team.builder()
                                .teamId(teamId)
                                .teamName(teamName)
                                .competitionId(competitionId)
                                .leaderId(leaderId)
                                .invitedMemberIds(invitedMemberIds)
                                .acceptedMemberIds(acceptedMemberIds)
                                .status(status)
                                .build();
        }

        private CompetitionRegistration seedIndividualRegistration(
                        String id,
                        String competitionId,
                        String studentId,
                        RegistrationStatus status,
                        LocalDateTime registeredAt) {
                return CompetitionRegistration.builder()
                                .id(id)
                                .competitionId(competitionId)
                                .studentId(studentId)
                                .teamId(null)
                                .teamRegistration(false)
                                .status(status)
                                .registeredAt(registeredAt)
                                .build();
        }

        private CompetitionRegistration seedTeamRegistration(
                        String id,
                        String competitionId,
                        String teamId,
                        RegistrationStatus status,
                        LocalDateTime registeredAt) {
                return CompetitionRegistration.builder()
                                .id(id)
                                .competitionId(competitionId)
                                .studentId(null)
                                .teamId(teamId)
                                .teamRegistration(true)
                                .status(status)
                                .registeredAt(registeredAt)
                                .build();
        }

        private Submission seedSubmission(
                        String submissionId,
                        String competitionId,
                        String submittedBy,
                        String teamId,
                        String submissionType,
                        String repoLink,
                        String file,
                        List<String> quizAnswers,
                        Integer marksAwarded,
                        boolean isTeamSubmission,
                        String description,
                        SubmissionStatus submissionStatus,
                        String feedback,
                        Evaluation evaluation,
                        LocalDateTime submittedAt) {
                return Submission.builder()
                                .submissionId(submissionId)
                                .competitionId(competitionId)
                                .submittedBy(submittedBy)
                                .teamId(teamId)
                                .submissionType(submissionType)
                                .repoLink(repoLink)
                                .file(file)
                                .quizAnswers(quizAnswers)
                                .marksAwarded(marksAwarded)
                                .isTeamSubmission(isTeamSubmission)
                                .description(description)
                                .submissionStatus(submissionStatus)
                                .feedback(feedback)
                                .evaluation(evaluation)
                                .submittedAt(submittedAt)
                                .build();
        }

        private Milestone seedMilestone(
                        String milestoneId,
                        String userId,
                        String title,
                        String achievedAt,
                        Integer points) {
                return Milestone.builder()
                                .milestoneId(milestoneId)
                                .studentId(userId)
                                .title(title)
                                .achievedAt(achievedAt)
                                .points(points)
                                .build();
        }

        private Notification seedNotification(
                        String id,
                        String recipientId,
                        String title,
                        String message,
                        NotificationType type,
                        String relatedEntityId,
                        boolean isRead,
                        LocalDateTime createdAt) {
                Notification notification = new Notification();
                notification.setId(id);
                notification.setRecipientId(recipientId);
                notification.setTitle(title);
                notification.setMessage(message);
                notification.setType(type);
                notification.setRelatedEntityId(relatedEntityId);
                notification.setRead(isRead);
                notification.setCreatedAt(createdAt);
                return notification;
        }

        private MyExternalParticipation seedExternalParticipation(
                        String id,
                        String ownerId,
                        String title,
                        String category,
                        String organizer,
                        String mode,
                        String location,
                        String scale,
                        String description,
                        String eligibility,
                        String participationType,
                        Integer teamSizeMin,
                        Integer teamSizeMax,
                        LocalDate startDate,
                        LocalDate endDate,
                        String websiteLink,
                        String participationResult,
                        List<String> proofFiles,
                        String source,
                        String status,
                        String adminNote,
                        LocalDate submittedAt,
                        LocalDateTime createdAt,
                        LocalDateTime updatedAt) {
                MyExternalParticipation ep = new MyExternalParticipation();
                ep.setId(id);
                ep.setOwnerId(ownerId);
                ep.setTitle(title);
                ep.setCategory(category);
                ep.setOrganizer(organizer);
                ep.setMode(mode);
                ep.setLocation(location);
                ep.setScale(scale);
                ep.setDescription(description);
                ep.setEligibility(eligibility);
                ep.setParticipationType(participationType);
                ep.setTeamSizeMin(teamSizeMin);
                ep.setTeamSizeMax(teamSizeMax);
                ep.setStartDate(startDate);
                ep.setEndDate(endDate);
                ep.setWebsiteLink(websiteLink);
                ep.setParticipationResult(participationResult);
                ep.setProofFiles(proofFiles);
                ep.setSource(source);
                ep.setStatus(status);
                ep.setAdminNote(adminNote);
                ep.setSubmittedAt(submittedAt);
                ep.setCreatedAt(createdAt);
                ep.setUpdatedAt(updatedAt);
                return ep;
        }
}
