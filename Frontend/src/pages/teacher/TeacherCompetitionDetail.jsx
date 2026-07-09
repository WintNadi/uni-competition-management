import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Trophy, Users, Calendar, FileText, Edit,
  CheckCircle, Clock, Eye, BarChart3, Upload, Send, Trash2
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache, resolveFileUrl } from "@/lib/api";

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

// Keep status handling consistent with TeacherCompetitions
const mapStatusFromBackend = (status) => {
  if (!status) return "DRAFT";
  return String(status).toUpperCase();
};

const statusStyles = {
  PUBLISHED: { bg: "bg-success/10", text: "text-success", label: "Published" },
  DRAFT: { bg: "bg-warning/10", text: "text-warning", label: "Draft" },
  CLOSED: { bg: "bg-muted", text: "text-muted-foreground", label: "Closed" },
};

const formatStyles = {
  quiz: { bg: "bg-info/10", text: "text-info", label: "Quiz" },
  assignment: { bg: "bg-secondary/10", text: "text-secondary", label: "Assignment" },
  project: { bg: "bg-achievement/10", text: "text-achievement", label: "Project" },
};

const canEditCompetition = (competition) => {
  if (!competition?.registrationCloseAt) return true;
  const closeAt = new Date(competition.registrationCloseAt);
  if (Number.isNaN(closeAt.getTime())) return true;
  return new Date() < closeAt;
};

const canPublishCompetition = (competition) =>
  competition?.status === "DRAFT" && canEditCompetition(competition);

const canDeleteCompetition = (competition) => {
  if (!competition?.submissionDeadlineAt) return false;
  const deadline = new Date(competition.submissionDeadlineAt);
  if (Number.isNaN(deadline.getTime())) return false;
  return new Date() >= deadline;
};

export default function TeacherCompetitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoading(false);
      return;
    }
    const load = async (force = false) => {
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/competitions/${id}`, {
          token,
          ttlMs: 120000,
          force,
          cacheKey: `teacher:competition:detail:${id}`,
        });

        const mappedRules = Array.isArray(data.rules)
          ? data.rules
          : (typeof data.rules === "string" && data.rules.trim().length > 0
            ? data.rules.split("\n").map(r => r.trim()).filter(Boolean)
            : []);

        const mapped = {
          id: data.competitionId || data.id || id,
          title: data.title,
          description: data.description,
          format: mapFormatFromBackend(data.format),
          participationType: mapParticipationFromBackend(data.participationType),
          status: mapStatusFromBackend(data.status),
          registrationOpen: data.registrationOpen ? new Date(data.registrationOpen).toLocaleString() : "-",
          registrationClose: data.registrationClose ? new Date(data.registrationClose).toLocaleString() : "-",
          registrationCloseAt: data.registrationClose || data.registrationDeadline || null,
          submissionDeadline: data.submissionDeadline ? new Date(data.submissionDeadline).toLocaleString() : "-",
          submissionDeadlineAt: data.submissionDeadline || null,
          totalMarks: data.totalMarks ?? 0,
          rules: mappedRules,
          participants: 0,
          teams: null,
          pendingSubmissions: 0,
          evaluatedSubmissions: 0,
          materialsFiles: (() => {
            const names = Array.isArray(data.materialsFileNames)
              ? data.materialsFileNames
              : data.materialsFileName
                ? [data.materialsFileName]
                : [];
            const paths = Array.isArray(data.materialsFilePaths)
              ? data.materialsFilePaths
              : data.materialsFilePath
                ? [data.materialsFilePath]
                : [];
            return names.map((name, idx) => ({
              name: name || `Material ${idx + 1}`,
              path: paths[idx] || null,
            }));
          })(),
        };
        setCompetition(mapped);
      } catch (e) {
        toast.error("Unable to load competition");
      } finally {
        setLoading(false);
      }
    };

    load(false);
    const handleCompetitionUpdate = () => load(false);
    window.addEventListener("competitions:updated", handleCompetitionUpdate);
    return () => {
      window.removeEventListener("competitions:updated", handleCompetitionUpdate);
    };
  }, [id]);

  if (loading) {
    return (
      <AppLayout role="teacher">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading competition...</p>
        </div>
      </AppLayout>
    );
  }

  if (!competition) {
    return (
      <AppLayout role="teacher">
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Competition not found</h3>
          <Button onClick={() => navigate("/teacher/competitions")}>
            Back to Competitions
          </Button>
        </div>
      </AppLayout>
    );
  }

  const editable = canEditCompetition(competition);
  const publishable = canPublishCompetition(competition);
  const deletable = canDeleteCompetition(competition);

  const handlePublish = async () => {
    if (!publishable) {
      toast.error("Competition cannot be published after registration closes.");
      return;
    }
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      navigate("/login");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/competitions/${competition.id}/publish`, {
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
          || value.includes("teacher:competition:")
          || value.includes("competition:");
      });
      window.dispatchEvent(new CustomEvent("competitions:updated"));
      navigate("/teacher/competitions");
    } catch (e) {
      toast.error("Unable to publish competition");
    }
  };

  const handleDelete = async () => {
    if (!deletable) {
      toast.error("Competition can be deleted only after submission deadline.");
      return;
    }
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      navigate("/login");
      return;
    }
    if (!confirm("Are you sure you want to delete this competition? This action cannot be undone.")) return;
    try {
      const endpoints = [
        `${API_BASE_URL}/api/competitions/${competition.id}`,
        `${API_BASE_URL}/api/teacher/competitions/${competition.id}`,
      ];
      let deleted = false;
      let lastResp = null;
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          lastResp = res;
          if (res.ok) { deleted = true; break; }
          if (res.status === 404) continue;
          const ct = res.headers.get("content-type") || "";
          const body = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);
          toast.error((body && (body.message || JSON.stringify(body))) || `Failed to delete (${res.status})`);
          return;
        } catch (inner) {
          // try next
        }
      }
      if (!deleted) {
        if (lastResp) toast.error(`Failed to delete (${lastResp.status})`);
        else toast.error("Failed to delete competition");
        return;
      }
      toast.success("Competition deleted");
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/api/competitions")
          || value.includes("competitions:")
          || value.includes("teacher:competition:")
          || value.includes("competition:");
      });
      window.dispatchEvent(new CustomEvent("competitions:updated"));
      navigate("/teacher/competitions");
    } catch (e) {
      toast.error("Unable to delete competition");
    }
  };

  
  return (
    <AppLayout role="teacher">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/teacher/competitions")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Competitions
        </Button>

        {/* Header */}
        <div className="card-static p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                  {competition.title}
                </h1>
                <span
                  className={cn(
                    "badge-status text-xs",
                    statusStyles[competition.status]?.bg ?? "bg-muted",
                    statusStyles[competition.status]?.text ?? "text-muted-foreground"
                  )}
                >
                  {statusStyles[competition.status]?.label ?? competition.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={cn("badge-status text-xs", formatStyles[competition.format].bg, formatStyles[competition.format].text)}>
                  {formatStyles[competition.format].label}
                </span>
                <span className="badge-status text-xs bg-muted text-muted-foreground">
                  {competition.participationType === "team" ? "Team" : "Individual"}
                </span>
              </div>
              <p className="text-muted-foreground">{competition.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {competition.status !== "CLOSED" && editable && (
                <Button variant="outline" className="gap-2" asChild>
                  <Link to={`/teacher/competitions/${competition.id}/edit`}>
                    <Edit className="w-4 h-4" />
                    Edit
                  </Link>
                </Button>
              )}
              {competition.format === "quiz" && (
                <Button variant="outline" className="gap-2" asChild>
                  <Link to={`/teacher/competitions/${competition.id}/questions`}>
                    <FileText className="w-4 h-4" />
                    Manage Questions
                  </Link>
                </Button>
              )}
              {publishable && (
                <Button className="gap-2" onClick={handlePublish}>
                  <Send className="w-4 h-4" />
                  Publish
                </Button>
              )}
              <Button variant="destructive" className="gap-2" onClick={handleDelete} disabled={!deletable}>
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
          {!editable && (
            <p className="text-sm text-warning mt-4">
              Editing is locked because registration has already closed.
            </p>
          )}
          {!deletable && (
            <p className="text-sm text-muted-foreground mt-2">
              Delete is available only after submission deadline.
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-static p-4 text-center">
            <Users className="w-6 h-6 text-secondary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{competition.participants}</p>
            <p className="text-sm text-muted-foreground">Participants</p>
          </div>
          {competition.teams && (
            <div className="card-static p-4 text-center">
              <Users className="w-6 h-6 text-info mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{competition.teams}</p>
              <p className="text-sm text-muted-foreground">Teams</p>
            </div>
          )}
          <div className="card-static p-4 text-center">
            <Clock className="w-6 h-6 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{competition.pendingSubmissions}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="card-static p-4 text-center">
            <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{competition.evaluatedSubmissions}</p>
            <p className="text-sm text-muted-foreground">Evaluated</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="card-static p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Timeline</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-5 h-5 text-secondary" />
              <div>
                <p className="text-sm text-muted-foreground">Registration Opens</p>
                <p className="font-medium text-foreground">{competition.registrationOpen}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-5 h-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Registration Closes</p>
                <p className="font-medium text-foreground">{competition.registrationClose}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Submission Deadline</p>
                <p className="font-medium text-foreground">{competition.submissionDeadline}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rules */}
        {competition.rules && (
          <div className="card-static p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Rules & Guidelines</h3>
            <ul className="space-y-2">
              {competition.rules.map((rule, index) => (
                <li key={index} className="flex items-start gap-2 text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Materials */}
        <div className="card-static p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Materials</h3>
          {competition.materialsFiles && competition.materialsFiles.length > 0 ? (
            <div className="space-y-2">
              {competition.materialsFiles.map((file, idx) => (
                <div key={`${file.path || file.name}-${idx}`} className="flex items-center gap-2">
                  <a
                    href={file.path ? resolveFileUrl(file.path) : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline truncate"
                  >
                    {file.name}
                  </a>
                  <span className="text-sm text-muted-foreground">(Click to download)</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No materials provided for this competition.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card-static p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to={`/teacher/submissions?competition=${competition.id}`}>
                <Upload className="w-5 h-5" />
                <span>View Submissions</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link to="/teacher/leaderboard">
                <BarChart3 className="w-5 h-5" />
                <span>View Leaderboard</span>
              </Link>
            </Button>
            {competition.format === "quiz" && (
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to={`/teacher/competitions/${competition.id}/questions`}>
                  <FileText className="w-5 h-5" />
                  <span>Manage Questions</span>
                </Link>
              </Button>
            )}
            {editable && (
              <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                <Link to={`/teacher/competitions/${competition.id}/edit`}>
                  <Edit className="w-5 h-5" />
                  <span>Edit Competition</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
