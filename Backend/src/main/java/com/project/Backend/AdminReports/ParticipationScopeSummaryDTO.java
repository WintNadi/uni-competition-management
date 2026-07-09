package com.project.Backend.AdminReports;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ParticipationScopeSummaryDTO {
    private long local;
    private long national;
    private long international;
}