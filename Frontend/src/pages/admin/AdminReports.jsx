import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  Trophy,
  Users,
  FileText,
  Award,
  Activity,
  PieChart,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";
import { toast } from "sonner";

const palette = [
  "bg-secondary",
  "bg-info",
  "bg-achievement",
  "bg-success",
  "bg-warning",
  "bg-muted-foreground",
];

// ---------------------------
// Helpers
// ---------------------------
function monthKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, m] = key.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleString("en-US", { month: "short" });
}

function startOfPeriod(period) {
  const now = new Date();
  const d = new Date(now);

  if (period === "week") {
    d.setDate(now.getDate() - 7);
    return d;
  }
  if (period === "month") {
    d.setMonth(now.getMonth() - 1);
    return d;
  }
  if (period === "quarter") {
    d.setMonth(now.getMonth() - 3);
    return d;
  }
  if (period === "year") {
    d.setFullYear(now.getFullYear() - 1);
    return d;
  }
  d.setMonth(now.getMonth() - 1);
  return d;
}

function inPeriod(dateValue, period) {
  if (!dateValue) return false;
  const t = new Date(dateValue).getTime();
  if (Number.isNaN(t)) return false;
  const start = startOfPeriod(period).getTime();
  return t >= start;
}

function normalizeResultLabel(labelRaw) {
  const label = String(labelRaw || "").trim().toLowerCase();
  if (!label) return "Participation";

  if (label === "participant" || label.includes("participation")) return "Participation";

  if (label.includes("runner") || label.includes("runner-up") || label.includes("runner up")) {
    return "Runner-up";
  }

  if (label.includes("champion") || label.includes("winner") || label.includes("1st")) {
    return "1st Place";
  }

  if (label.includes("top 1") || label === "top1" || label.includes("top-1")) return "1st Place";
  if (label.includes("top 2") || label === "top2" || label.includes("top-2")) return "2nd Place";
  if (label.includes("top 3") || label === "top3" || label.includes("top-3")) return "3rd Place";

  if (label.startsWith("top ")) return "Runner-up";

  if (label.includes("2nd") || label.includes("second")) return "2nd Place";
  if (label.includes("3rd") || label.includes("third")) return "3rd Place";

  return "Runner-up";
}

function titleCase(s) {
  const str = String(s || "").trim();
  if (!str) return "Other";
  if (str.toUpperCase() === str) {
    return str
      .toLowerCase()
      .split(/[\s_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return str;
}

function normalizeScope(scale) {
  if (!scale) return "LOCAL";
  const s = String(scale).toLowerCase();
  if (s.includes("international")) return "INTERNATIONAL";
  if (s.includes("national")) return "NATIONAL";
  return "LOCAL";
}

function friendlyMonthYear(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function fmtDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString();
}

function badgeScope(scope) {
  const s = String(scope || "").toUpperCase();
  if (s === "INTERNATIONAL") return "bg-info/10 text-info";
  if (s === "NATIONAL") return "bg-warning/10 text-warning";
  return "bg-secondary/10 text-secondary";
}

function badgeResult(label) {
  const r = normalizeResultLabel(label);
  if (r === "1st Place") return "bg-achievement/10 text-achievement";
  if (r === "2nd Place") return "bg-secondary/10 text-secondary";
  if (r === "3rd Place") return "bg-info/10 text-info";
  if (r === "Runner-up") return "bg-warning/10 text-warning";
  return "bg-muted/50 text-muted-foreground";
}

export default function AdminReports() {
  // DETAILS filters
  const [nameFilter, setNameFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM

  const [view, setView] = useState("overview");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [scopeDetails, setScopeDetails] = useState([]);
  const [scopeDetailsLoading, setScopeDetailsLoading] = useState(false);

  // NEW: expandable row
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  const [timePeriod, setTimePeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalAchievements: 0,
    totalParticipations: 0,
    attendanceRecoveries: 0,
    externalAchievements: 0,
    achievementGrowth: 0,
    participationGrowth: 0,
  });

  const [monthlyData, setMonthlyData] = useState([]);
  const [achievementBreakdown, setAchievementBreakdown] = useState([]);
  const [competitionTypes, setCompetitionTypes] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [attendanceRecoveries, setAttendanceRecoveries] = useState([]);
  // keep unfiltered list so we can apply user-specified start/end date filters
  const [rawAttendance, setRawAttendance] = useState([]);
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [scopeSummary, setScopeSummary] = useState(null);

  // ---------------------------
  // DETAILS loader
  // expects backend:
  // { studentId, studentName, total, awards, local, national, international, competitions: [] }
  // recommended extra field:
  // items: [{ competitionTitle, scope, resultLabel, achievedAt, type }]
  // ---------------------------
  const loadScopeDetails = async (scope, { q, month } = {}) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    setScopeDetailsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("scope", scope || "ALL");

      const qVal = (q ?? nameFilter).trim();
      const monthVal = month ?? monthFilter;

      if (qVal) qs.set("q", qVal);
      if (monthVal) qs.set("month", monthVal);

      const data = await fetchJsonCached(
        `${API_BASE_URL}/api/admin/reports/participation-scope/details?${qs.toString()}`,
        { token, ttlMs: 30000, cacheKey: `admin:reports:scopeDetails:${qs.toString()}` }
      );

      setScopeDetails(Array.isArray(data) ? data : []);
      setExpandedStudentId(null); // collapse on reload to avoid mismatches
    } catch (e) {
      toast.error(e?.message || "Failed to load scope details");
      setScopeDetails([]);
    } finally {
      setScopeDetailsLoading(false);
    }
  };

  // ---------------------------
  // OVERVIEW load (same as your logic)
  // expose a reusable loader so we can refresh when other parts of the app
  // (e.g. the approvals page) make changes.
  // ---------------------------

  const loadReports = async () => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [achievementsAll, competitions, meritTop, externalAll] = await Promise.all([
        fetchJsonCached(`${API_BASE_URL}/api/achievements`, {
          token,
          ttlMs: 60000,
          cacheKey: "admin:reports:achievements",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/competitions`, {
          token,
          ttlMs: 60000,
          cacheKey: "admin:reports:competitions",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/leaderboard/merit?limit=5`, {
          token,
          ttlMs: 60000,
          cacheKey: "admin:reports:merit-top",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/external/participations/admin?status=all&source=all`, {
          token,
          ttlMs: 60000,
          cacheKey: "admin:reports:external-participations",
        }),
      ]);

      const achievementsRaw = Array.isArray(achievementsAll) ? achievementsAll : [];
      const competitionsArr = Array.isArray(competitions) ? competitions : [];
      const externalArr = Array.isArray(externalAll) ? externalAll : [];

      const achievements = achievementsRaw.filter((a) => inPeriod(a.achievedAt, timePeriod));

      const compById = new Map();
      competitionsArr.forEach((c) => {
        const id = c?._id ?? c?.id;
        if (id) compById.set(String(id), c);
      });

      const externalById = new Map();
      externalArr.forEach((p) => {
        const id = p?._id ?? p?.id;
        if (id) externalById.set(String(id), p);
      });

      const awardedAchievements = achievements.filter(
        (a) => normalizeResultLabel(a.resultLabel) !== "Participation"
      );
      const totalAchievements = awardedAchievements.length;
      const totalParticipations = achievements.length;

      const externalAchievements = achievements.filter((a) => {
        if (a.externalParticipationId) return true;
        if (String(a.competitionType || "").toUpperCase() === "EXTERNAL") return true;
        const c = compById.get(String(a.competitionId));
        return String(c?.competitionType || "").toUpperCase() === "EXTERNAL";
      }).length;

// include any approved external participation since the requirement
        // is to surface the student immediately after approval. the report text
        // may not yet exist; that's fine, we'll show a placeholder later.
let attendanceList = externalArr.filter((ep) => ep.status === "approved");
        // sort latest-first by startDate (fallback to endDate)
        attendanceList.sort((a, b) => {
          const da = new Date(b.startDate || b.endDate || 0).getTime();
          const db = new Date(a.startDate || a.endDate || 0).getTime();
          return da - db;
        });
        const attendance = attendanceList.map((ep) => {
          // competition name typically in `competition` field from DTO
          let compName = ep.competition || "";
          if (!compName && ep.competitionId) {
            const linked = compById.get(String(ep.competitionId));
            compName = linked?.title || linked?.name || "";
          }
          if (!compName) compName = "-";

          const startRaw = ep.startDate || "";
          const endRaw = ep.endDate || "";
          const startFormatted = startRaw ? fmtDate(startRaw) : "";
          const endFormatted = endRaw ? fmtDate(endRaw) : "";

          return {
            student: ep.student?.name || "Student",
            competition: compName,
            // keep both a localized display string and the original ISO/raw value
            startDate: startFormatted,
            endDate: endFormatted,
            startIso: startRaw || "",
            endIso: endRaw || "",
            report: ep.attendanceRecoveryReport || "",
          };
        });
        setRawAttendance(attendance);
        setAttendanceRecoveries(attendance);

      const monthMap = new Map();
      achievements.forEach((a) => {
        const key = monthKey(a.achievedAt);
        if (!key) return;
        const cur = monthMap.get(key) || { achievements: 0, participations: 0 };
        if (normalizeResultLabel(a.resultLabel) !== "Participation") cur.achievements += 1;
        cur.participations += 1;
        monthMap.set(key, cur);
      });

      const sortedMonths = Array.from(monthMap.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .slice(-6);

      const monthly = sortedMonths.map(([key, value]) => ({
        month: monthLabel(key),
        achievements: value.achievements,
        participations: value.participations,
      }));

      let achievementGrowth = 0;
      let participationGrowth = 0;
      if (monthly.length >= 2) {
        const last = monthly[monthly.length - 1];
        const prev = monthly[monthly.length - 2];
        if (prev.achievements > 0) {
          achievementGrowth = ((last.achievements - prev.achievements) / prev.achievements) * 100;
        }
        if (prev.participations > 0) {
          participationGrowth =
            ((last.participations - prev.participations) / prev.participations) * 100;
        }
      }

      const order = ["1st Place", "2nd Place", "3rd Place", "Runner-up", "Participation"];
      const breakdownMap = new Map(order.map((k) => [k, 0]));
      achievements.forEach((a) => {
        const bucket = normalizeResultLabel(a.resultLabel);
        breakdownMap.set(bucket, (breakdownMap.get(bucket) || 0) + 1);
      });
      const totalBreakdown = Array.from(breakdownMap.values()).reduce((sum, n) => sum + n, 0) || 1;

      const breakdown = order.map((category) => {
        const count = breakdownMap.get(category) || 0;
        return {
          category,
          count,
          percentage: Math.round((count / totalBreakdown) * 1000) / 10,
        };
      });

      const participationKey = (a) => {
        if (a.externalParticipationId) return `ext:${a.externalParticipationId}`;
        if (a.teamId) return `team:${a.teamId}:${a.competitionId}`;
        if (a.submissionId) return `sub:${a.submissionId}`;
        return `ach:${a.achievementId || a._id || ""}`;
      };

      const uniqueParticipations = new Map();
      achievements.forEach((a) => uniqueParticipations.set(participationKey(a), a));

      const typeMap = new Map();
      uniqueParticipations.forEach((a) => {
        let rawType = "Other";

        if (a.externalParticipationId) {
          const ext = externalById.get(String(a.externalParticipationId));
          rawType = (ext?.category && String(ext.category).trim()) || "Other";
        } else {
          const c = compById.get(String(a.competitionId));
          rawType =
            (c?.category && String(c.category).trim()) ||
            (c?.format && String(c.format).trim()) ||
            (c?.competitionType && String(c.competitionType).trim()) ||
            "Other";
        }

        const key = titleCase(rawType);
        typeMap.set(key, (typeMap.get(key) || 0) + 1);
      });

      const types = Array.from(typeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count], index) => ({
          type,
          count,
          color: palette[index % palette.length],
        }));

      let local = 0,
        national = 0,
        international = 0;
      achievements.forEach((a) => {
        let scope = "LOCAL";
        if (a.externalParticipationId) {
          const ext = externalById.get(String(a.externalParticipationId));
          scope = normalizeScope(ext?.scale);
        } else {
          const c = compById.get(String(a.competitionId));
          scope = normalizeScope(c?.scale);
        }

        if (scope === "INTERNATIONAL") international++;
        else if (scope === "NATIONAL") national++;
        else local++;
      });
      setScopeSummary({ local, national, international });

      const meritArr = Array.isArray(meritTop) ? meritTop : [];
      const performers = meritArr.map((entry) => ({
        rank: entry.rank,
        name: entry.name,
        points: entry.points,
        achievements: entry.achievements,
      }));

      setStats({
        totalAchievements,
        totalParticipations,
        attendanceRecoveries: attendance.length,
        externalAchievements,
        achievementGrowth,
        participationGrowth,
      });

      setMonthlyData(monthly);
      setAchievementBreakdown(breakdown);
      setCompetitionTypes(types);
      setTopPerformers(performers);
      setAttendanceRecoveries(attendance);
    } catch (error) {
      toast.error(error?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadReports();
    return () => {
      mounted = false;
    };
  }, [timePeriod]);

  // apply user filter whenever the raw list or filters change
  useEffect(() => {
    if (!startDateFilter && !endDateFilter) {
      setAttendanceRecoveries(rawAttendance);
      return;
    }

    // parse a YYYY-MM-DD input into a local-date-only timestamp (midnight local)
    const parseDateInputToLocalMidnight = (s) => {
      if (!s) return null;
      try {
        const parts = String(s).split("-");
        if (parts.length === 3) {
          const y = Number(parts[0]);
          const m = Number(parts[1]) - 1;
          const d = Number(parts[2]);
          return new Date(y, m, d).getTime();
        }
        const asDate = new Date(s);
        if (isNaN(asDate.getTime())) return null;
        return new Date(asDate.getFullYear(), asDate.getMonth(), asDate.getDate()).getTime();
      } catch {
        return null;
      }
    };

    const toRecordDateOnlyTs = (recDateStr) => {
      if (!recDateStr) return NaN;
      const d = new Date(recDateStr);
      if (isNaN(d.getTime())) return NaN;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    const startTs = parseDateInputToLocalMidnight(startDateFilter);
    const endTs = parseDateInputToLocalMidnight(endDateFilter);

    const filtered = rawAttendance.filter((rec) => {
      let ok = true;
      if (startTs !== null) {
        const d = toRecordDateOnlyTs(rec.startIso || rec.startDate);
        ok = ok && !isNaN(d) && d >= startTs;
      }
      if (endTs !== null) {
        const d = toRecordDateOnlyTs(rec.endIso || rec.endDate);
        ok = ok && !isNaN(d) && d <= endTs;
      }
      return ok;
    });
    setAttendanceRecoveries(filtered);
  }, [rawAttendance, startDateFilter, endDateFilter]);

  // refresh overview whenever submissions are updated elsewhere
  // also listen for a specialized attendance event which arrives with the
  // new record so we can optimistically append it in-place.
  useEffect(() => {
    const handler = () => loadReports();
    const attendanceHandler = (e) => {
      const rec = e?.detail;
      if (rec) {
        setAttendanceRecoveries((prev) => [...prev, rec]);
        setStats((s) => ({
          ...s,
          attendanceRecoveries: (s.attendanceRecoveries || 0) + 1,
        }));
      }
    };

    window.addEventListener("submissions:updated", handler);
    window.addEventListener("attendance:approved", attendanceHandler);
    return () => {
      window.removeEventListener("submissions:updated", handler);
      window.removeEventListener("attendance:approved", attendanceHandler);
    };
  }, [timePeriod]);

  const maxAchievement = useMemo(
    () => (monthlyData.length ? Math.max(...monthlyData.map((d) => d.achievements || 0)) || 1 : 1),
    [monthlyData]
  );

  const maxParticipation = useMemo(
    () =>
      (monthlyData.length ? Math.max(...monthlyData.map((d) => d.participations || 0)) || 1 : 1),
    [monthlyData]
  );

  const handleExportExcel = () => {
    const headers = ["Student,Competition,Start Date,End Date,Report"];
    const rows = attendanceRecoveries.map((record) =>
      `"${record.student}","${record.competition}","${record.startDate}","${record.endDate}","${(record.report || "").replace(
        /"/g,
        '""'
      )}"`
    );

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `attendance_recovery_report_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attendance Recovery Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #333; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            p { color: #666; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 2px solid #ddd; padding: 12px; font-weight: 600; color: #444; }
            td { border-bottom: 1px solid #eee; padding: 12px; color: #555; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background-color: #ecfdf5; color: #059669; }
          </style>
        </head>
        <body>
          <h1>Attendance Recovery Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Competition</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceRecoveries
                .map(
                  (record) => `
                    <tr>
                      <td>${record.student}</td>
                      <td>${record.competition}</td>
                      <td>${record.startDate}</td>
                      <td>${record.endDate}</td>
                      <td><span class="badge">${(record.report || "")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")}</span></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  const detailsCaption = useMemo(() => {
    const parts = [];
    if (scopeFilter && scopeFilter !== "ALL") parts.push(scopeFilter.toLowerCase());
    if (monthFilter) parts.push(friendlyMonthYear(monthFilter));
    if (nameFilter.trim()) parts.push(`"${nameFilter.trim()}"`);
    return parts.length ? `Filters: ${parts.join(" • ")}` : "No filters applied";
  }, [scopeFilter, monthFilter, nameFilter]);

  return (
    <AppLayout role="admin">
      {view === "overview" ? (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                Reports & Analytics
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive insights based on achievements, participation, and attendance recovery
              </p>
            </div>

            <div className="flex gap-2">
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-40">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-static p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-achievement/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-achievement" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats.totalAchievements}</p>
                  <p className="text-xs text-muted-foreground">Total Achievements</p>
                </div>
              </div>
              {stats.achievementGrowth !== 0 && (
                <div className="flex items-center gap-1 text-success text-sm">
                  <TrendingUp className="w-4 h-4" />
                  {stats.achievementGrowth > 0 ? "+" : ""}
                  {stats.achievementGrowth.toFixed(1)}% from last period
                </div>
              )}
            </div>

            <div className="card-static p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats.totalParticipations}</p>
                  <p className="text-xs text-muted-foreground">Total Participations</p>
                </div>
              </div>
              {stats.participationGrowth !== 0 && (
                <div className="flex items-center gap-1 text-success text-sm">
                  <TrendingUp className="w-4 h-4" />
                  {stats.participationGrowth > 0 ? "+" : ""}
                  {stats.participationGrowth.toFixed(1)}% from last period
                </div>
              )}
            </div>

            <div className="card-static p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-info" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats.attendanceRecoveries}</p>
                  <p className="text-xs text-muted-foreground">Attendance Recoveries</p>
                </div>
              </div>
            </div>

            <div className="card-static p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Award className="w-5 h-5 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats.externalAchievements}</p>
                  <p className="text-xs text-muted-foreground">External Achievements</p>
                </div>
              </div>
            </div>
          </div>

          {/* Participation Scope */}
          <div className="card-static p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Participation Scope</h3>

              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={async () => {
                  setView("scopeDetails");
                  setScopeFilter("ALL");
                  await loadScopeDetails("ALL", { q: "", month: "" });
                }}
              >
                <FileText className="w-4 h-4" />
                Show Details
              </Button>
            </div>

            {scopeSummary ? (
              (() => {
                const local = Number(scopeSummary.local || 0);
                const national = Number(scopeSummary.national || 0);
                const international = Number(scopeSummary.international || 0);
                const total = local + national + international || 1;

                const rows = [
                  { label: "Local", value: local, bar: "bg-secondary/60" },
                  { label: "National", value: national, bar: "bg-warning/60" },
                  { label: "International", value: international, bar: "bg-info/60" },
                ];

                return (
                  <div className="space-y-4">
                    {rows.map((r) => {
                      const percent = Math.round((r.value / total) * 1000) / 10;
                      return (
                        <div key={r.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground font-medium">{r.label}</span>
                            <span className="text-muted-foreground">
                              {r.value} ({percent}%)
                            </span>
                          </div>

                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500", r.bar)}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                      Total Participations: {local + national + international}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-muted-foreground">Loading participation scope...</div>
            )}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <div className="card-static p-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-secondary" />
                  Monthly Trend
                </h2>
              </div>

              <div className="space-y-4">
                {monthlyData.map((data, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium w-12">{data.month}</span>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>🏆 {data.achievements}</span>
                        <span>👥 {data.participations}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 h-4">
                      <div
                        className="bg-achievement rounded-full transition-all duration-500"
                        style={{ width: `${(data.achievements / maxAchievement) * 40}%` }}
                      />
                      <div
                        className="bg-secondary/50 rounded-full transition-all duration-500"
                        style={{ width: `${(data.participations / maxParticipation) * 60}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-achievement" />
                  <span>Achievements</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary/50" />
                  <span>Participations</span>
                </div>
              </div>
            </div>

            {/* Achievement Breakdown */}
            <div className="card-static p-5">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-secondary" />
                  Achievement Breakdown
                </h2>
              </div>

              <div className="space-y-3">
                {achievementBreakdown.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.category}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          index === 0 && "bg-achievement",
                          index === 1 && "bg-secondary",
                          index === 2 && "bg-info",
                          index === 3 && "bg-warning",
                          index === 4 && "bg-muted-foreground"
                        )}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Competition Types & Top Performers */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card-static p-5">
              <h2 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-secondary" />
                Competition Types
              </h2>

              <div className="space-y-3">
                {competitionTypes.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={cn("w-4 h-4 rounded", item.color)} />
                    <span className="flex-1 text-sm">{item.type}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-static p-5">
              <h2 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-secondary" />
                Top Performers
              </h2>

              <div className="space-y-3">
                {topPerformers.map((performer) => (
                  <div
                    key={performer.rank}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        performer.rank === 1 && "bg-achievement/20 text-achievement",
                        performer.rank === 2 && "bg-secondary/20 text-secondary",
                        performer.rank === 3 && "bg-info/20 text-info",
                        performer.rank > 3 && "bg-muted text-muted-foreground"
                      )}
                    >
                      {performer.rank}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{performer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {performer.achievements} achievements
                      </p>
                    </div>
                    <span className="font-semibold text-secondary">{performer.points} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attendance Recovery Report */}
          <div className="card-static p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-secondary" />
                  Recent Attendance Recoveries
                </h2>
                <div className="flex gap-2 items-center">
                  <label className="text-xs">Start:</label>
                  <input
                    type="date"
                    className="input input-bordered input-sm"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                  />
                  <label className="text-xs">End:</label>
                  <input
                    type="date"
                    className="input input-bordered input-sm"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                  />
                  <Button size="sm" variant="outline" className="mr-2" onClick={() => { setStartDateFilter(""); setEndDateFilter(""); }}>
                    Clear
                  </Button>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export as Excel (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Student
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Competition
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Start Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      End Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecoveries.map((record, index) => (
                    <tr key={index} className="border-b border-border hover:bg-muted/30">
                      <td className="py-3 px-4 text-sm font-medium">{record.student}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{record.competition}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{record.startDate}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{record.endDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // ---------------------------
        // DETAILS VIEW (Expandable rows)
        // ---------------------------
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                Participation Scope Details
              </h1>
              <p className="text-muted-foreground mt-1">{detailsCaption}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView("overview")}>
                Back
              </Button>

              <Select
                value={scopeFilter}
                onValueChange={async (v) => {
                  setScopeFilter(v);
                  await loadScopeDetails(v);
                }}
              >
                <SelectTrigger className="w-44">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="LOCAL">Local</SelectItem>
                  <SelectItem value="NATIONAL">National</SelectItem>
                  <SelectItem value="INTERNATIONAL">International</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="card-static p-5">
            {scopeDetailsLoading ? (
              <div className="p-12 text-center text-muted-foreground">
                Loading participation scope details...
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Filter by student name..."
                    className="h-10 px-3 rounded-md border border-border bg-background text-sm"
                  />

                  <input
                    type="month"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="h-10 px-3 rounded-md border border-border bg-background text-sm"
                  />

                  <Button variant="outline" onClick={async () => loadScopeDetails(scopeFilter)}>
                    Apply
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={async () => {
                      setNameFilter("");
                      setMonthFilter("");
                      await loadScopeDetails(scopeFilter, { q: "", month: "" });
                    }}
                  >
                    Clear
                  </Button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                          Student
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                          Competitions
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                          Total
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                          Awards
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                          Local
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                          National
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                          International
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {scopeDetails.map((row, idx) => {
                        const isOpen = expandedStudentId === (row.studentId || idx);

                        const competitions = Array.isArray(row.competitions) ? row.competitions : [];
                        const items = Array.isArray(row.items) ? row.items : [];

                        const shownCount = items.length || competitions.length || 0;

                        const rowKey = row.studentId || idx;
                        return (
                          <Fragment key={`group-${rowKey}`}>
                            <tr
                              className="border-b border-border hover:bg-muted/30 cursor-pointer"
                              onClick={() => setExpandedStudentId(isOpen ? null : rowKey)}
                            >
                              <td className="py-3 px-4 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  {isOpen ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  )}
                                  <span>{row.studentName || "Student"}</span>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-sm text-muted-foreground">
                                {shownCount ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                                    {shownCount} {shownCount === 1 ? "record" : "records"}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>

                              <td className="py-3 px-4 text-sm text-muted-foreground">{row.total}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{row.awards}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{row.local}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{row.national}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">
                                {row.international}
                              </td>
                            </tr>
                            {isOpen ? (
                              <tr key={`details-${rowKey}`} className="border-b border-border">
                                <td colSpan={7} className="py-3 px-4">
                                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                                    {/* If backend provides items: show detailed table */}
                                    {items.length ? (
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b border-border">
                                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                                Competition
                                              </th>
                                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                                Type
                                              </th>
                                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                                Scope
                                              </th>
                                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                                Result
                                              </th>
                                              <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                                Date
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {items.map((it, i) => (
                                              <tr
                                                key={`${it.competitionTitle || "item"}-${it.achievedAt || i}-${i}`}
                                                className="border-b border-border/60"
                                              >
                                                <td className="py-2 px-2 text-sm font-medium">
                                                  {it.competitionTitle || "-"}
                                                </td>
                                                <td className="py-2 px-2 text-sm text-muted-foreground">
                                                  {it.type || "-"}
                                                </td>
                                                <td className="py-2 px-2 text-sm">
                                                  <span
                                                    className={cn(
                                                      "inline-flex px-2 py-1 rounded-md text-xs",
                                                      badgeScope(it.scope)
                                                    )}
                                                  >
                                                    {String(it.scope || "LOCAL").toUpperCase()}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-2 text-sm">
                                                  <span
                                                    className={cn(
                                                      "inline-flex px-2 py-1 rounded-md text-xs",
                                                      badgeResult(it.resultLabel)
                                                    )}
                                                  >
                                                    {normalizeResultLabel(it.resultLabel)}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-2 text-sm text-muted-foreground">
                                                  {fmtDate(it.achievedAt)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : competitions.length ? (
                                      // fallback: only have competition names
                                      <div className="flex flex-wrap gap-2">
                                        {competitions.map((c, i) => (
                                          <span
                                            key={`${rowKey}-competition-${i}`}
                                            className="inline-flex items-center px-2 py-1 rounded-md bg-background border border-border text-xs"
                                          >
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">
                                        No competition records for this student.
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}

                      {scopeDetails.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 px-4 text-center text-sm text-muted-foreground">
                            No data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
