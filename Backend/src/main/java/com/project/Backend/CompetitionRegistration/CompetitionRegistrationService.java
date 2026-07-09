package com.project.Backend.CompetitionRegistration;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;

import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.CompetitionRegistration.RequestDTO.CompetitionRegistrationRequestDTO;
import com.project.Backend.CompetitionRegistration.ResponseDTO.CompetitionRegistrationResponseDTO;
import com.project.Backend.Team.Team;
import com.project.Backend.Team.TeamRepository;
import com.project.Backend.Team.TeamStatus;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CompetitionRegistrationService {

        private final CompetitionRepository competitionRepository;
        private final CompetitionRegistrationRepository registrationRepository;
        private final TeamRepository teamRepository;
        private final UserRepository userRepository;

        public CompetitionRegistrationResponseDTO register(
                        CompetitionRegistrationRequestDTO dto,
                        String studentId) {
                if (dto == null) {
                        throw new IllegalArgumentException("Request body is required");
                }

                Competition competition = competitionRepository.findById(dto.competitionId())
                                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

                if (!"EXTERNAL".equalsIgnoreCase(competition.getCompetitionType())
                                && !"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
                        throw new IllegalStateException("Unsupported competition type");
                }

                validateRegistrationWindow(competition);

                String type = competition.getParticipationType();
                if (type == null || type.isBlank()) {
                        throw new IllegalStateException("Competition participation type is not configured");
                }

                // ============ INDIVIDUAL ============
                if ("INDIVIDUAL".equalsIgnoreCase(type)) {

                        if (dto.teamId() != null) {
                                throw new IllegalStateException(
                                                "Team not allowed for individual competition");
                        }

                        if (registrationRepository
                                        .existsByCompetitionIdAndStudentId(dto.competitionId(), studentId)) {
                                throw new IllegalStateException("Already registered");
                        }

                        CompetitionRegistration reg = CompetitionRegistrationMapper.newIndividual(
                                        dto.competitionId(),
                                        studentId);

                        CompetitionRegistration savedReg = registrationRepository.save(reg);
                        User user = userRepository.findById(studentId).orElse(null);

                        return CompetitionRegistrationMapper.toResponse(savedReg, user);
                }

                if (!"TEAM".equalsIgnoreCase(type)) {
                        throw new IllegalStateException("Unsupported participation type");
                }

                if (dto.teamId() == null || dto.teamId().isBlank()) {
                        throw new IllegalStateException("Team is required for team competition");
                }

                // ============ TEAM ============
                Team team = teamRepository.findById(dto.teamId())
                                .orElseThrow(() -> new IllegalArgumentException("Team not found"));

                if (!dto.competitionId().equals(team.getCompetitionId())) {
                        throw new IllegalStateException("Team does not belong to this competition");
                }

                if (!team.getLeaderId().equals(studentId)) {
                        throw new IllegalStateException("Only team leader can register");
                }

                if (team.getStatus() != TeamStatus.ACTIVE) {
                        throw new IllegalStateException("Team is not active");
                }

                if (registrationRepository
                                .existsByCompetitionIdAndTeamId(dto.competitionId(), team.getTeamId())) {
                        throw new IllegalStateException("Team already registered");
                }

                CompetitionRegistration reg = CompetitionRegistrationMapper.newTeam(
                                dto.competitionId(),
                                team.getTeamId());

                CompetitionRegistration savedReg = registrationRepository.save(reg);
                User user = userRepository.findById(team.getLeaderId()).orElse(null);

                return CompetitionRegistrationMapper.toResponse(savedReg, user);
        }

        public List<CompetitionRegistrationResponseDTO> getRegisteredStudents(String competitionId) {

                return registrationRepository
                                .findByCompetitionIdAndStatus(
                                                competitionId,
                                                RegistrationStatus.REGISTERED)
                                .stream()
                                .map(reg -> {

                                        User user = reg.getStudentId() != null
                                                        ? userRepository.findById(reg.getStudentId()).orElse(null)
                                                        : null;
                                        return CompetitionRegistrationMapper.toResponse(reg, user);
                                })
                                .toList();
        }

        private void validateRegistrationWindow(Competition competition) {
                LocalDateTime now = LocalDateTime.now();
                LocalDateTime openAt = competition.getRegistrationOpen();
                LocalDateTime closeAt = resolveRegistrationClose(competition);

                if ("EXTERNAL".equalsIgnoreCase(competition.getCompetitionType())
                                && (openAt == null || closeAt == null)) {
                        throw new IllegalStateException("Registration schedule is not set for this competition");
                }

                if (openAt != null && now.isBefore(openAt)) {
                        throw new IllegalStateException("Registration is not open yet");
                }

                if (closeAt != null && now.isAfter(closeAt)) {
                        throw new IllegalStateException("Registration is closed");
                }
        }

        private LocalDateTime resolveRegistrationClose(Competition competition) {
                if (competition.getRegistrationClose() != null) {
                        return competition.getRegistrationClose();
                }
                return competition.getRegistrationDeadline();
        }
}
