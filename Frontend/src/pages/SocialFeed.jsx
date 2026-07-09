import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  Trophy,
  Medal,
  Star,
  Award,
  Heart,
  MessageCircle,
  Pencil,
  Sparkles,
  Bot,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache } from "@/lib/api";
import { toast } from "sonner";

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

const mapRankToColor = (rank) => {
  if (rank === "Gold") return "bg-achievement text-achievement-foreground";
  if (rank === "Silver") return "bg-slate-300 text-slate-700";
  if (rank === "Bronze") return "bg-amber-600 text-white";
  return "bg-info/10 text-info";
};

function SystemPost({ post, onLike, onComment, onEditComment, onDeleteComment, currentUserId }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentText, setEditingCommentText] = useState("");

  const comments = Array.isArray(post.comments) ? post.comments : [];

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    onComment(post.id, commentText.trim());
    setCommentText("");
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text || "");
  };

  const handleSaveCommentEdit = () => {
    if (!editingCommentId || !editingCommentText.trim()) return;
    onEditComment(post.id, editingCommentId, editingCommentText.trim());
    setEditingCommentId("");
    setEditingCommentText("");
  };

  const handleCancelCommentEdit = () => {
    setEditingCommentId("");
    setEditingCommentText("");
  };

  return (
    <div className="card-static p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
          {post.avatar || "🏅"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">{post.author || "AcademiX System"}</span>
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
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", mapRankToColor(post.achievement.rank))}>
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
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5", post.userLiked && "text-destructive")}
          disabled={!post.canInteract}
          onClick={() => onLike(post.id)}
        >
          <Heart className={cn("w-4 h-4", post.userLiked && "fill-current")} />
          <span className="text-xs">{post.likes}</span>
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowComments(!showComments)}>
          <MessageCircle className="w-4 h-4" />
          <span className="text-xs">{comments.length}</span>
        </Button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          {comments.length > 0 && (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {String(comment.author || "S").charAt(0)}
                  </div>
                  <div className="flex-1 bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{comment.author}</span>
                      <span className="text-xs text-muted-foreground">{comment.time}</span>
                      {comment.authorId === currentUserId && (
                        <div className="ml-auto flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => startEditComment(comment)}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive"
                            onClick={() => onDeleteComment(post.id, comment.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className="flex-1 h-8 px-2 rounded border border-border bg-background text-sm"
                          onKeyDown={(e) => e.key === "Enter" && handleSaveCommentEdit()}
                        />
                        <Button size="sm" className="h-8 px-2" onClick={handleSaveCommentEdit} disabled={!editingCommentText.trim()}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleCancelCommentEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{comment.text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium flex-shrink-0">
              {String(localStorage.getItem("userName") || "Y").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder={post.canInteract ? "Write a comment..." : "You cannot comment on your own post"}
                value={commentText}
                disabled={!post.canInteract}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
              />
              <Button size="sm" disabled={!post.canInteract || !commentText.trim()} onClick={handleSubmitComment}>
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SocialFeed() {
  const [activeLeaderboard, setActiveLeaderboard] = useState("achievements");
  const [timeFilter, setTimeFilter] = useState("month");
  const [posts, setPosts] = useState([]);
  const [achievementLeaders, setAchievementLeaders] = useState([]);
  const [engagementLeaders, setEngagementLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(localStorage.getItem("userId") || "");
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [appliedMonth, setAppliedMonth] = useState("");
  const [appliedYear, setAppliedYear] = useState("");

  const mapPostFromApi = (post) => ({
    id: post.id,
    author: post.author || "AcademiX System",
    avatar: post.avatar || "🏆",
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
      authorId: comment.authorId,
      author: comment.author || "Student",
      text: comment.text || "",
      time: formatTimeAgo(comment.createdAt),
    })),
    createdAtRaw: post.createdAt || null,
    time: formatTimeAgo(post.createdAt),
    userLiked: !!post.userLiked,
    canInteract: !!post.canInteract,
  });

  const refreshLeaderboards = async ({ force = false } = {}) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setAchievementLeaders([]);
      setEngagementLeaders([]);
      return;
    }

    const [meritLeaders, socialLeaders] = await Promise.all([
      fetchJsonCached(`${API_BASE_URL}/api/leaderboard/merit?limit=5`, {
        token,
        ttlMs: 60000,
        force,
        cacheKey: "leaderboard:merit:top5",
      }),
      fetchJsonCached(`${API_BASE_URL}/api/leaderboard/social?limit=5`, {
        token,
        ttlMs: 60000,
        force,
        cacheKey: "leaderboard:social:top5",
      }),
    ]);

    setAchievementLeaders((Array.isArray(meritLeaders) ? meritLeaders : []).map((entry) => ({
      id: entry.studentId,
      rank: entry.rank,
      name: entry.name,
      score: entry.points,
      badges: entry.achievements,
    })));

    setEngagementLeaders((Array.isArray(socialLeaders) ? socialLeaders : []).map((entry) => ({
      id: entry.studentId,
      rank: entry.rank,
      name: entry.name,
      likes: entry.likes,
      comments: entry.comments,
      posts: entry.posts,
    })));
  };

  const applyUpdatedPost = (postFromApi) => {
    if (!postFromApi?.id) return;
    const mapped = mapPostFromApi(postFromApi);
    setPosts((prev) =>
      prev
        .map((item) => (item.id === mapped.id ? mapped : item))
        .sort((a, b) => toTimestamp(b.createdAtRaw) - toTimestamp(a.createdAtRaw))
    );
  };

  const loadData = async ({ force = false } = {}) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setPosts([]);
      setAchievementLeaders([]);
      setEngagementLeaders([]);
      setLoading(false);
      return;
    }

    setCurrentUserId(localStorage.getItem("userId") || "");
    setLoading(true);
    try {
      const socialPosts = await fetchJsonCached(`${API_BASE_URL}/api/social-feed/posts`, {
        token,
        ttlMs: 60000,
        force,
        cacheKey: "social-feed:posts",
      });

      const mappedPosts = (Array.isArray(socialPosts) ? socialPosts : [])
        .map(mapPostFromApi)
        .sort((a, b) => toTimestamp(b.createdAtRaw) - toTimestamp(a.createdAtRaw));
      setPosts(mappedPosts);
      await refreshLeaderboards({ force });
    } catch (error) {
      toast.error(error?.message || "Failed to load social feed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({ force: false });
    const handler = () => loadData({ force: false });
    window.addEventListener("social:updated", handler);
    window.addEventListener("submissions:updated", handler);
    window.addEventListener("notifications:updated", handler);
    window.addEventListener("session:changed", handler);
    return () => {
      window.removeEventListener("social:updated", handler);
      window.removeEventListener("submissions:updated", handler);
      window.removeEventListener("notifications:updated", handler);
      window.removeEventListener("session:changed", handler);
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

  const handleLike = async (postId) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/social-feed/posts/${postId}/likes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || "Unable to like post.");
      }
      const updatedPost = await res.json().catch(() => null);
      if (updatedPost) {
        applyUpdatedPost(updatedPost);
      }
      invalidateApiCache((key) =>
        String(key).includes("social-feed:") || String(key).includes("leaderboard:"));
      await refreshLeaderboards({ force: true });
    } catch (error) {
      toast.error(error?.message || "Failed to like post.");
    }
  };

  const handleComment = async (postId, commentText) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/social-feed/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: commentText }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || "Unable to comment.");
      }
      const updatedPost = await res.json().catch(() => null);
      if (updatedPost) {
        applyUpdatedPost(updatedPost);
      }
      invalidateApiCache((key) =>
        String(key).includes("social-feed:") || String(key).includes("leaderboard:"));
      await refreshLeaderboards({ force: true });
    } catch (error) {
      toast.error(error?.message || "Failed to add comment.");
    }
  };

  const handleEditComment = async (postId, commentId, text) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/social-feed/posts/${postId}/comments/${commentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || "Unable to edit comment.");
      }
      const updatedPost = await res.json().catch(() => null);
      if (updatedPost) {
        applyUpdatedPost(updatedPost);
      }
      invalidateApiCache((key) =>
        String(key).includes("social-feed:") || String(key).includes("leaderboard:"));
      await refreshLeaderboards({ force: true });
      toast.success("Comment updated.");
    } catch (error) {
      toast.error(error?.message || "Failed to edit comment.");
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/social-feed/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || "Unable to delete comment.");
      }
      const updatedPost = await res.json().catch(() => null);
      if (updatedPost) {
        applyUpdatedPost(updatedPost);
      }
      invalidateApiCache((key) =>
        String(key).includes("social-feed:") || String(key).includes("leaderboard:"));
      await refreshLeaderboards({ force: true });
      toast.success("Comment deleted.");
    } catch (error) {
      toast.error(error?.message || "Failed to delete comment.");
    }
  };

  return (
    <AppLayout role="student">
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                  Achievement Feed
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Celebrate wins and participations from our community
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2 text-sm">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                Posts are generated automatically for internal competition achievements and external approvals with Top 1, Top 2, or Top 3 results.
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
              <div className="card-static p-12 text-center text-muted-foreground">Loading social feed...</div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <SystemPost
                    key={post.id}
                    post={post}
                    onLike={handleLike}
                    onComment={handleComment}
                    onEditComment={handleEditComment}
                    onDeleteComment={handleDeleteComment}
                    currentUserId={currentUserId}
                  />
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
                {(activeLeaderboard === "achievements" ? achievementLeaders : engagementLeaders).map((leader, index) => (
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
                      {leader.rank}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-sm font-medium">
                      {String(leader.name || "S").charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{leader.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {activeLeaderboard === "achievements"
                          ? `${leader.score} pts • ${leader.badges} badges`
                          : `${leader.likes} likes • ${leader.posts} posts`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link to="/leaderboard">
                <Button variant="outline" className="w-full mt-4" size="sm">
                  View Full Leaderboard
                </Button>
              </Link>
            </div>

            <div className="card-static p-5">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-achievement" />
                Popular Badges
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Trophy, label: "Champion", color: "text-achievement" },
                  { icon: Medal, label: "Medalist", color: "text-info" },
                  { icon: Star, label: "Rising Star", color: "text-warning" },
                  { icon: Sparkles, label: "Innovator", color: "text-secondary" },
                  { icon: Award, label: "Scholar", color: "text-success" },
                  { icon: TrendingUp, label: "Top 10", color: "text-destructive" },
                ].map((badge, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <badge.icon className={cn("w-6 h-6", badge.color)} />
                    <span className="text-xs text-muted-foreground">{badge.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
