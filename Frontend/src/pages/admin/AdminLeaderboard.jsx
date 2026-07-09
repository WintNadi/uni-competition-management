import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Filter, Search, Award, Heart, MessageSquare, Calendar } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";
import { toast } from "sonner";

const fallbackMerit = [
  {
    rank: 1,
    name: "Student",
    avatar: "ST",
    points: 0,
    achievements: 0,
    trend: "same",
    change: 0,
  },
];

const fallbackSocial = [
  {
    rank: 1,
    name: "Student",
    avatar: "ST",
    socialScore: 0,
    likes: 0,
    comments: 0,
    posts: 0,
  },
];

const getRankStyle = (rank) => {
  switch (rank) {
    case 1:
      return "bg-achievement/20 text-achievement border-achievement/30";
    case 2:
      return "bg-secondary/20 text-secondary border-secondary/30";
    case 3:
      return "bg-info/20 text-info border-info/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getRankIcon = (rank) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-5 h-5" />;
    case 2:
      return <Medal className="w-5 h-5" />;
    case 3:
      return <Award className="w-5 h-5" />;
    default:
      return <span className="font-bold">{rank}</span>;
  }
};

export default function AdminLeaderboard() {
  const [activeTab, setActiveTab] = useState("merit");
  const [searchQuery, setSearchQuery] = useState("");
  const [timePeriod, setTimePeriod] = useState("all");
  const [competitionType, setCompetitionType] = useState("all");
  const [meritLeaderboard, setMeritLeaderboard] = useState(fallbackMerit);
  const [socialLeaderboard, setSocialLeaderboard] = useState(fallbackSocial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadData = async () => {
      try {
        const [merit, social] = await Promise.all([
          fetchJsonCached(
            `${API_BASE_URL}/api/leaderboard/merit?timePeriod=${encodeURIComponent(timePeriod)}&competitionType=${encodeURIComponent(competitionType)}`,
            {
              token,
              ttlMs: 60000,
              cacheKey: `admin:leaderboard:merit:${timePeriod}:${competitionType}`,
            }
          ),
          fetchJsonCached(
            `${API_BASE_URL}/api/leaderboard/social?timePeriod=${encodeURIComponent(timePeriod)}`,
            {
              token,
              ttlMs: 60000,
              cacheKey: `admin:leaderboard:social:${timePeriod}`,
            }
          )
        ]);

        if (!isMounted) return;

        const mappedMerit = (Array.isArray(merit) ? merit : []).map((entry) => ({
          rank: entry.rank,
          name: entry.name,
          avatar: entry.avatar || String(entry.name || "ST").slice(0, 2).toUpperCase(),
          points: entry.points || 0,
          achievements: entry.achievements || 0,
          participations: entry.participations || 0,
          trend: entry.trend || "same",
          change: entry.change || 0,
        }));

        const mappedSocial = (Array.isArray(social) ? social : []).map((entry) => ({
          rank: entry.rank,
          name: entry.name,
          avatar: entry.avatar || String(entry.name || "ST").slice(0, 2).toUpperCase(),
          socialScore: entry.socialScore || 0,
          likes: entry.likes || 0,
          comments: entry.comments || 0,
          posts: entry.posts || 0,
        }));

        setMeritLeaderboard(mappedMerit.length > 0 ? mappedMerit : fallbackMerit);
        setSocialLeaderboard(mappedSocial.length > 0 ? mappedSocial : fallbackSocial);
      } catch (error) {
        toast.error(error?.message || "Failed to load leaderboard.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeTab, timePeriod, competitionType]);

  const currentLeaderboard = activeTab === "merit" ? meritLeaderboard : socialLeaderboard;

  const filteredLeaderboard = useMemo(
    () =>
      currentLeaderboard.filter((entry) =>
        String(entry.name || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [currentLeaderboard, searchQuery]
  );

  return (
    <AppLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Leaderboards
            </h1>
            <p className="text-muted-foreground mt-1">
              View merit-based achievements and social engagement rankings (Read-only)
            </p>
          </div>
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button
            onClick={() => setActiveTab("merit")}
            className={cn(
              "px-6 py-2.5 text-sm font-medium transition-colors flex items-center gap-2",
              activeTab === "merit"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            <Trophy className="w-4 h-4" />
            Merit Leaderboard
          </button>
          <button
            onClick={() => setActiveTab("social")}
            className={cn(
              "px-6 py-2.5 text-sm font-medium transition-colors flex items-center gap-2",
              activeTab === "social"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            <Heart className="w-4 h-4" />
            Social Leaderboard
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="semester">This Semester</SelectItem>
            </SelectContent>
          </Select>
          {activeTab === "merit" && (
            <Select value={competitionType} onValueChange={setCompetitionType}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Competition Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hackathon">Hackathon</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <p className="text-sm text-info">
            <strong>Admin View:</strong> This is a read-only view of the leaderboards.
            {activeTab === "merit"
              ? " Merit points are calculated based on verified achievements from competitions."
              : " Social scores reflect peer engagement (likes/comments) with no academic impact."}
          </p>
        </div>

        {loading ? (
          <div className="card-static p-10 text-center text-muted-foreground">Loading leaderboard...</div>
        ) : (
          <div className="card-static overflow-hidden">
            <div className="p-6 bg-gradient-to-b from-muted/50 to-transparent">
              <div className="grid grid-cols-3 gap-4">
                {[1, 0, 2].map((index) => {
                  const item = filteredLeaderboard[index];
                  if (!item) return null;
                  return (
                    <div
                      key={`${item.rank}-${item.name}`}
                      className={cn(
                        "text-center p-4 rounded-lg border transition-all",
                        getRankStyle(item.rank),
                        index === 0 && "transform scale-105"
                      )}
                    >
                      <div
                        className={cn(
                          "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3",
                          getRankStyle(item.rank)
                        )}
                      >
                        {getRankIcon(item.rank)}
                      </div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-2xl font-bold mt-1">
                        {activeTab === "merit" ? item.points : item.socialScore}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeTab === "merit" ? "points" : "social score"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-16">
                      Rank
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Student
                    </th>
                    {activeTab === "merit" ? (
                      <>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                          Points
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                          Achievements
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                          Participations
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                          Likes
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                          Comments
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                          Posts
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.map((entry) => (
                    <tr
                      key={`${entry.rank}-${entry.name}`}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm",
                            getRankStyle(entry.rank)
                          )}
                        >
                          {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-sm font-semibold">
                            {entry.avatar}
                          </div>
                          <span className="font-medium">{entry.name}</span>
                        </div>
                      </td>
                      {activeTab === "merit" ? (
                        <>
                          <td className="py-3 px-4 text-center font-semibold text-secondary">
                            {entry.points}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="badge-status bg-achievement/10 text-achievement">
                              {entry.achievements}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="badge-status bg-info/40 text-info">
                              {entry.participations ?? 0}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1 text-sm">
                              <Heart className="w-4 h-4 text-destructive" />
                              {entry.likes}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1 text-sm">
                              <MessageSquare className="w-4 h-4 text-secondary" />
                              {entry.comments}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="badge-status bg-info/10 text-info">{entry.posts}</span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && filteredLeaderboard.length === 0 && (
          <div className="card-static p-8 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No students found</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
