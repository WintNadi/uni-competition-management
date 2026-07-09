package com.project.Backend.Competition;

import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import com.project.Backend.Competition.dto.CompetitionResponse;
import com.project.Backend.Competition.dto.CreateCompetitionRequest;

public interface CompetitionService {

        CompetitionResponse createCompetition(
                        CreateCompetitionRequest request,
                        MultipartFile[] materials,
                        String userId,
                        String role);

        List<CompetitionResponse> getAllCompetitions(String userId, String role);

        CompetitionResponse getCompetitionById(String id, String userId, String role);

        CompetitionResponse updateCompetition(
                        String id,
                        CreateCompetitionRequest request,
                        MultipartFile[] materials);

        void publishCompetition(String id);

        void deleteCompetition(String id);

        void deleteCompetitionMaterial(String id);
}
