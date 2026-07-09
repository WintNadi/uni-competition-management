import {
  Trophy,
  Users,
  Medal,
  Clock,
  Bell,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { CompetitionCard } from "@/components/dashboard/CompetitionCard";
import { TeamCard } from "@/components/dashboard/TeamCard";
import { AchievementCard } from "@/components/dashboard/AchievementCard";
import { NotificationItem } from "@/components/dashboard/NotificationItem";
import { LeaderboardPreview } from "@/components/dashboard/LeaderboardPreview";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortDate = (value) => {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "-";
};

const formatRelativeTime = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return "just now";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const normalizeNotificationType = (rawType) => {
  const type = String(rawType || "").toUpperCase();
  if (type.startsWith("COMPETITION_")) return "competition";
  if (type.startsWith("TEAM_")) return "team";
  if (type === "SUBMISSION_DEADLINE_PASSED" || type === "COMPETITION_REGISTRATION_CLOSED") {
    return "deadline";
  }
  if (
    type.startsWith("SUBMISSION_")
    || type === "REJECTION"
    || type === "ROLLBACK"
    || type === "ATTENDANCE_RECOVERY_APPROVAL"
    || type === "EXTERNAL_PARTICIPATION_SUBMITTED"
  ) {
    return "alert";
  }
  return "default";
};

const normalizeTrend = (value) => {
  const trend = String(value || "").toLowerCase();
  if (trend === "up" || trend === "down" || trend === "same") {
    return trend;
  }
  return "same";
};

const mapAchievementRank = (achievement) => {
  const text = `${achievement?.badge || ""} ${achievement?.resultLabel || ""}`.toLowerCase();
  if (text.includes("gold") || text.includes("winner") || text.includes("champion") || text.includes("top 1")) {
    return "gold";
  }
  if (text.includes("silver") || text.includes("runner") || text.includes("top 2")) {
    return "silver";
  }
  if (text.includes("bronze") || text.includes("top 3") || text.includes("top 5") || text.includes("top 10")) {
    return "bronze";
  }
  return "participation";
};

const mapInternalStatus = (competition) => {
  const now = new Date();
  const upperStatus = String(competition?.status || "").toUpperCase();
  const regOpen = toDate(competition?.registrationOpen);
  const regClose = toDate(competition?.registrationClose || competition?.registrationDeadline);
  const submissionDeadline = toDate(competition?.submissionDeadline);

  if (upperStatus === "CLOSED" || upperStatus === "COMPLETED") return "closed";
  if (regOpen && now < regOpen) return "upcoming";
  if (regClose && now > regClose) return "closed";
  if (submissionDeadline && now > submissionDeadline) return "closed";
  if (upperStatus === "UPCOMING") return "upcoming";
  return "open";
};

const mapExternalStatus = (competition) => {
  const now = new Date();
  const regOpen = toDate(competition?.registrationOpen);
  const regClose = toDate(competition?.registrationClose || competition?.registrationDeadline);
  if (regOpen && regClose) {
    if (now < regOpen) return "upcoming";
    if (now > regClose) return "closed";
    return "open";
  }

  const startDate = toDate(competition?.startDate || competition?.start);
  const endDate = toDate(competition?.endDate || competition?.end);
  if (startDate && now < startDate) return "upcoming";
  if (endDate && now > endDate) return "closed";
  return "open";
};

const mapCategoryLabel = (competition) => {
  const format = String(competition?.format || "").toUpperCase();
  if (format === "QUIZ") return "Quiz";
  if (format === "ASSIGNMENT") return "Assignment";
  if (format === "PROJECT") return "Project";
  if (competition?.customCategory) return competition.customCategory;
  const category = String(competition?.category || "").trim();
  if (!category) return "Other";
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

export default function StudentDashboard() {
  const [userName, setUserName] = useState(
    typeof window !== "undefined" ? (localStorage.getItem("userName") || "Student") : "Student"
  );
  const [competitions, setCompetitions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async ({ force = false } = {}) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      setCompetitions([]);
      setTeams([]);
      setAchievements([]);
      setNotifications([]);
      setLeaders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [
        profileData,
        competitionData,
        teamData,
        achievementData,
        notificationData,
        leaderboardData,
      ] = await Promise.all([
        fetchJsonCached(`${API_BASE_URL}/api/users/me`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "users:me",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/competitions`, {
          token,
          ttlMs: 180000,
          force,
          cacheKey: "student:competitions:list",
        }),
        fetchJsonCached(`${API_BASE_URL}/teams/my`, {
          token,
          ttlMs: 180000,
          force,
          cacheKey: "student:teams:my",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/achievements/me`, {
          token,
          ttlMs: 180000,
          force,
          cacheKey: "student:achievements:me",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/notifications`, {
          token,
          ttlMs: 120000,
          force,
          cacheKey: "student:notifications:list",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/leaderboard/merit?limit=5`, {
          token,
          ttlMs: 120000,
          force,
          cacheKey: "student:leaderboard:merit:top5",
        }),
      ]);

      if (profileData?.id) {
        localStorage.setItem("userId", profileData.id);
      }
      if (profileData?.fullName) {
        localStorage.setItem("userName", profileData.fullName);
        setUserName(profileData.fullName);
      }

      const mappedCompetitions = (Array.isArray(competitionData) ? competitionData : [])
        .filter((competition) => String(competition?.status || "").toUpperCase() !== "DRAFT")
        .map((competition) => {
          const type = String(competition?.competitionType || "").toUpperCase().includes("EXTERNAL")
            ? "external"
            : "internal";
          const status = type === "external"
            ? mapExternalStatus(competition)
            : mapInternalStatus(competition);
          const deadlineValue = type === "external"
            ? (competition?.proofDeadline || competition?.registrationClose || competition?.endDate)
            : (competition?.submissionDeadline || competition?.registrationClose || competition?.registrationDeadline);

          return {
            id: competition?.competitionId || competition?.id,
            title: competition?.title || "Competition",
            category: mapCategoryLabel(competition),
            customCategory: competition?.customCategory || "",
            deadline: formatShortDate(deadlineValue),
            deadlineValue: deadlineValue || null,
            participants: Number(competition?.registeredParticipants || competition?.participants || 0),
            status,
            type,
          };
        })
        .filter((competition) => !!competition.id);
      setCompetitions(mappedCompetitions);

      const competitionTitleMap = new Map(
        mappedCompetitions.map((competition) => [competition.id, competition.title])
      );
      const currentUserId = profileData?.id || localStorage.getItem("userId") || "";

      const mappedTeams = (Array.isArray(teamData) ? teamData : [])
        .map((team) => {
          const memberList = [
            team?.leaderUsername,
            ...(Array.isArray(team?.acceptedMemberUsernames) ? team.acceptedMemberUsernames : []),
            ...(Array.isArray(team?.memberUsernames) ? team.memberUsernames : []),
          ]
            .filter((name) => !!String(name || "").trim());
          const uniqueMembers = Array.from(new Set(memberList));

          return {
            id: team?.teamId || team?.id,
            name: team?.teamName || "Team",
            competition: competitionTitleMap.get(team?.competitionId) || "Competition",
            members: uniqueMembers.length > 0 ? uniqueMembers : ["Member"],
            status: String(team?.status || "ACTIVE").toLowerCase() === "pending" ? "pending" : "active",
            isLeader: currentUserId && team?.leaderId === currentUserId,
          };
        })
        .filter((team) => !!team.id);
      setTeams(mappedTeams);

      const mappedAchievements = (Array.isArray(achievementData) ? achievementData : [])
        .map((achievement, index) => ({
          id: achievement?.achievementId || achievement?.id || `${achievement?.competitionId || "achievement"}-${index}`,
          title: achievement?.resultLabel || achievement?.badge || "Achievement",
          competition: achievement?.competitionTitle || "Competition",
          date: formatShortDate(achievement?.achievedAt),
          rank: mapAchievementRank(achievement),
        }));
      setAchievements(mappedAchievements);

      const mappedNotifications = (Array.isArray(notificationData) ? notificationData : [])
        .map((notification) => ({
          id: notification?.id,
          type: normalizeNotificationType(notification?.type),
          message: [notification?.title, notification?.message].filter(Boolean).join(" - ") || "Notification",
          time: formatRelativeTime(notification?.createdAt),
          unread: !(notification?.read || notification?.isRead),
          createdAt: notification?.createdAt || null,
        }))
        .filter((notification) => !!notification.id)
        .sort((first, second) => {
          const firstTime = toDate(first.createdAt)?.getTime() || 0;
          const secondTime = toDate(second.createdAt)?.getTime() || 0;
          return secondTime - firstTime;
        });
      setNotifications(
        mappedNotifications.slice(0, 6).map(({ createdAt, ...notification }) => notification)
      );

      const mappedLeaders = (Array.isArray(leaderboardData) ? leaderboardData : [])
        .slice(0, 5)
        .map((leader, index) => ({
          id: leader?.studentId || leader?.id || `leader-${index}`,
          name: leader?.name || "Student",
          points: Number(leader?.points || 0),
          trend: normalizeTrend(leader?.trend),
        }));
      setLeaders(mappedLeaders);
    } catch (error) {
      toast.error(error?.message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard({ force: false });

    const handleDashboardRefresh = () => loadDashboard({ force: false });
    const handleSessionChange = () => loadDashboard({ force: true });

    window.addEventListener("competitions:updated", handleDashboardRefresh);
    window.addEventListener("submissions:updated", handleDashboardRefresh);
    window.addEventListener("notifications:updated", handleDashboardRefresh);
    window.addEventListener("session:changed", handleSessionChange);
    return () => {
      window.removeEventListener("competitions:updated", handleDashboardRefresh);
      window.removeEventListener("submissions:updated", handleDashboardRefresh);
      window.removeEventListener("notifications:updated", handleDashboardRefresh);
      window.removeEventListener("session:changed", handleSessionChange);
    };
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => notification.unread).length,
    [notifications]
  );

  const activeCompetitions = useMemo(
    () => competitions.filter((competition) => competition.status === "open"),
    [competitions]
  );

  const upcomingByDeadline = useMemo(
    () => competitions
      .filter((competition) => !!competition.deadlineValue && competition.status !== "closed")
      .slice()
      .sort((first, second) => {
        const firstTime = toDate(first.deadlineValue)?.getTime() || 0;
        const secondTime = toDate(second.deadlineValue)?.getTime() || 0;
        return firstTime - secondTime;
      }),
    [competitions]
  );

  const stats = useMemo(
    () => [
      { icon: Trophy, label: "Active Competitions", value: String(activeCompetitions.length), trend: "", trendUp: true },
      { icon: Users, label: "Teams Joined", value: String(teams.length) },
      { icon: Medal, label: "Achievements", value: String(achievements.length), trend: "", trendUp: true },
      { icon: Clock, label: "Upcoming Deadlines", value: String(upcomingByDeadline.length) },
    ],
    [activeCompetitions.length, teams.length, achievements.length, upcomingByDeadline.length]
  );

  return (
    <AppLayout role="student">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Welcome back, {userName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              {loading
                ? "Loading dashboard data..."
                : `You have ${upcomingByDeadline.length} upcoming deadlines.`
              }
            </p>
          </div>
          <Link to="/competitions">
            <Button className="gap-2">
              <Trophy className="w-4 h-4" />
              Browse Competitions
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg">Active Competitions</h2>
                <Link to="/competitions" className="text-sm text-secondary hover:underline flex items-center gap-1">
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {loading && (
                  <p className="text-sm text-muted-foreground">Loading competitions...</p>
                )}
                {!loading && activeCompetitions.slice(0, 2).map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} />
                ))}
                {!loading && activeCompetitions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No active competitions right now.
                  </p>
                )}
              </div>
            </section>

            <section className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg">Upcoming Deadlines</h2>
              </div>
              <div className="space-y-1">
                {loading && (
                  <p className="text-sm text-muted-foreground">Loading competitions...</p>
                )}
                {!loading && upcomingByDeadline.slice(0, 5).map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} compact />
                ))}
                {!loading && upcomingByDeadline.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No upcoming deadlines.
                  </p>
                )}
              </div>
            </section>

            <section className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg">My Teams</h2>
                <Link to="/teams" className="text-sm text-secondary hover:underline flex items-center gap-1">
                  Manage teams <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {loading && (
                  <p className="text-sm text-muted-foreground">Loading teams...</p>
                )}
                {!loading && teams.map((team) => (
                  <TeamCard key={team.id} team={team} />
                ))}
                {!loading && teams.length === 0 && (
                  <p className="text-sm text-muted-foreground">You are not in any team yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-secondary" />
                  Notifications
                </h2>
                <span className="badge-status bg-secondary/10 text-secondary">
                  {unreadNotifications} new
                </span>
              </div>
              <div className="space-y-1">
                {loading && (
                  <p className="text-sm text-muted-foreground">Loading notifications...</p>
                )}
                {!loading && notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
                {!loading && notifications.length === 0 && (
                  <p className="text-sm text-muted-foreground">No notifications yet.</p>
                )}
              </div>
            </section>

            <section className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <Medal className="w-5 h-5 text-achievement" />
                  Recent Achievements
                </h2>
              </div>
              <div className="space-y-1">
                {loading && (
                  <p className="text-sm text-muted-foreground">Loading achievements...</p>
                )}
                {!loading && achievements.slice(0, 4).map((achievement) => (
                  <AchievementCard key={achievement.id} achievement={achievement} />
                ))}
                {!loading && achievements.length === 0 && (
                  <p className="text-sm text-muted-foreground">No achievements yet.</p>
                )}
              </div>
            </section>

            <section className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-secondary" />
                  Leaderboard
                </h2>
                <Link to="/leaderboard" className="text-sm text-secondary hover:underline">
                  Full board
                </Link>
              </div>
              {loading && (
                <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
              )}
              {!loading && leaders.length > 0 && (
                <LeaderboardPreview leaders={leaders} />
              )}
              {!loading && leaders.length === 0 && (
                <p className="text-sm text-muted-foreground">Leaderboard data not available yet.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
