package com.project.Backend.CompetitionRegistration.ResponseDTO;

import java.time.LocalDateTime;

import com.project.Backend.CompetitionRegistration.RegistrationStatus;

public record CompetitionRegistrationResponseDTO(

        String id,
        String competitionId,

        String studentId,
        String teamId,

        String username,
        String email,

        RegistrationStatus status,
        LocalDateTime registeredAt) {
}
