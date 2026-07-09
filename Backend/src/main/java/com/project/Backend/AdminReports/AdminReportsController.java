package com.project.Backend.AdminReports;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
@CrossOrigin
public class AdminReportsController {

    private final ParticipationScopeReportService service;

    @GetMapping("/participation-scope/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ParticipationScopeSummaryDTO getSummary() {
        return service.getSummary();
    }

    @GetMapping("/participation-scope/details")
@PreAuthorize("hasRole('ADMIN')")
public List<ParticipationScopeStudentDTO> getDetails(
        @RequestParam(defaultValue = "ALL") String scope,
        @RequestParam(required = false) String q,           //  name filter
        @RequestParam(required = false) String month        //  "YYYY-MM"
) {
    return service.getDetails(scope, q, month);
}
}