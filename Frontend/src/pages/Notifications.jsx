import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle2, XCircle, Clock, Trophy, UserPlus, AlertCircle, FileText } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache } from "@/lib/api";

const isParticipationDecisionNotification = (t, title = "", message = "") => {
  const combined = `${title || ""} ${message || ""}`.toLowerCase();
  if (t === "REJECTION" || t === "ROLLBACK") return true;
  if (t === "GENERAL" && combined.includes("participation")) return true;
  return false;
};

const mapType = (t, title = "", message = "") => {
  switch (t) {
    case "ACHIEVEMENT_EARNED":
      return { type: "achievement", status: "approved" };
    case "ATTENDANCE_RECOVERY_APPROVAL":
      return { type: "achievement", status: "approved" };
    case "REJECTION":
      return { type: "achievement", status: "rejected" };
    case "ROLLBACK":
      return { type: "achievement", status: "pending" };
    case "GENERAL":
      if (isParticipationDecisionNotification(t, title, message)) {
        if (`${title} ${message}`.toLowerCase().includes("approved")) {
          return { type: "achievement", status: "approved" };
        }
        if (`${title} ${message}`.toLowerCase().includes("rejected")) {
          return { type: "achievement", status: "rejected" };
        }
        return { type: "approval" };
      }
      return { type: "system" };
    case "EXTERNAL_PARTICIPATION_SUBMITTED":
      return { type: "approval" };
    case "TEAM_INVITATION":
    case "TEAM_CONFIRMATION":
      return { type: "team" };
    case "SUBMISSION_SUCCESS":
    case "SUBMISSION_RECEIVED":
    case "SUBMISSION_OPEN":
    case "SUBMISSION_DEADLINE_PASSED":
    case "SUBMISSION_EVALUATED":
      return { type: "submission" };
    case "COMPETITION_CREATED":
    case "COMPETITION_UPDATED":
    case "COMPETITION_REGISTRATION_OPEN":
    case "COMPETITION_REGISTRATION_CLOSED":
      return { type: "deadline" };
    default:
      return { type: "system" };
  }
};

const notificationIcons = {
  achievement: Trophy,
  approval: CheckCircle2,
  team: UserPlus,
  deadline: AlertCircle,
  submission: FileText,
  system: Bell,
};

const statusIcons = {
  approved: CheckCircle2,
  rejected: XCircle,
  pending: Clock,
};

const statusColors = {
  approved: "text-success",
  rejected: "text-destructive",
  pending: "text-warning",
};

const bgColors = {
  achievement: "bg-success/10",
  approval: "bg-secondary/10",
  team: "bg-secondary/10",
  deadline: "bg-warning/10",
  submission: "bg-info/10",
  system: "bg-muted",
};

const resolveNotificationRoute = (rawType, relatedEntityId, role) => {
  switch (rawType) {
    case "COMPETITION_CREATED":
    case "COMPETITION_UPDATED":
    case "COMPETITION_REGISTRATION_OPEN":
    case "COMPETITION_REGISTRATION_CLOSED":
      return relatedEntityId ? `/competitions/${relatedEntityId}` : "/competitions";
    case "TEAM_INVITATION":
    case "TEAM_CONFIRMATION":
      return "/teams";
    case "SUBMISSION_OPEN":
    case "SUBMISSION_SUCCESS":
    case "SUBMISSION_RECEIVED":
    case "SUBMISSION_DEADLINE_PASSED":
    case "SUBMISSION_EVALUATED":
      if (role === "teacher") {
        return relatedEntityId
          ? `/teacher/submissions?competition=${encodeURIComponent(relatedEntityId)}`
          : "/teacher/submissions";
      }
      return "/submissions";
    case "EXTERNAL_PARTICIPATION_SUBMITTED":
      return role === "admin" ? "/admin/approvals" : "/my-external-competitions";
    case "REJECTION":
    case "ROLLBACK":
      return role === "admin" ? "/admin/approvals" : "/submissions";
    default:
      return "";
  }
};

const formatDateTimeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const role = typeof window !== "undefined"
    ? String(localStorage.getItem("userRole") || "student").toLowerCase().replace("role_", "")
    : "student";

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const loadNotifications = async ({ force = false } = {}) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchJsonCached(`${API_BASE_URL}/api/notifications`, {
        token,
        ttlMs: 120000,
        force,
        cacheKey: "notifications:list",
      });
      const normalized = (Array.isArray(data) ? data : []).map((n) => {
        const mapped = mapType(n.type, n.title, n.message);
        const route = isParticipationDecisionNotification(n.type, n.title, n.message)
          ? (role === "admin" ? "/admin/approvals" : "/submissions")
          : resolveNotificationRoute(n.type, n.relatedEntityId, role);
        return {
          id: n.id,
          rawType: n.type,
          relatedEntityId: n.relatedEntityId,
          type: mapped.type,
          status: mapped.status,
          title: n.title || "Notification",
          message: n.message || "",
          read: !!n.read || !!n.isRead,
          time: formatDateTimeLabel(n.createdAt),
          createdAtRaw: n.createdAt || null,
          route,
        };
      });
      normalized.sort((first, second) =>
        toTimestamp(second.createdAtRaw) - toTimestamp(first.createdAtRaw)
      );
      setNotifications(normalized);
    } catch (e) {
      toast.error(e.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications({ force: false });
    const handleNotificationRefresh = () => loadNotifications({ force: false });
    window.addEventListener("notifications:updated", handleNotificationRefresh);
    return () => {
      window.removeEventListener("notifications:updated", handleNotificationRefresh);
    };
  }, []);

  const markAsRead = async (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    const token = localStorage.getItem("userToken");
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      invalidateApiCache((key) => String(key).includes("notifications"));
    } catch {}
  };

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification.id);
    if (notification.route) {
      navigate(notification.route);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const token = localStorage.getItem("userToken");
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      invalidateApiCache((key) => String(key).includes("notifications"));
    } catch {}
  };

  const renderIcon = (n) => {
    if (n.type === "achievement" && n.status) {
      const Icon = statusIcons[n.status] || Bell;
      return <Icon className={cn("w-4 h-4", statusColors[n.status])} />;
    }
    const Icon = notificationIcons[n.type] || Bell;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <AppLayout role={role}>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={markAllAsRead} disabled={notifications.length === 0 || unreadCount === 0}>
              Mark all read
            </Button>
          </div>
        </div>

        <div className="card-static p-0 overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    "w-full text-left p-4 hover:bg-muted/40 transition-colors",
                    !n.read && "bg-secondary/5"
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0", bgColors[n.type] || "bg-muted")}>
                      {renderIcon(n)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-medium truncate", n.read ? "text-muted-foreground" : "text-foreground")}>
                          {n.title}
                        </p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {n.message}
                      </p>
                      {n.time && (
                        <p className="text-xs text-muted-foreground/70 mt-1">{n.time}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
