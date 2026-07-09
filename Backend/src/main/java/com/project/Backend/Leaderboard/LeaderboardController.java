package com.project.Backend.Leaderboard;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping("/merit")
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> merit(
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "timePeriod", required = false, defaultValue = "all") String timePeriod,
            @RequestParam(value = "competitionType", required = false, defaultValue = "all") String competitionType) {
        return ResponseEntity.ok(leaderboardService.getMeritLeaderboard(limit, timePeriod, competitionType));
    }

    @GetMapping("/social")
    @PreAuthorize("hasRole('STUDENT') or hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<?> social(
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "timePeriod", required = false, defaultValue = "all") String timePeriod) {
        return ResponseEntity.ok(leaderboardService.getSocialLeaderboard(limit, timePeriod));
    }
}
