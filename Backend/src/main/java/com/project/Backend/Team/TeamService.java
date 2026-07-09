package com.project.Backend.Team;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.project.Backend.Competition.Competition;
import com.project.Backend.Competition.CompetitionRepository;
import com.project.Backend.CompetitionRegistration.CompetitionRegistration;
import com.project.Backend.CompetitionRegistration.CompetitionRegistrationMapper;
import com.project.Backend.CompetitionRegistration.CompetitionRegistrationRepository;
import com.project.Backend.CompetitionRegistration.RegistrationStatus;
import com.project.Backend.Notification.NotificationService;
import com.project.Backend.Team.RequestDTO.AcceptTeamInvitationRequestDTO;
import com.project.Backend.Team.RequestDTO.CreateTeamRequestDTO;
import com.project.Backend.Team.ResponseDTO.TeamResponseDTO;
import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;
    private final CompetitionRepository competitionRepository;
    private final CompetitionRegistrationRepository competitionRegistrationRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public List<TeamResponseDTO> listTeamsByCompetition(String competitionId) {
        return teamRepository.findByCompetitionId(competitionId)
                .stream()
                .sorted((a, b) -> {
                    LocalDateTime first = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime second = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                    int dateCompare = second.compareTo(first);
                    if (dateCompare != 0) {
                        return dateCompare;
                    }
                    String firstId = a.getTeamId() == null ? "" : a.getTeamId();
                    String secondId = b.getTeamId() == null ? "" : b.getTeamId();
                    return secondId.compareTo(firstId);
                })
                .map(this::toResponse)
                .toList();
    }

    public List<TeamResponseDTO> listTeamsForUser(String studentId) {
        return teamRepository.findByLeaderIdOrAcceptedMemberIdsContaining(studentId, studentId)
                .stream()
                .sorted((a, b) -> {
                    LocalDateTime first = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime second = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                    int dateCompare = second.compareTo(first);
                    if (dateCompare != 0) {
                        return dateCompare;
                    }
                    String firstId = a.getTeamId() == null ? "" : a.getTeamId();
                    String secondId = b.getTeamId() == null ? "" : b.getTeamId();
                    return secondId.compareTo(firstId);
                })
                .map(this::toResponse)
                .toList();
    }

    public TeamResponseDTO createTeam(CreateTeamRequestDTO dto, String leaderId) {
        if (dto == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        if (dto.competitionId() == null || dto.competitionId().isBlank()) {
            throw new IllegalArgumentException("competitionId is required");
        }
        if (dto.teamName() == null || dto.teamName().isBlank()) {
            throw new IllegalStateException("Team name is required");
        }

        Competition competition = getTeamCompetition(dto.competitionId());
        validateRegistrationWindow(competition);

        if (isStudentInAnotherTeamForCompetition(dto.competitionId(), leaderId, null)) {
            throw new IllegalStateException("Student is already in a team for this competition");
        }

        Team team = new Team();
        team.setTeamId("TEAM-" + UUID.randomUUID());
        team.setTeamName(dto.teamName().trim());
        team.setCompetitionId(dto.competitionId());
        team.setLeaderId(leaderId);
        team.setCreatedAt(LocalDateTime.now());

        List<String> invited = new ArrayList<>(sanitizeIds(dto.invitedMemberIds()));
        invited.remove(leaderId);

        for (String memberId : invited) {
            if (isStudentInAnotherTeamForCompetition(dto.competitionId(), memberId, null)) {
                throw new IllegalStateException("Invited student is already in another team for this competition");
            }
        }

        team.setInvitedMemberIds(new ArrayList<>(invited));
        team.setPendingJoinRequestIds(new ArrayList<>());
        team.setAcceptedMemberIds(new ArrayList<>(List.of(leaderId)));

        updateTeamStatus(team, competition);
        Team saved = teamRepository.save(team);
        syncTeamRegistration(saved);

        for (String invitedStudentId : invited) {
            notificationService.sendTeamInvitationNotification(invitedStudentId, saved.getTeamName(),
                    saved.getTeamId());
        }

        return toResponse(saved);
    }

    // Student requests to join a team; leader accepts/rejects in My Teams tab.
    public TeamResponseDTO joinTeam(String teamId, String studentId) {
        if (teamId == null || teamId.isBlank()) {
            throw new IllegalArgumentException("teamId is required");
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        Competition competition = getTeamCompetition(team.getCompetitionId());
        validateRegistrationWindow(competition);
        ensureMutableLists(team);

        if (team.getLeaderId().equals(studentId)) {
            return toResponse(team);
        }
        if (team.getAcceptedMemberIds().contains(studentId)) {
            return toResponse(team);
        }
        if (team.getInvitedMemberIds().contains(studentId)) {
            throw new IllegalStateException("You are invited already. Please accept invitation.");
        }
        if (isStudentInAnotherTeamForCompetition(team.getCompetitionId(), studentId, team.getTeamId())) {
            throw new IllegalStateException("Student is already in another team for this competition");
        }
        if (!hasCapacityForNewMember(team, competition)) {
            throw new IllegalStateException("Team is full");
        }
        if (team.getPendingJoinRequestIds().contains(studentId)) {
            return toResponse(team);
        }

        team.getPendingJoinRequestIds().add(studentId);
        Team saved = teamRepository.save(team);
        return toResponse(saved);
    }

    public TeamResponseDTO acceptInvitation(AcceptTeamInvitationRequestDTO dto, String studentId) {
        if (dto == null || dto.teamId() == null || dto.teamId().isBlank()) {
            throw new IllegalArgumentException("teamId is required");
        }

        Team team = teamRepository.findById(dto.teamId())
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        Competition competition = getTeamCompetition(team.getCompetitionId());
        validateRegistrationWindow(competition);
        ensureMutableLists(team);

        if (team.getLeaderId().equals(studentId)) {
            throw new IllegalStateException("Leader does not need to accept invitation");
        }
        if (!team.getInvitedMemberIds().contains(studentId)) {
            throw new IllegalStateException("Student was not invited");
        }

        addAcceptedMember(team, studentId, competition);
        Team saved = teamRepository.save(team);
        syncTeamRegistration(saved);
        notificationService.sendTeamConfirmationNotification(studentId, saved.getTeamName(), saved.getTeamId());
        // Let leader know immediately (SSE + saved notification) so UI can update
        // without refresh.
        String studentName = resolveDisplayName(studentId);
        notificationService.sendTeamInviteAcceptedToLeader(saved.getLeaderId(), studentName, saved.getTeamName(),
                saved.getTeamId());
        return toResponse(saved);
    }

    public TeamResponseDTO declineInvitation(String teamId, String studentId) {
        if (teamId == null || teamId.isBlank()) {
            throw new IllegalArgumentException("teamId is required");
        }
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        ensureMutableLists(team);

        if (!team.getInvitedMemberIds().contains(studentId)) {
            throw new IllegalStateException("Student was not invited");
        }

        team.getInvitedMemberIds().remove(studentId);
        team.getPendingJoinRequestIds().remove(studentId);
        Team saved = teamRepository.save(team);
        // Inform leader so they can see the change without refreshing.
        String studentName = resolveDisplayName(studentId);
        notificationService.sendTeamInviteDeclinedToLeader(saved.getLeaderId(), studentName, saved.getTeamName(),
                saved.getTeamId());
        return toResponse(saved);
    }

    public TeamResponseDTO inviteMember(String teamId, String targetStudentId, String leaderId) {
        if (targetStudentId == null || targetStudentId.isBlank()) {
            throw new IllegalArgumentException("studentId is required");
        }

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        assertLeader(team, leaderId);

        Competition competition = getTeamCompetition(team.getCompetitionId());
        validateRegistrationWindow(competition);
        ensureMutableLists(team);

        if (targetStudentId.equals(team.getLeaderId())) {
            throw new IllegalStateException("Leader cannot invite themselves");
        }
        if (team.getAcceptedMemberIds().contains(targetStudentId)) {
            throw new IllegalStateException("Student is already a team member");
        }
        if (!hasCapacityForInvite(team, competition, targetStudentId)) {
            throw new IllegalStateException("Team is full");
        }
        if (isStudentInAnotherTeamForCompetition(team.getCompetitionId(), targetStudentId, team.getTeamId())) {
            throw new IllegalStateException("Student is already in another team for this competition");
        }

        if (!team.getInvitedMemberIds().contains(targetStudentId)) {
            team.getInvitedMemberIds().add(targetStudentId);
        }
        team.getPendingJoinRequestIds().remove(targetStudentId);

        Team saved = teamRepository.save(team);
        notificationService.sendTeamInvitationNotification(targetStudentId, saved.getTeamName(), saved.getTeamId());
        return toResponse(saved);
    }

    public TeamResponseDTO acceptJoinRequest(String teamId, String requesterId, String leaderId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        assertLeader(team, leaderId);

        Competition competition = getTeamCompetition(team.getCompetitionId());
        validateRegistrationWindow(competition);
        ensureMutableLists(team);

        if (!team.getPendingJoinRequestIds().contains(requesterId)) {
            throw new IllegalStateException("Join request not found");
        }

        addAcceptedMember(team, requesterId, competition);
        Team saved = teamRepository.save(team);
        syncTeamRegistration(saved);
        notificationService.sendTeamConfirmationNotification(requesterId, saved.getTeamName(), saved.getTeamId());
        return toResponse(saved);
    }

    public TeamResponseDTO rejectJoinRequest(String teamId, String requesterId, String leaderId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        assertLeader(team, leaderId);

        Competition competition = getTeamCompetition(team.getCompetitionId());
        validateRegistrationWindow(competition);
        ensureMutableLists(team);

        boolean removed = team.getPendingJoinRequestIds().remove(requesterId);
        if (!removed) {
            throw new IllegalStateException("Join request not found");
        }

        return toResponse(teamRepository.save(team));
    }

    public TeamResponseDTO removeMember(String teamId, String memberId, String leaderId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        assertLeader(team, leaderId);

        Competition competition = getTeamCompetition(team.getCompetitionId());
        ensureMutableLists(team);

        if (memberId == null || memberId.isBlank()) {
            throw new IllegalArgumentException("memberId is required");
        }
        if (memberId.equals(team.getLeaderId())) {
            throw new IllegalStateException("Leader cannot be removed");
        }

        boolean isAccepted = team.getAcceptedMemberIds().contains(memberId);
        boolean isJoinRequest = team.getPendingJoinRequestIds().contains(memberId);

        if (isAccepted || isJoinRequest) {
            validateRegistrationWindow(competition);
        }

        boolean removedAccepted = team.getAcceptedMemberIds().remove(memberId);
        boolean removedInvited = team.getInvitedMemberIds().remove(memberId);
        boolean removedRequest = team.getPendingJoinRequestIds().remove(memberId);

        if (!removedAccepted && !removedInvited && !removedRequest) {
            throw new IllegalStateException("Member is not in this team");
        }

        updateTeamStatus(team, competition);
        Team saved = teamRepository.save(team);
        syncTeamRegistration(saved);

        // Realtime visibility: notify affected student(s) via SSE.
        if (removedInvited) {
            notificationService.sendTeamInviteCanceledNotification(memberId, saved.getTeamName(), saved.getTeamId());
        }
        if (removedAccepted) {
            notificationService.sendTeamMemberRemovedNotification(memberId, saved.getTeamName(), saved.getTeamId());
        }
        if (removedRequest) {
            notificationService.sendRejectionNotification(memberId, "team join request",
                    "Request was removed by leader",
                    saved.getTeamId());
        }
        return toResponse(saved);
    }

    private String resolveDisplayName(String userId) {
        if (userId == null || userId.isBlank()) {
            return "A student";
        }
        return userRepository.findById(userId)
                .map(u -> {
                    if (u.getFullName() != null && !u.getFullName().isBlank()) {
                        return u.getFullName();
                    }
                    if (u.getUsername() != null && !u.getUsername().isBlank()) {
                        return u.getUsername();
                    }
                    return "A student";
                })
                .orElse("A student");
    }

    public List<TeammateProfileDTO> listTeamMembers(String teamId, String requesterId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found"));
        ensureMutableLists(team);

        boolean isLeader = requesterId != null && requesterId.equals(team.getLeaderId());
        boolean isMember = requesterId != null && team.getAcceptedMemberIds().contains(requesterId);
        if (!isLeader && !isMember) {
            throw new IllegalStateException("Only team members can view teammate profiles");
        }

        List<String> memberIds = sanitizeIds(team.getAcceptedMemberIds());
        List<User> users = new ArrayList<>();
        userRepository.findAllById(memberIds).forEach(users::add);
        Map<String, User> userMap = new HashMap<>();
        for (User user : users) {
            userMap.put(user.getId(), user);
        }

        List<TeammateProfileDTO> out = new ArrayList<>();
        for (String memberId : memberIds) {
            User user = userMap.get(memberId);
            if (user == null) {
                continue;
            }
            out.add(new TeammateProfileDTO(
                    user.getId(),
                    user.getUsername(),
                    user.getFullName(),
                    user.getEmail(),
                    user.getPhone(),
                    user.getAvatarUrl(),
                    memberId.equals(team.getLeaderId())));
        }
        return out;
    }

    private void addAcceptedMember(Team team, String studentId, Competition competition) {
        if (team.getAcceptedMemberIds().contains(studentId)) {
            return;
        }
        if (isStudentInAnotherTeamForCompetition(team.getCompetitionId(), studentId, team.getTeamId())) {
            throw new IllegalStateException("Student is already in another team for this competition");
        }
        if (!hasCapacityForNewMember(team, competition)) {
            throw new IllegalStateException("Team is full");
        }

        team.getAcceptedMemberIds().add(studentId);
        team.getInvitedMemberIds().remove(studentId);
        team.getPendingJoinRequestIds().remove(studentId);
        updateTeamStatus(team, competition);
    }

    private Competition getTeamCompetition(String competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competition not found"));

        if (!"INTERNAL".equalsIgnoreCase(competition.getCompetitionType())) {
            throw new IllegalStateException("Teams are only available for internal competitions");
        }
        if (!"TEAM".equalsIgnoreCase(competition.getParticipationType())) {
            throw new IllegalStateException("Team registration is not allowed for this competition");
        }
        return competition;
    }

    private void assertLeader(Team team, String leaderId) {
        if (leaderId == null || !leaderId.equals(team.getLeaderId())) {
            throw new IllegalStateException("Only team leader can perform this action");
        }
    }

    private void ensureMutableLists(Team team) {
        if (team.getAcceptedMemberIds() == null) {
            team.setAcceptedMemberIds(new ArrayList<>());
        }
        if (team.getInvitedMemberIds() == null) {
            team.setInvitedMemberIds(new ArrayList<>());
        }
        if (team.getPendingJoinRequestIds() == null) {
            team.setPendingJoinRequestIds(new ArrayList<>());
        }
    }

    private boolean hasCapacityForNewMember(Team team, Competition competition) {
        if (competition.getMaxTeamSize() == null) {
            return true;
        }
        int acceptedCount = sanitizeIds(team.getAcceptedMemberIds()).size();
        return acceptedCount < competition.getMaxTeamSize();
    }

    private boolean hasCapacityForInvite(Team team, Competition competition, String targetStudentId) {
        return true;
    }

    private void updateTeamStatus(Team team, Competition competition) {
        int acceptedCount = sanitizeIds(team.getAcceptedMemberIds()).size();
        Integer minSize = competition.getMinTeamSize();
        if (minSize == null || acceptedCount >= minSize) {
            team.setStatus(TeamStatus.ACTIVE);
            return;
        }
        team.setStatus(TeamStatus.PENDING);
    }

    private void syncTeamRegistration(Team team) {
        if (team.getStatus() == TeamStatus.ACTIVE) {
            ensureTeamRegistrationIfActive(team);
            return;
        }
        cancelTeamRegistrationIfExists(team);
    }

    private boolean isStudentInAnotherTeamForCompetition(String competitionId, String studentId, String currentTeamId) {
        List<Team> teams = new ArrayList<>(teamRepository.findByCompetitionIdAndLeaderId(competitionId, studentId));
        teams.addAll(teamRepository.findByCompetitionIdAndAcceptedMemberIdsContaining(competitionId, studentId));
        return teams.stream()
                .map(Team::getTeamId)
                .distinct()
                .anyMatch(teamId -> !teamId.equals(currentTeamId));
    }

    private void ensureTeamRegistrationIfActive(Team team) {
        boolean alreadyRegistered = competitionRegistrationRepository.existsByCompetitionIdAndTeamIdAndStatus(
                team.getCompetitionId(),
                team.getTeamId(),
                RegistrationStatus.REGISTERED);

        if (alreadyRegistered) {
            return;
        }

        CompetitionRegistration registration = CompetitionRegistrationMapper.newTeam(
                team.getCompetitionId(),
                team.getTeamId());
        competitionRegistrationRepository.save(registration);
    }

    private void cancelTeamRegistrationIfExists(Team team) {
        List<CompetitionRegistration> registrations = competitionRegistrationRepository.findByCompetitionIdAndTeamId(
                team.getCompetitionId(),
                team.getTeamId());
        if (registrations == null || registrations.isEmpty()) {
            return;
        }
        for (CompetitionRegistration registration : registrations) {
            registration.setStatus(RegistrationStatus.CANCELLED);
        }
        competitionRegistrationRepository.saveAll(registrations);
    }

    private void validateRegistrationWindow(Competition competition) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime openAt = competition.getRegistrationOpen();
        LocalDateTime closeAt = resolveRegistrationClose(competition);

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

    private TeamResponseDTO toResponse(Team team) {
        List<String> invitedMemberIds = sanitizeIds(team.getInvitedMemberIds());
        List<String> acceptedMemberIds = sanitizeIds(team.getAcceptedMemberIds());
        List<String> pendingJoinRequestIds = sanitizeIds(team.getPendingJoinRequestIds());

        return new TeamResponseDTO(
                team.getTeamId(),
                team.getTeamName(),
                team.getCompetitionId(),
                team.getLeaderId(),
                invitedMemberIds,
                acceptedMemberIds,
                pendingJoinRequestIds,
                resolveUsername(team.getLeaderId()),
                invitedMemberIds.stream().map(this::resolveUsername).toList(),
                acceptedMemberIds.stream().map(this::resolveUsername).toList(),
                pendingJoinRequestIds.stream().map(this::resolveUsername).toList(),
                team.getStatus() != null ? team.getStatus().name() : null);
    }

    private List<String> sanitizeIds(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return ids.stream()
                .filter(v -> v != null && !v.isBlank())
                .distinct()
                .toList();
    }

    private String resolveUsername(String userId) {
        if (userId == null || userId.isBlank()) {
            return userId;
        }
        return userRepository.findById(userId)
                .map(user -> user.getUsername() != null && !user.getUsername().isBlank()
                        ? user.getUsername()
                        : userId)
                .orElse(userId);
    }

    public record TeammateProfileDTO(
            String id,
            String username,
            String fullName,
            String email,
            String phone,
            String avatarUrl,
            boolean leader) {
    }
}
