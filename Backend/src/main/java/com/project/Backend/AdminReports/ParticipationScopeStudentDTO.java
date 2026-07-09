package com.project.Backend.AdminReports;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ParticipationScopeStudentDTO {
    private String studentId;
    private String studentName;      // new
    private long total;
    private long awards;
    private long local;
    private long national;
    private long international;
    private List<String> competitions; // new (unique competition titles)
    private List<ParticipationScopeItemDTO> items;
}