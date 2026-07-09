import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Trophy, Users, FileText, PlusCircle, Calendar, 
  Eye, Edit, Trash2, Search, Filter, ChevronDown,
  CheckCircle, Clock, AlertCircle, MoreVertical
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache } from "@/lib/api";

const mapFormatFromBackend = (format) => {
  if (!format) return "project";
  // Backend serializes CompetitionFormat as lowercase strings via @JsonProperty
  switch (String(format).toLowerCase()) {
    case "quiz":
      return "quiz";
    case "assignment":
      return "assignment";
    case "project":
      return "project";
    default:
      return "project";
  }
};

const mapParticipationFromBackend = (type) => {
  if (!type) return "individual";
  switch (type) {
    case "INDIVIDUAL":
      return "individual";
    case "TEAM":
      return "team";
    default:
      return "individual";
  }
};

const statusStyles = {
  PUBLISHED: { bg: "bg-success/10", text: "text-success", label: "Published" },
  DRAFT: { bg: "bg-warning/10", text: "text-warning", label: "Draft" },
  CLOSED: { bg: "bg-muted", text: "text-muted-foreground", label: "Closed" },
};

const mapStatusFromBackend = (status) => {
  if (!status) return "DRAFT";
  return String(status).toUpperCase();
};

const formatStyles = {
  quiz: { bg: "bg-info/10", text: "text-info", label: "Quiz" },
  assignment: { bg: "bg-secondary/10", text: "text-secondary", label: "Assignment" },
  project: { bg: "bg-achievement/10", text: "text-achievement", label: "Project" },
};

const canEditCompetition = (competition) => {
  if (!competition) return false;
  const closeAtValue = competition.registrationCloseAt;
  if (!closeAtValue) return true;
  const closeAt = new Date(closeAtValue);
  if (Number.isNaN(closeAt.getTime())) return true;
  return new Date() < closeAt;
};

const canPublishCompetition = (competition) =>
  competition?.status === "DRAFT" && canEditCompetition(competition);

export default function TeacherCompetitions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const toTimestamp = (value) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoading(false);
      return;
    }
    const load = async (force = false) => {
      try {
        const [competitionsData, submissionsData] = await Promise.all([
          fetchJsonCached(`${API_BASE_URL}/api/competitions`, {
            token,
            ttlMs: 120000,
            force,
            cacheKey: "teacher:competitions:list",
          }),
          fetchJsonCached(`${API_BASE_URL}/teacher/submissions`, {
            token,
            ttlMs: 120000,
            force,
            cacheKey: "teacher:submissions:all",
          }).catch(() => []),
        ]);

        const submissionsList = Array.isArray(submissionsData) ? submissionsData : [];
        const countsByCompetition = submissionsList.reduce((acc, item) => {
          const competitionId = item?.competitionId;
          if (!competitionId) return acc;
          const key = String(competitionId);
          if (!acc[key]) {
            acc[key] = { pending: 0, evaluated: 0, total: 0 };
          }
          acc[key].total += 1;
          if (String(item?.submissionStatus || "").toUpperCase() === "EVALUATED") {
            acc[key].evaluated += 1;
          } else {
            acc[key].pending += 1;
          }
          return acc;
        }, {});

        const data = Array.isArray(competitionsData) ? competitionsData : [];
        const mapped = data.map((c, index) => {
          const id = c.competitionId || c.id || null;
          const stat = countsByCompetition[String(id)] || { pending: 0, evaluated: 0, total: 0 };
          return {
          id,
          _key: id || `competition-${index}-${c.title || "untitled"}`,
          title: c.title,
          description: c.description,
          format: mapFormatFromBackend(c.format),
          participationType: mapParticipationFromBackend(c.participationType),
          status: mapStatusFromBackend(c.status),
          registrationOpen: c.registrationOpen ? new Date(c.registrationOpen).toLocaleString() : "-",
          registrationClose: c.registrationClose ? new Date(c.registrationClose).toLocaleString() : "-",
          registrationCloseAt: c.registrationClose || c.registrationDeadline || null,
          submissionDeadline: c.submissionDeadline ? new Date(c.submissionDeadline).toLocaleString() : "-",
          submissionDeadlineAt: c.submissionDeadline || null,
          totalMarks: c.totalMarks ?? 0,
          participants: c.participants || stat.total,
          teams: null,
          pendingSubmissions: stat.pending,
          evaluatedSubmissions: stat.evaluated,
          createdAt: c.createdAt || c.publishDate || c.registrationOpen || c.submissionDeadline || null,
          };
        });
        mapped.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
        setCompetitions(mapped);
      } catch (e) {
        toast.error("Unable to load competitions");
      } finally {
        setLoading(false);
      }
    };
    load();
    const handleCompetitionUpdate = () => load(false);
    window.addEventListener("competitions:updated", handleCompetitionUpdate);
    window.addEventListener("submissions:updated", handleCompetitionUpdate);
    return () => {
      window.removeEventListener("competitions:updated", handleCompetitionUpdate);
      window.removeEventListener("submissions:updated", handleCompetitionUpdate);
    };
  }, []);

  const filteredCompetitions = competitions.filter(comp => {
    const matchesSearch = comp.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || comp.status === statusFilter.toUpperCase();
    const matchesFormat = formatFilter === "all" || comp.format === formatFilter;
    return matchesSearch && matchesStatus && matchesFormat;
  });

  const handlePublish = async (id) => {
    const targetCompetition = competitions.find((item) => item.id === id);
    if (targetCompetition && !canPublishCompetition(targetCompetition)) {
      toast.error("Competition cannot be published after registration closes.");
      return;
    }
    if (!id) {
      toast.error("Competition ID is missing. Please refresh and try again.");
      return;
    }
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/competitions/${id}/publish`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let msg = "Failed to publish competition";
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            msg = data.message || msg;
          } else {
            msg = await res.text() || msg;
          }
        } catch {}
        toast.error(msg);
        return;
      }
      toast.success("Competition published successfully");
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/api/competitions")
          || value.includes("competitions:")
          || value.includes("teacher:competitions:")
          || value.includes("competition:");
      });
      window.dispatchEvent(new CustomEvent("competitions:updated"));
      setCompetitions(prev =>
        prev.map((c) =>
          c.id === id ? { ...c, status: "PUBLISHED" } : c
        )
      );
    } catch (e) {
      toast.error("Unable to publish competition");
    }
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      // remove locally as fallback
      setCompetitions(prev => prev.filter(c => c.id !== id));
      toast.success("Competition removed locally");
      return;
    }
    if (!confirm("Are you sure you want to delete this competition? This action cannot be undone.")) return;
    try {
      // try teacher-scoped endpoint first, then generic competitions endpoint
        const endpoints = [
        `${API_BASE_URL}/api/competitions/${id}`,
        `${API_BASE_URL}/api/teacher/competitions/${id}`,
      ];
      let deleted = false;
      let lastResp = null;
      for (const ep of endpoints) {
        const res = await fetch(ep, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        lastResp = res;
        if (res.ok) {
          deleted = true;
          break;
        }
        // try next endpoint when 404
        if (res.status === 404) continue;
        // otherwise capture error message and stop
        try {
          const ct = res.headers.get("content-type") || "";
          const body = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);
          toast.error(body && (body.message || JSON.stringify(body)) ? (body.message || JSON.stringify(body)) : `Failed to delete (${res.status})`);
        } catch {
          toast.error(`Failed to delete (${res.status})`);
        }
        return;
      }
      if (!deleted) {
        if (lastResp) {
          toast.error(`Failed to delete (${lastResp.status})`);
        } else {
          toast.error("Failed to delete competition");
        }
        return;
      }
      setCompetitions(prev => prev.filter(c => c.id !== id));
      toast.success("Competition deleted");
    } catch (e) {
      toast.error("Unable to delete competition");
    }
  };

  return (
    <AppLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              My Competitions
            </h1>
            <p className="text-muted-foreground mt-1">
              Create, manage, and track all your academic competitions
            </p>
          </div>
          <Button className="gap-2" asChild>
            <Link to="/teacher/competitions/create">
              <PlusCircle className="w-4 h-4" />
              Create Competition
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="card-static p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search competitions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Formats</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
                <option value="project">Project</option>
              </select>
            </div>
          </div>
        </div>

        {/* Competitions Grid */}
        <div className="grid gap-4">
          {loading && (
            <div className="card-static p-6 text-center text-muted-foreground">
              Loading competitions...
            </div>
          )}
          {!loading && filteredCompetitions.map((comp) => {
            const isEditable = canEditCompetition(comp);
            const isPublishable = canPublishCompetition(comp);
            return (
            <div key={comp._key} className="card-static p-5 hover:shadow-md transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">{comp.title}</h3>
                    <span className={cn("badge-status text-xs", statusStyles[comp.status]?.bg, statusStyles[comp.status]?.text)}>
                      {statusStyles[comp.status]?.label || comp.status}
                    </span>
                    <span className={cn("badge-status text-xs", formatStyles[comp.format].bg, formatStyles[comp.format].text)}>
                      {formatStyles[comp.format].label}
                    </span>
                    <span className="badge-status text-xs bg-muted text-muted-foreground">
                      {comp.participationType === "team" ? "Team" : "Individual"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{comp.description}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Participants</p>
                      <p className="font-semibold text-foreground flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {comp.participants}
                        {comp.teams && <span className="text-muted-foreground">({comp.teams} teams)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Marks</p>
                      <p className="font-semibold text-foreground">{comp.totalMarks}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Deadline</p>
                      <p className="font-semibold text-foreground flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {comp.submissionDeadline}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Submissions</p>
                      <div className="flex items-center gap-2">
                        {comp.pendingSubmissions > 0 && (
                          <span className="text-warning font-semibold flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {comp.pendingSubmissions} pending
                          </span>
                        )}
                        <span className="text-success font-semibold flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          {comp.evaluatedSubmissions} done
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex lg:flex-col gap-2">
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <Link to={`/teacher/competitions/${comp.id}`}>
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </Button>
                  {isEditable && comp.status !== "CLOSED" && (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <Link to={`/teacher/competitions/${comp.id}/edit`}>
                        <Edit className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </Link>
                    </Button>
                  )}
                  {comp.format === "quiz" && (
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <Link to={`/teacher/competitions/${comp.id}/questions`}>
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">Questions</span>
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <Link to={`/teacher/submissions?competition=${comp.id}`}>
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Submissions</span>
                    </Link>
                  </Button>
                  {isPublishable && (
                    <Button size="sm" className="gap-2" onClick={() => handlePublish(comp.id)}>
                      Publish
                    </Button>
                  )}
                  {/* Delete removed from list view per request */}
                </div>
              </div>
            </div>
          )})}
        </div>

        {!loading && filteredCompetitions.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No competitions found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your filters or create a new competition</p>
            <Button asChild>
              <Link to="/teacher/competitions/create">
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Competition
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
