import { useEffect, useState } from "react";
import {
  Trophy, Users, FileText, PlusCircle, Upload,
  Calendar, TrendingUp, Eye, Edit, Trash2, ChevronRight,
  Clock, CheckCircle, AlertCircle, BarChart3
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";
import { formatReadableDateTime } from "@/lib/date";

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

const mapStatusFromBackend = (status) => {
  if (!status) return "draft";
  const upper = String(status).toUpperCase();
  switch (upper) {
    case "PUBLISHED":
      return "published";
    case "CLOSED":
      return "closed";
    case "DRAFT":
    default:
      return "draft";
  }
};

const statusStyles = {
  published: "bg-success/10 text-success",
  draft: "bg-warning/10 text-warning",
  closed: "bg-muted text-muted-foreground",
};

const formatStyles = {
  quiz: "bg-info/10 text-info",
  assignment: "bg-secondary/10 text-secondary",
  project: "bg-achievement/10 text-achievement",
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const mapSubmissionTypeLabel = (type) => {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "QUIZ") return "quiz";
  if (normalized === "PROJECT") return "project";
  if (normalized === "ASSIGNMENT") return "assignment";
  return "submission";
};

const isSubmissionPending = (status) =>
  String(status || "").toUpperCase() !== "EVALUATED";

export default function TeacherDashboard() {
  const [userName, setUserName] = useState(
    typeof window !== "undefined" ? (localStorage.getItem("userName") || "Teacher") : "Teacher"
  );
  const [competitions, setCompetitions] = useState([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loadingRecentActivities, setLoadingRecentActivities] = useState(true);
  const [pendingReviews, setPendingReviews] = useState({
    submissions: 0,
    competitions: 0,
  });

  const canEditCompetition = (competition) => {
    const closeAtValue = competition?.registrationCloseAt;
    if (!closeAtValue) return true;
    const closeAt = new Date(closeAtValue);
    if (Number.isNaN(closeAt.getTime())) return true;
    return new Date() < closeAt;
  };

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) return;
    const loadProfile = async () => {
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/users/me`, {
          token,
          ttlMs: 180000,
          cacheKey: "users:me",
        });
        if (data && data.fullName) {
          setUserName(data.fullName);
        }
      } catch {}
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      setLoadingCompetitions(false);
      setLoadingRecentActivities(false);
      setRecentActivities([]);
      setPendingReviews({ submissions: 0, competitions: 0 });
      return;
    }
    const load = async (force = false) => {
      setLoadingCompetitions(true);
      setLoadingRecentActivities(true);
      try {
        const [competitionsData, submissionsData] = await Promise.all([
          fetchJsonCached(`${API_BASE_URL}/api/competitions`, {
            token,
            ttlMs: 120000,
            force,
            cacheKey: "teacher:competitions:dashboard",
          }),
          fetchJsonCached(`${API_BASE_URL}/teacher/submissions`, {
            token,
            ttlMs: 120000,
            force,
            cacheKey: "teacher:submissions:dashboard",
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
          if (isSubmissionPending(item?.submissionStatus)) {
            acc[key].pending += 1;
          } else {
            acc[key].evaluated += 1;
          }
          return acc;
        }, {});

        const mapped = (Array.isArray(competitionsData) ? competitionsData : []).map((c) => {
          const competitionId = c.competitionId || c.id;
          const submissionStats = countsByCompetition[String(competitionId)] || {
            pending: 0,
            evaluated: 0,
            total: 0,
          };
          const submissionDeadline = c.submissionDeadline ? new Date(c.submissionDeadline) : null;
          const registrationOpen = c.registrationOpen ? new Date(c.registrationOpen) : null;

          return {
            id: competitionId,
            title: c.title,
            format: mapFormatFromBackend(c.format),
            participationType: mapParticipationFromBackend(c.participationType),
            status: mapStatusFromBackend(c.status),
            participants: Number(c.participants) || submissionStats.total,
            teams: null,
            deadline: submissionDeadline ? submissionDeadline.toLocaleDateString() : "-",
            submissionDeadline,
            registrationOpen,
            registrationCloseAt: c.registrationClose || c.registrationDeadline || null,
            questions: null,
            totalMarks: c.totalMarks ?? 0,
            pendingSubmissions: submissionStats.pending,
            createdAt: c.createdAt || null,
            publishDate: c.publishDate || null,
            sortDate: c.createdAt || c.publishDate || c.registrationOpen || c.submissionDeadline || null,
          };
        });

        mapped.sort((a, b) => toTimestamp(b.sortDate) - toTimestamp(a.sortDate));
        setCompetitions(mapped);

        const pendingSubmissions = submissionsList.filter((item) =>
          isSubmissionPending(item?.submissionStatus)
        );
        const pendingCompetitionCount = new Set(
          pendingSubmissions
            .map((item) => String(item?.competitionId || ""))
            .filter(Boolean)
        ).size;

        setPendingReviews({
          submissions: pendingSubmissions.length,
          competitions: pendingCompetitionCount,
        });

        const competitionTitleById = new Map(
          mapped
            .filter((item) => item?.id)
            .map((item) => [String(item.id), item.title || "Competition"])
        );

        const submissionActivities = submissionsList
          .filter((item) => item?.submittedAt)
          .map((item, index) => {
            const competitionTitle =
              competitionTitleById.get(String(item?.competitionId || "")) || "Competition";
            const actor = item?.isTeamSubmission
              ? (item?.teamName || "A team")
              : (item?.submittedBy || "A participant");
            const submissionType = mapSubmissionTypeLabel(item?.submissionType);
            return {
              id: item?.submissionId || `submission-${index}`,
              text: `${actor} submitted ${submissionType} for ${competitionTitle}`,
              timestamp: item.submittedAt,
              type: "submission",
            };
          });

        const competitionActivities = mapped
          .map((item, index) => {
            const eventAt = item.publishDate || item.createdAt;
            if (!eventAt) return null;

            const isPublishedEvent = item.status === "published" && !!item.publishDate;
            return {
              id: `competition-${item.id || index}`,
              text: isPublishedEvent
                ? `${item.title} was published`
                : `${item.title} was created`,
              timestamp: eventAt,
              type: isPublishedEvent ? "publish" : "update",
            };
          })
          .filter(Boolean);

        const mergedActivities = [...submissionActivities, ...competitionActivities]
          .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp))
          .slice(0, 6);
        setRecentActivities(mergedActivities);
      } catch {
        toast.error("Unable to load competitions");
        setRecentActivities([]);
        setPendingReviews({ submissions: 0, competitions: 0 });
      } finally {
        setLoadingCompetitions(false);
        setLoadingRecentActivities(false);
      }
    };
    load(false);
    const handleCompetitionUpdate = () => load(false);
    window.addEventListener("competitions:updated", handleCompetitionUpdate);
    window.addEventListener("submissions:updated", handleCompetitionUpdate);
    return () => {
      window.removeEventListener("competitions:updated", handleCompetitionUpdate);
      window.removeEventListener("submissions:updated", handleCompetitionUpdate);
    };
  }, []);

  // Derived stats and upcoming deadlines based on competitions
  const DeadlineNow = new Date();
  
  const upcomingDeadlinesDerived = competitions
    .filter((c) => {
      // Only consider published competitions with a valid future submission deadline
      if (c.status !== "published") return false;
      if (!c.submissionDeadline) return false;
      return c.submissionDeadline > DeadlineNow;
    })
    .map((c) => {
      const diffMs = c.submissionDeadline.getTime() - DeadlineNow.getTime();
      
      const totalSeconds = Math.floor(diffMs / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      const totalDays = Math.floor(totalHours / 24);

      let timeLeftLabel = "";

      if (totalDays > 0) {
        timeLeftLabel = `${totalDays} day${totalDays > 1 ? "s" : ""} left`;
      } else if (totalHours > 0) {
        timeLeftLabel = `${totalHours} hr${totalHours > 1 ? "s" : ""} left`;
      } else if (totalMinutes > 0) {
        timeLeftLabel = `${totalMinutes} min${totalMinutes > 1 ? "s" : ""} left`;
      } else {
        timeLeftLabel = `${totalSeconds} sec${totalSeconds > 1 ? "s" : ""} left`;
      }
      return {
        title: c.title,
        deadlineLabel: c.submissionDeadline.toLocaleDateString(),
        timeLeftLabel,
        diffMs
      };
    })
    .sort((a, b) => a.diffMs - b.diffMs) // nearest first
    .slice(0, 5);

  const now = new Date();

  const activeCompetitionsCount = competitions.filter((c) => {
    // Treat "active" as published competitions whose registered dates are opened
    if (c.status !== "published") return false;
    if (!c.registrationOpen) return false;
    return c.registrationOpen <= now;
  }).length;

  const upcomingDeadlinesCount = upcomingDeadlinesDerived.length;
  const hasPendingReviews = pendingReviews.submissions > 0;

  const stats = [
    {
      icon: Trophy,
      label: "Active Competitions",
      value: String(activeCompetitionsCount),
      trend: "",
    },
    {
      icon: Users,
      label: "Total Participants",
      value: "0",
      trend: "",
    },
    {
      icon: FileText,
      label: "Pending Submissions",
      value: String(pendingReviews.submissions),
      trend: "",
    },
    {
      icon: Calendar,
      label: "Upcoming Deadlines",
      value: String(upcomingDeadlinesCount),
      trend: upcomingDeadlinesDerived[0]
        ? `Next: ${upcomingDeadlinesDerived[0].deadlineLabel}`
        : "",
    },
  ];
  return (
    <AppLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Welcome back, {userName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your competitions and track participant progress
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/teacher/submissions">
                <FileText className="w-4 h-4" />
                Review Submissions
              </Link>
            </Button>
            <Button className="gap-2" asChild>
              <Link to="/teacher/competitions/create">
                <PlusCircle className="w-4 h-4" />
                Create Competition
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="card-static p-4">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-secondary" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                {stat.trend && (
                  <p className="text-xs text-secondary mt-1">{stat.trend}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Competitions List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg">My Competitions</h2>
                <Button variant="outline" size="sm" className="gap-1" asChild>
                  <Link to="/teacher/competitions">
                    View All <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
              
              <div className="space-y-3">
                {loadingCompetitions && (
                  <div className="text-sm text-muted-foreground py-3">
                    Loading competitions...
                  </div>
                )}
                {!loadingCompetitions && competitions.slice(0, 4).map((comp) => (
                  <div 
                    key={comp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{comp.title}</h3>
                        <span className={cn("badge-status text-xs", statusStyles[comp.status])}>
                          {comp.status}
                        </span>
                        <span className={cn("badge-status text-xs", formatStyles[comp.format])}>
                          {comp.format}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {comp.participants} participants
                        </span>
                        {comp.teams && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {comp.teams} teams
                          </span>
                        )}
                        {comp.questions && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {comp.questions} questions
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {comp.deadline}
                        </span>
                        {comp.pendingSubmissions > 0 && (
                          <span className="flex items-center gap-1 text-warning">
                            <AlertCircle className="w-3 h-3" />
                            {comp.pendingSubmissions} pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon-sm" asChild>
                        <Link to={`/teacher/competitions/${comp.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                      {canEditCompetition(comp) && (
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link to={`/teacher/competitions/${comp.id}/edit`}>
                            <Edit className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                      {comp.format === "quiz" && (
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link to={`/teacher/competitions/${comp.id}/questions`}>
                            <FileText className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                      {/* <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" /> 
                      </Button> */}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className="card-static p-5">
              <h2 className="font-display font-semibold text-lg mb-4">Upcoming Deadlines</h2>
              <div className="space-y-3">
                {upcomingDeadlinesDerived.length === 0 && !loadingCompetitions && (
                  <p className="text-sm text-muted-foreground">
                    No upcoming deadlines.
                  </p>
                )}
                {upcomingDeadlinesDerived.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        item.diffMs <= 3 * 24 * 60 * 60 * 1000 ? "bg-destructive/10" : "bg-secondary/10"
                      )}>
                        <Clock className={cn(
                          "w-5 h-5",
                          item.diffMs <= 3 * 24 * 60 * 60 * 1000 ? "text-destructive" : "text-secondary"
                        )} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Submission deadline: {item.deadlineLabel}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-sm font-medium px-3 py-1 rounded-full",
                      item.diffMs <= 3 * 24 * 60 * 60 * 1000
                        ? "bg-destructive/10 text-destructive" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {item.timeLeftLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="card-static p-5">
              <h2 className="font-display font-semibold text-lg mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-3" asChild>
                  <Link to="/teacher/competitions/create">
                    <PlusCircle className="w-5 h-5 text-secondary" />
                    Create New Competition
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" asChild>
                  <Link to="/teacher/questions">
                    <Upload className="w-5 h-5 text-secondary" />
                    Upload Questions (Excel)
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" asChild>
                  <Link to="/teacher/questions">
                    <FileText className="w-5 h-5 text-secondary" />
                    Add Question Manually
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" asChild>
                  <Link to="/teacher/submissions">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                    Review Submissions
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" asChild>
                  <Link to="/teacher/leaderboard">
                    <BarChart3 className="w-5 h-5 text-secondary" />
                    View Leaderboard
                  </Link>
                </Button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card-static p-5">
              <h2 className="font-display font-semibold text-lg mb-4">Recent Activity</h2>
              <div className="space-y-3 text-sm">
                {loadingRecentActivities && (
                  <p className="text-sm text-muted-foreground">Loading recent activity...</p>
                )}
                {!loadingRecentActivities && recentActivities.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                )}
                {!loadingRecentActivities && recentActivities.map((activity, index) => (
                  <div
                    key={activity.id || index}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                      activity.type === "submission" ? "bg-info" :
                      activity.type === "publish" ? "bg-secondary" : "bg-warning"
                    )} />
                    <div>
                      <p className="text-foreground">{activity.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatReadableDateTime(activity.timestamp, { fallback: "-" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Reviews Alert */}
            <div className={cn(
              "card-static p-5 border-l-4",
              hasPendingReviews ? "border-l-warning" : "border-l-success"
            )}>
              <div className="flex items-start gap-3">
                {hasPendingReviews ? (
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-semibold text-foreground">Pending Reviews</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasPendingReviews
                      ? `You have ${pendingReviews.submissions} submission${pendingReviews.submissions === 1 ? "" : "s"} waiting for review across ${pendingReviews.competitions} competition${pendingReviews.competitions === 1 ? "" : "s"}.`
                      : "No submissions are waiting for review right now."}
                  </p>
                  <Button variant="link" className="p-0 h-auto mt-2 text-secondary" asChild>
                    <Link to="/teacher/submissions">
                      {hasPendingReviews ? "Review Now" : "View Submissions"}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
