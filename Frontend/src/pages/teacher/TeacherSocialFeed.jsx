import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  Trophy,
  Medal,
  Star,
  Heart,
  MessageCircle,
  Sparkles,
  Bot,
  Eye,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";
import { toast } from "sonner";

const achievementLeaders = [
  { id: "mock-1", name: "Emily Chen", score: 2450, badges: 12, rank: 1 },
];

const engagementLeaders = [
  { id: "mock-1", name: "Alex Park", likes: 2100, comments: 1320, posts: 45, rank: 1 },
];

const timeFilters = [
  { label: "This Month", value: "month" },
  { label: "This Year", value: "year" },
  { label: "All Time", value: "all" },
];

const monthOptions = [
  { label: "Jan", value: "01" },
  { label: "Feb", value: "02" },
  { label: "Mar", value: "03" },
  { label: "Apr", value: "04" },
  { label: "May", value: "05" },
  { label: "Jun", value: "06" },
  { label: "Jul", value: "07" },
  { label: "Aug", value: "08" },
  { label: "Sep", value: "09" },
  { label: "Oct", value: "10" },
  { label: "Nov", value: "11" },
  { label: "Dec", value: "12" },
];

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatTimeAgo = (value) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
};

function SystemPost({ post }) {
  const [showComments, setShowComments] = useState(false);

  const rankColors = {
    Gold: "bg-achievement text-achievement-foreground",
    Silver: "bg-slate-300 text-slate-700",
    Bronze: "bg-amber-600 text-white",
    Participant: "bg-info/10 text-info",
  };

  const commentsCount = Array.isArray(post.comments) ? post.comments.length : post.comments;

  return (
    <div className="card-static p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
          {post.avatar || "🏅"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">{post.author}</span>
            <span className="badge-status bg-primary/10 text-primary text-xs flex items-center gap-1">
              <Bot className="w-3 h-3" />
              System
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{post.time}</span>
        </div>
      </div>

      <p className="text-sm text-foreground mb-4">{post.content}</p>

      {post.achievement && (
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center",
                rankColors[post.achievement.rank] || "bg-muted"
              )}
            >
              {post.achievement.rank === "Gold" && <Trophy className="w-6 h-6" />}
              {post.achievement.rank === "Silver" && <Medal className="w-6 h-6" />}
              {post.achievement.rank === "Bronze" && <Medal className="w-6 h-6" />}
              {post.achievement.rank === "Participant" && <Star className="w-6 h-6" />}
            </div>
            <div>
              <p className="font-semibold text-sm">{post.achievement.winner}</p>
              <p className="text-xs text-muted-foreground">{post.achievement.title}</p>
              <p className="text-xs text-muted-foreground">{post.achievement.competition}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Heart className="w-4 h-4" />
          <span className="text-xs">{post.likes}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">{commentsCount}</span>
        </Button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          {Array.isArray(post.comments) && post.comments.length > 0 && (
            <div className="space-y-3">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {String(comment.author || "S").charAt(0)}
                  </div>
                  <div className="flex-1 bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{comment.author}</span>
                      <span className="text-xs text-muted-foreground">{comment.time}</span>
                    </div>
                    <p className="text-sm text-foreground">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Eye className="w-3 h-3" />
              Teachers can view comments but cannot post replies
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherSocialFeed() {
  const [activeLeaderboard, setActiveLeaderboard] = useState("achievements");
  const [timeFilter, setTimeFilter] = useState("month");
  const [posts, setPosts] = useState([]);
  const [meritLeaders, setMeritLeaders] = useState(achievementLeaders);
  const [socialLeaders, setSocialLeaders] = useState(engagementLeaders);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [appliedMonth, setAppliedMonth] = useState("");
  const [appliedYear, setAppliedYear] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadData = async () => {
      try {
        const [socialPosts, merit, social] = await Promise.all([
          fetchJsonCached(`${API_BASE_URL}/api/social-feed/posts`, {
            token,
            ttlMs: 60000,
            cacheKey: "teacher:social-feed:posts",
          }),
          fetchJsonCached(`${API_BASE_URL}/api/leaderboard/merit?limit=5`, {
            token,
            ttlMs: 60000,
            cacheKey: "teacher:leaderboard:merit:top5",
          }),
          fetchJsonCached(`${API_BASE_URL}/api/leaderboard/social?limit=5`, {
            token,
            ttlMs: 60000,
            cacheKey: "teacher:leaderboard:social:top5",
          }),
        ]);

        if (!isMounted) return;

        const mappedPosts = (Array.isArray(socialPosts) ? socialPosts : []).map((post) => ({
          id: post.id,
          author: post.author || "AcademiX System",
          avatar: post.avatar || "🏅",
          content: post.content || "",
          achievement: post.achievement
            ? {
                title: post.achievement.title || "Achievement",
                competition: post.achievement.competition || "Competition",
                rank: post.achievement.rank || "Participant",
                winner: post.achievement.winner || "Student",
              }
            : null,
          likes: Number(post.likes || 0),
          comments: (Array.isArray(post.comments) ? post.comments : []).map((comment) => ({
            id: comment.id,
            author: comment.author || "Student",
            text: comment.text || "",
            time: formatTimeAgo(comment.createdAt),
          })),
          createdAtRaw: post.createdAt || null,
          time: formatTimeAgo(post.createdAt),
        }));

        const mappedMerit = (Array.isArray(merit) ? merit : []).map((entry) => ({
          id: entry.studentId,
          name: entry.name,
          score: entry.points,
          badges: entry.achievements,
          rank: entry.rank,
        }));
        const mappedSocial = (Array.isArray(social) ? social : []).map((entry) => ({
          id: entry.studentId,
          name: entry.name,
          likes: entry.likes,
          comments: entry.comments,
          posts: entry.posts,
          rank: entry.rank,
        }));

        setPosts(
          mappedPosts.sort((a, b) => toTimestamp(b.createdAtRaw) - toTimestamp(a.createdAtRaw))
        );
        setMeritLeaders(mappedMerit.length > 0 ? mappedMerit : achievementLeaders);
        setSocialLeaders(mappedSocial.length > 0 ? mappedSocial : engagementLeaders);
      } catch (error) {
        toast.error(error?.message || "Failed to load social feed.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    const refreshHandler = () => {
      loadData();
    };
    window.addEventListener("social:updated", refreshHandler);
    window.addEventListener("submissions:updated", refreshHandler);
    window.addEventListener("notifications:updated", refreshHandler);
    return () => {
      isMounted = false;
      window.removeEventListener("social:updated", refreshHandler);
      window.removeEventListener("submissions:updated", refreshHandler);
      window.removeEventListener("notifications:updated", refreshHandler);
    };
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set([String(new Date().getFullYear())]);
    posts.forEach((post) => {
      const ts = toTimestamp(post.createdAtRaw);
      if (!ts) return;
      years.add(String(new Date(ts).getFullYear()));
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!appliedMonth || !appliedYear) return posts;
    return posts.filter((post) => {
      const ts = toTimestamp(post.createdAtRaw);
      if (!ts) return false;
      const created = new Date(ts);
      const month = String(created.getMonth() + 1).padStart(2, "0");
      const year = String(created.getFullYear());
      return month === appliedMonth && year === appliedYear;
    });
  }, [posts, appliedMonth, appliedYear]);

  const isDateSearchApplied = Boolean(appliedMonth && appliedYear);
  const appliedMonthLabel =
    monthOptions.find((item) => item.value === appliedMonth)?.label || appliedMonth;

  return (
    <AppLayout role="teacher">
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                  Achievement Feed
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  View student achievements and celebrations (Read-only)
                </p>
              </div>
            </div>

            <div className="bg-info/5 border border-info/20 rounded-lg p-3 flex items-center gap-2 text-sm">
              <Eye className="w-4 h-4 text-info" />
              <span className="text-muted-foreground">
                This is a read-only view. Posts are generated for internal winners
                and approved external Top 1, Top 2, or Top 3 achievements.
              </span>
            </div>

            <div className="card-static p-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full mt-1 h-10 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full mt-1 h-10 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  className="h-10 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  onClick={() => {
                    setAppliedMonth(selectedMonth);
                    setAppliedYear(selectedYear);
                  }}
                >
                  Filter By Date
                </Button>
                {isDateSearchApplied && (
                  <Button
                    variant="outline"
                    className="h-10 border-secondary/40 text-secondary hover:bg-secondary/10"
                    onClick={() => {
                      setAppliedMonth("");
                      setAppliedYear("");
                    }}
                  >
                    Show Latest
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="card-static p-12 text-center text-muted-foreground">
                Loading social feed...
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <SystemPost key={post.id} post={post} />
                ))}
              </div>
            )}

            {!loading && filteredPosts.length === 0 && (
              <div className="card-static p-12 text-center">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  {isDateSearchApplied
                    ? `No data found for ${appliedMonthLabel} ${appliedYear}.`
                    : "No achievements to display yet."}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="card-static p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-secondary" />
                  Leaderboard
                </h2>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="text-xs px-2 py-1 rounded-md border border-border bg-card focus:outline-none"
                >
                  {timeFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 mb-4 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setActiveLeaderboard("achievements")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    activeLeaderboard === "achievements"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Trophy className="w-3 h-3 inline mr-1" />
                  Achievements
                </button>
                <button
                  onClick={() => setActiveLeaderboard("engagement")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    activeLeaderboard === "engagement"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  Engagement
                </button>
              </div>

              <div className="space-y-2">
                {(activeLeaderboard === "achievements" ? meritLeaders : socialLeaders).map(
                  (leader, index) => (
                    <div
                      key={leader.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-colors",
                        index === 0 ? "bg-achievement/5" : "hover:bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs",
                          index === 0
                            ? "bg-achievement text-achievement-foreground"
                            : index === 1
                              ? "bg-slate-300 text-slate-700"
                              : index === 2
                                ? "bg-amber-700 text-white"
                                : "bg-muted text-muted-foreground"
                        )}
                      >
                        {leader.rank || index + 1}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-xs font-medium">
                        {String(leader.name || "S").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{leader.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {activeLeaderboard === "achievements"
                            ? `${leader.score} points`
                            : `${leader.likes} likes • ${leader.posts} posts`}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <Link to="/teacher/leaderboard">
                <Button variant="outline" size="sm" className="w-full mt-4">
                  View Full Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

