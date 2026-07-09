import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  CheckCircle2,
  Clock,
  Users,
  BarChart3,
  FileText,
  MessageSquare,
  Download,
  Eye,
  AlertTriangle,
  TrendingUp,
  Trophy,
  Mail,
  Inbox,
  ExternalLink,
  Globe,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";
import { formatReadableDateTime } from "@/lib/date";
import { toast } from "sonner";

const isSameLocalDay = (value, referenceDate = new Date()) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
    && date.getDate() === referenceDate.getDate()
  );
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("approvals");
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [messages, setMessages] = useState([]);
  const [socialPosts, setSocialPosts] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loadingMessageDetail, setLoadingMessageDetail] = useState(false);
  const [statsSnapshot, setStatsSnapshot] = useState({
    pendingApprovals: 0,
    approvedToday: 0,
    activeUsers: 0,
    totalAchievements: 0,
  });

  const loadDashboard = useCallback(async ({ force = false, silent = false } = {}) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setPendingApprovals([]);
      setMessages([]);
      setSocialPosts([]);
      setStatsSnapshot({
        pendingApprovals: 0,
        approvedToday: 0,
        activeUsers: 0,
        totalAchievements: 0,
      });
      setSelectedMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [
        approvalsRaw,
        supportRaw,
        socialRaw,
        achievementsRaw,
        userStats,
      ] = await Promise.all([
        fetchJsonCached(`${API_BASE_URL}/api/external/participations/admin?status=all`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "admin:dashboard:approvals",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/support/conversations/admin`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "admin:dashboard:support",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/social-feed/admin/posts`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "admin:dashboard:social-posts",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/achievements`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "admin:dashboard:achievements",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/users/admin/stats`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "admin:dashboard:user-stats",
        }).catch(() => null),
      ]);

      const approvals = Array.isArray(approvalsRaw) ? approvalsRaw : [];
      const supportConversations = Array.isArray(supportRaw) ? supportRaw : [];
      const socialFeedPosts = Array.isArray(socialRaw) ? socialRaw : [];
      const achievements = Array.isArray(achievementsRaw) ? achievementsRaw : [];

      const pending = approvals
        .filter((item) => String(item?.status || "").toLowerCase() === "pending")
        .slice()
        .sort((first, second) => {
          const firstValue = first?.submittedAt || first?.createdAt || first?.updatedAt;
          const secondValue = second?.submittedAt || second?.createdAt || second?.updatedAt;
          return toTimestamp(secondValue) - toTimestamp(firstValue);
        })
        .slice(0, 5)
        .map((item, index) => ({
          id: item?.id || item?._id || `pending-${index}`,
          type: item?.source === "student_created" ? "student-created" : "external-proof",
          student: item?.student?.name || "Student",
          competition: item?.competition || item?.title || "Competition",
          achievement: item?.result || "Participation",
          submittedAt: formatReadableDateTime(item?.submittedAt || item?.createdAt || item?.updatedAt),
          proofFiles: Array.isArray(item?.proofFiles) ? item.proofFiles : [],
        }));

      const supportMessages = supportConversations
        .slice()
        .sort((first, second) =>
          toTimestamp(second?.lastMessageAt) - toTimestamp(first?.lastMessageAt))
        .slice(0, 10)
        .map((conversation, index) => ({
          id: conversation?.id || `conversation-${index}`,
          student: conversation?.studentName || "Student",
          email: conversation?.studentEmail || "",
          subject: conversation?.subject || "Support conversation",
          message: "Open to view latest message.",
          submittedAt: formatReadableDateTime(conversation?.lastMessageAt),
          status: Number(conversation?.unreadForAdmin || 0) > 0 ? "unread" : "read",
        }));

      const moderationPosts = socialFeedPosts
        .slice(0, 4)
        .map((post, index) => ({
          id: post?.id || `post-${index}`,
          author: post?.author || "AcademiX System",
          content: post?.content || "",
          reportCount: Number(post?.reportCount || 0),
          status: post?.status || "published",
        }));

      const approvedToday = approvals.filter((item) => {
        if (String(item?.status || "").toLowerCase() !== "approved") return false;
        return isSameLocalDay(item?.approvedAt || item?.updatedAt || item?.submittedAt);
      }).length;

      const userCountFromApi = Number(userStats?.totalUsers || 0);
      const fallbackActiveUsers = new Set(
        approvals
          .map((item) => item?.student?.id || item?.student?.email || item?.student?.name)
          .filter(Boolean)
      ).size;

      setPendingApprovals(pending);
      setMessages(supportMessages);
      setSocialPosts(moderationPosts);
      setStatsSnapshot({
        pendingApprovals: pending.length,
        approvedToday,
        activeUsers: userCountFromApi || fallbackActiveUsers,
        totalAchievements: achievements.length,
      });
    } catch (error) {
      if (!silent) {
        toast.error(error?.message || "Unable to load admin dashboard data");
      }
      setPendingApprovals([]);
      setMessages([]);
      setSocialPosts([]);
      setStatsSnapshot({
        pendingApprovals: 0,
        approvedToday: 0,
        activeUsers: 0,
        totalAchievements: 0,
      });
      setSelectedMessage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const openMessage = useCallback(async (message) => {
    setSelectedMessage(message);

    const token = localStorage.getItem("userToken");
    if (!token || !message?.id) return;

    setLoadingMessageDetail(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/conversations/${message.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Unable to load message details.");
      }

      const conversation = await response.json();
      const conversationMessages = Array.isArray(conversation?.messages)
        ? conversation.messages.slice().sort((first, second) =>
          toTimestamp(first?.createdAt) - toTimestamp(second?.createdAt))
        : [];
      const latestMessage = conversationMessages[conversationMessages.length - 1] || null;

      setSelectedMessage((prev) => ({
        ...(prev || message),
        subject: conversation?.subject || prev?.subject || message?.subject || "Support conversation",
        message: latestMessage?.text || "No messages yet.",
        submittedAt: formatReadableDateTime(
          latestMessage?.createdAt || conversation?.lastMessageAt || conversation?.updatedAt
        ),
        status: "read",
      }));

      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id
            ? { ...item, status: "read" }
            : item
        ));
    } catch (error) {
      toast.error(error?.message || "Failed to open message.");
    } finally {
      setLoadingMessageDetail(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard({ force: false });
  }, [loadDashboard]);

  useEffect(() => {
    const refresh = () => loadDashboard({ force: true, silent: true });
    window.addEventListener("social:updated", refresh);
    window.addEventListener("notifications:updated", refresh);
    window.addEventListener("submissions:updated", refresh);
    window.addEventListener("session:changed", refresh);
    return () => {
      window.removeEventListener("social:updated", refresh);
      window.removeEventListener("notifications:updated", refresh);
      window.removeEventListener("submissions:updated", refresh);
      window.removeEventListener("session:changed", refresh);
    };
  }, [loadDashboard]);

  const unreadCount = useMemo(
    () => messages.filter((item) => item.status === "unread").length,
    [messages]
  );

  const stats = useMemo(
    () => [
      {
        id: "pending",
        icon: Clock,
        label: "Pending Approvals",
        value: String(statsSnapshot.pendingApprovals),
      },
      {
        id: "approved-today",
        icon: CheckCircle2,
        label: "Approved Today",
        value: String(statsSnapshot.approvedToday),
      },
      {
        id: "active-users",
        icon: Users,
        label: "Active Users",
        value: String(statsSnapshot.activeUsers),
      },
      {
        id: "achievements",
        icon: Trophy,
        label: "Total Achievements",
        value: String(statsSnapshot.totalAchievements),
      },
    ],
    [statsSnapshot]
  );

  return (
    <AppLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage approvals, reports, and system settings
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/reports")}>
              <Download className="w-4 h-4" />
              Export Report
            </Button>
            <Button className="gap-2" onClick={() => navigate("/admin/reports")}>
              <BarChart3 className="w-4 h-4" />
              View Analytics
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/external-competitions")}>
              <Globe className="w-4 h-4" />
              External Competitions
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.id} {...stat} />
          ))}
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button
            onClick={() => setActiveTab("approvals")}
            className={cn(
              "px-6 py-2.5 text-sm font-medium transition-colors",
              activeTab === "approvals"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            Approvals
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={cn(
              "px-6 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === "messages"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            Contact Messages
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === "approvals" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card-static p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-secondary" />
                    Pending Approvals
                  </h2>
                  <span className="badge-status bg-warning/10 text-warning">
                    {pendingApprovals.length} pending
                  </span>
                </div>

                <div className="space-y-3">
                  {loading && (
                    <p className="text-sm text-muted-foreground">Loading approvals...</p>
                  )}
                  {!loading && pendingApprovals.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-border bg-muted/20"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{item.student}</span>
                            <span className="badge-status bg-muted text-muted-foreground text-xs">
                              {item.type}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.competition} - {item.achievement}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Submitted {item.submittedAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {item.proofFiles.map((file, index) => (
                            <Button key={`${item.id}-${index}`} variant="ghost" size="icon-sm" title={file}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loading && pendingApprovals.length === 0 && (
                    <p className="text-sm text-muted-foreground">No pending approvals.</p>
                  )}
                </div>

                <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/admin/approvals")}>
                  View All Pending ({statsSnapshot.pendingApprovals})
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card-static p-5">
                <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5 text-secondary" />
                  Quick Actions
                </h2>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin/external-competitions")}>
                    <Globe className="w-4 h-4" />
                    Manage External Competitions
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin/approvals")}>
                    <Shield className="w-4 h-4" />
                    Review Approvals
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin/social-moderation")}>
                    <MessageSquare className="w-4 h-4" />
                    Moderate Social Feed
                  </Button>
                </div>
              </div>

              <div className="card-static p-5">
                <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-secondary" />
                  Quick Reports
                </h2>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin/reports")}>
                    <BarChart3 className="w-4 h-4" />
                    Attendance Recovery Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin/reports")}>
                    <TrendingUp className="w-4 h-4" />
                    Achievement Summary
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/admin/reports")}>
                    <Users className="w-4 h-4" />
                    Participation Report
                  </Button>
                </div>
              </div>

              <div className="card-static p-5">
                <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-secondary" />
                  Social Control
                </h2>
                <div className="space-y-3">
                  {loading && (
                    <p className="text-sm text-muted-foreground">Loading social posts...</p>
                  )}
                  {!loading && socialPosts.map((post) => (
                    <div
                      key={post.id}
                      className={cn(
                        "p-3 rounded-lg border",
                        post.status === "hidden"
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border bg-muted/30"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium">{post.author}</span>
                        {post.status === "hidden" && (
                          <span className="badge-status bg-destructive/10 text-destructive text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            hidden
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {post.content}
                      </p>
                    </div>
                  ))}
                  {!loading && socialPosts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No social posts.</p>
                  )}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/admin/social-moderation")}>
                  Open Moderation
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card-static p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-secondary" />
                    Contact Messages
                  </h2>
                  <span className="badge-status bg-info/10 text-info">
                    {unreadCount} unread
                  </span>
                </div>

                <div className="space-y-3">
                  {loading && (
                    <p className="text-sm text-muted-foreground">Loading messages...</p>
                  )}
                  {!loading && messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-colors",
                        msg.status === "unread"
                          ? "border-secondary/30 bg-secondary/5 hover:bg-secondary/10"
                          : "border-border bg-muted/20 hover:bg-muted/40",
                        selectedMessage?.id === msg.id && "ring-2 ring-secondary"
                      )}
                      onClick={() => openMessage(msg)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{msg.student}</span>
                          {msg.status === "unread" && (
                            <span className="w-2 h-2 rounded-full bg-secondary" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{msg.submittedAt}</span>
                      </div>
                      <p className="font-medium text-sm text-foreground mb-1">{msg.subject}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
                    </div>
                  ))}
                </div>

                {!loading && messages.length === 0 && (
                  <div className="text-center py-8">
                    <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No messages yet</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card-static p-5">
              <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-secondary" />
                Message Details
              </h2>

              {selectedMessage ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="font-medium">{selectedMessage.student}</p>
                    <p className="text-sm text-muted-foreground">{selectedMessage.email || "-"}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="font-medium">{selectedMessage.subject}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Message</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {loadingMessageDetail ? "Loading..." : selectedMessage.message}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border space-y-2">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => openMessage(selectedMessage)}
                      disabled={loadingMessageDetail}
                    >
                      <Mail className="w-4 h-4" />
                      Refresh Conversation
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground text-sm">Select a message to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
