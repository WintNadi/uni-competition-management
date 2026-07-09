// ParticipationScopeItemDTO.java
package com.project.Backend.AdminReports;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ParticipationScopeItemDTO {
  private String competitionTitle;
  private String scope;          // LOCAL/NATIONAL/INTERNATIONAL
  private String resultLabel;     // Participant/Top 1/Runner-up...
  private LocalDateTime achievedAt;
  private String type;           // INTERNAL/EXTERNAL
}