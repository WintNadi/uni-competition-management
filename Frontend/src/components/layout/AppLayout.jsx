import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Bell, Menu, User, CheckCircle2, XCircle, Clock, Trophy, UserPlus, AlertCircle, X, LogOut, Mail, Phone, Eye, EyeOff, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache, resolveFileUrl } from "@/lib/api";

// Role-based notifications
const getNotificationsForRole = (role) => {
  if (role === "teacher") {
    return [
      {
        id: 1,
        type: "submission",
        title: "New Submissions",
        message: "5 new submissions received for AI Innovation Challenge",
        time: "1 hour ago",
        read: false,
        route: "/teacher/submissions",
      },
      {
        id: 2,
        type: "deadline",
        title: "Deadline Approaching",
        message: "Web Development Quiz submission deadline is in 2 days",
        time: "3 hours ago",
        read: false,
        route: "/teacher/competitions",
      },
      {
        id: 3,
        type: "evaluation",
        title: "Pending Evaluations",
        message: "12 submissions are awaiting your evaluation",
        time: "1 day ago",
        read: true,
        route: "/teacher/submissions",
      },
      {
        id: 4,
        type: "team",
        title: "Team Formation",
        message: "3 new teams formed for Mobile App Challenge",
        time: "2 days ago",
        read: true,
        route: "/teacher/competitions",
      },
    ];
  } else if (role === "admin") {
    return [
      {
        id: 1,
        type: "approval",
        title: "Pending Approvals",
        message: "5 external competition participations need approval",
        time: "30 minutes ago",
        read: false,
        route: "/admin/approvals",
      },
      {
        id: 2,
        type: "report",
        title: "New Report",
        message: "A social post has been flagged for review",
        time: "2 hours ago",
        read: false,
        route: "/admin/social",
      },
      {
        id: 3,
        type: "system",
        title: "System Update",
        message: "Monthly analytics report is ready",
        time: "1 day ago",
        read: true,
        route: "/admin/reports",
      },
    ];
  }
  // Student notifications
  return [
    {
      id: 1,
      type: "achievement",
      title: "Competition Result",
      message: "Your external participation in National Coding Championship has been approved!",
      status: "approved",
      time: "2 hours ago",
      read: false,
      route: "/social",
    },
    {
      id: 2,
      type: "team",
      title: "Team Invitation",
      message: "Alex Park invited you to join team 'DataDragons' for Mobile App Challenge",
      time: "5 hours ago",
      read: false,
      route: "/teams",
      tab: "invitations",
    },
    {
      id: 3,
      type: "deadline",
      title: "Deadline Reminder",
      message: "AI Innovation Challenge submission deadline is in 2 days",
      time: "1 day ago",
      read: true,
      route: "/submissions",
      competitionId: 1,
    },
    {
      id: 4,
      type: "achievement",
      title: "Participation Rejected",
      message: "Your external participation in Regional Hackathon was rejected. Reason: Invalid proof of participation.",
      status: "rejected",
      time: "2 days ago",
      read: true,
      route: "/competitions",
    },
    {
      id: 5,
      type: "achievement",
      title: "Participation Pending",
      message: "Your external participation in International Math Olympiad is under review",
      status: "pending",
      time: "3 days ago",
      read: true,
      route: "/competitions/6",
    },
    {
      id: 6,
      type: "team",
      title: "Join Request",
      message: "Sarah Chen wants to join your team 'CodeCrafters' for AI Innovation Challenge",
      time: "1 hour ago",
      read: false,
      route: "/teams",
      tab: "my-teams",
    },
  ];
};

const notificationIcons = {
  achievement: Trophy,
  competition: Trophy,
  team: UserPlus,
  deadline: AlertCircle,
  submission: FileText,
  evaluation: CheckCircle2,
  approval: CheckCircle2,
  report: AlertCircle,
  system: Bell,
};

const statusColors = {
  approved: "text-success",
  rejected: "text-destructive",
  pending: "text-warning",
};

export function AppLayout({ children, role = "student" }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    role: role,
    avatarUrl: typeof window !== "undefined" ? (localStorage.getItem("userAvatarUrl") || null) : null
  });

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

  // Update profile and notifications based on role
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("userToken");
      if (token) {
        try {
          const data = await fetchJsonCached(`${API_BASE_URL}/api/users/me`, {
            token,
            ttlMs: 180000,
            cacheKey: "users:me",
          });
          const nextAvatarUrl = data.avatarUrl || localStorage.getItem("userAvatarUrl") || null;
          setUserProfile({
            id: data.id,
            name: data.fullName || data.username,
            email: data.email,
            phone: data.phone,
            department: data.department,
            role: data.roles && data.roles.length > 0 ? data.roles[0] : role,
            avatarUrl: nextAvatarUrl,
            bio: data.bio
          });

          // Update localStorage for other components
          if (data.id) {
            localStorage.setItem("userId", data.id);
          }
          if (data.fullName) {
            localStorage.setItem("userName", data.fullName);
          }
          if (data.avatarUrl) {
            localStorage.setItem("userAvatarUrl", data.avatarUrl);
          } else {
            localStorage.removeItem("userAvatarUrl");
          }
        } catch (error) {
          console.error("Failed to fetch profile", error);
        }
      }
    };

    const isParticipationDecisionNotification = (t, title = "", message = "") => {
      const combined = `${title || ""} ${message || ""}`.toLowerCase();
      if (t === "REJECTION" || t === "ROLLBACK") return true;
      if (t === "GENERAL" && combined.includes("participation")) return true;
      return false;
    };

    const mapType = (t, title = "", message = "") => {
      switch (t) {
        case "ACHIEVEMENT_EARNED":
          return "achievement";
        case "COMPETITION_CREATED":
        case "COMPETITION_UPDATED":
        case "COMPETITION_REGISTRATION_OPEN":
        case "COMPETITION_REGISTRATION_CLOSED":
          return "competition";
        case "EXTERNAL_PARTICIPATION_SUBMITTED":
          return "approval";
        case "TEAM_INVITATION":
        case "TEAM_CONFIRMATION":
          return "team";
        case "SUBMISSION_OPEN":
        case "SUBMISSION_SUCCESS":
        case "SUBMISSION_RECEIVED":
        case "SUBMISSION_DEADLINE_PASSED":
        case "SUBMISSION_EVALUATED":
          return "submission";
        case "REJECTION":
        case "ROLLBACK":
          return "approval";
        case "GENERAL":
          return isParticipationDecisionNotification(t, title, message) ? "approval" : "system";
        default:
          return "system";
      }
    };
    const routeForType = (t, relatedEntityId, title = "", message = "") => {
      if (isParticipationDecisionNotification(t, title, message)) {
        return role === "admin" ? "/admin/approvals" : "/submissions";
      }
      if (t === "EXTERNAL_PARTICIPATION_SUBMITTED") {
        return role === "admin" ? "/admin/approvals" : "/notifications";
      }
      if (t === "COMPETITION_CREATED") {
        return relatedEntityId ? `/competitions/${relatedEntityId}` : "/competitions";
      }
      if (t === "COMPETITION_UPDATED") {
        return relatedEntityId ? `/competitions/${relatedEntityId}` : "/competitions";
      }
      if (t === "COMPETITION_REGISTRATION_OPEN" || t === "COMPETITION_REGISTRATION_CLOSED") {
        return relatedEntityId ? `/competitions/${relatedEntityId}` : "/competitions";
      }
      if (t === "TEAM_INVITATION" || t === "TEAM_CONFIRMATION") {
        return "/teams";
      }
      if (t === "SUBMISSION_OPEN") {
        return role === "teacher" ? "/teacher/submissions" : "/submissions";
      }
      if (
        t === "SUBMISSION_SUCCESS"
        || t === "SUBMISSION_RECEIVED"
        || t === "SUBMISSION_DEADLINE_PASSED"
        || t === "SUBMISSION_EVALUATED"
      ) {
        if (role === "teacher") {
          return relatedEntityId
            ? `/teacher/submissions?competition=${encodeURIComponent(relatedEntityId)}`
            : "/teacher/submissions";
        }
        return "/submissions";
      }
      return undefined;
    };
    const fetchNotifications = async () => {
      const token = localStorage.getItem("userToken");
      if (!token) return;
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/notifications`, {
          token,
          ttlMs: 120000,
          cacheKey: "notifications:list",
        });
        const normalized = (Array.isArray(data) ? data : []).map((n) => ({
          id: n.id,
          type: mapType(n.type, n.title, n.message),
          title: n.title,
          message: n.message,
          relatedEntityId: n.relatedEntityId,
          read: !!n.read || !!n.isRead,
          time: formatDateTimeLabel(n.createdAt),
          createdAtRaw: n.createdAt || null,
          route: routeForType(n.type, n.relatedEntityId, n.title, n.message),
        }));
        normalized.sort((first, second) =>
          toTimestamp(second.createdAtRaw) - toTimestamp(first.createdAtRaw)
        );
        setNotifications(normalized);
      } catch (e) {}
    };

    fetchProfile();
    fetchNotifications();
    let es;
    const token = localStorage.getItem("userToken");
    if (token) {
      try {
        es = new EventSource(`${API_BASE_URL}/api/notifications/stream?token=${token}`);
        es.addEventListener("bootstrap", (e) => {
          try {
            const list = JSON.parse(e.data);
            const normalized = (Array.isArray(list) ? list : []).map((n) => ({
              id: n.id,
              type: mapType(n.type, n.title, n.message),
              title: n.title,
              message: n.message,
              relatedEntityId: n.relatedEntityId,
              read: !!n.read || !!n.isRead,
              time: formatDateTimeLabel(n.createdAt),
              createdAtRaw: n.createdAt || null,
              route: routeForType(n.type, n.relatedEntityId, n.title, n.message),
            }));
            normalized.sort((first, second) =>
              toTimestamp(second.createdAtRaw) - toTimestamp(first.createdAtRaw)
            );
            setNotifications(normalized);
          } catch {}
        });
        es.addEventListener("notification", (e) => {
          try {
            const n = JSON.parse(e.data);
            const normalized = {
              id: n.id,
              type: mapType(n.type, n.title, n.message),
              title: n.title,
              message: n.message,
              relatedEntityId: n.relatedEntityId,
              read: !!n.read || !!n.isRead,
              time: formatDateTimeLabel(n.createdAt),
              createdAtRaw: n.createdAt || null,
              route: routeForType(n.type, n.relatedEntityId, n.title, n.message),
            };
            setNotifications((prev) => {
              const exists = prev.some((p) => p.id === normalized.id);
              const next = exists ? prev.map((p) => (p.id === normalized.id ? normalized : p)) : [normalized, ...prev];
              next.sort((first, second) =>
                toTimestamp(second.createdAtRaw) - toTimestamp(first.createdAtRaw)
              );
              return next.slice(0, 100);
            });
            invalidateApiCache((key) => String(key).includes("notifications"));
            window.dispatchEvent(new CustomEvent("notifications:updated"));
            if (
              n.type === "COMPETITION_CREATED" ||
              n.type === "COMPETITION_UPDATED" ||
              n.type === "COMPETITION_REGISTRATION_OPEN" ||
              n.type === "COMPETITION_REGISTRATION_CLOSED"
            ) {
              invalidateApiCache((key) => {
                const value = String(key);
                return value.includes("/competitions")
                  || value.includes("competitions:")
                  || value.includes("competition:");
              });
              window.dispatchEvent(new CustomEvent("competitions:updated"));
            }
            if (
              n.type === "SUBMISSION_OPEN" ||
              n.type === "SUBMISSION_SUCCESS" ||
              n.type === "SUBMISSION_RECEIVED" ||
              n.type === "SUBMISSION_DEADLINE_PASSED" ||
              n.type === "SUBMISSION_EVALUATED" ||
              isParticipationDecisionNotification(n.type, n.title, n.message)
            ) {
              invalidateApiCache((key) => {
                const value = String(key);
                return value.includes("/submissions")
                  || value.includes("/teacher/submissions")
                  || value.includes("/api/external/participations")
                  || value.includes("external:participations:")
                  || value.includes("submissions:")
                  || value.includes("teacher:submissions:");
              });
              window.dispatchEvent(new CustomEvent("submissions:updated"));
            }
          } catch {}
        });
      } catch {}
    }
    return () => {
      if (es) es.close();
    };
  }, [role]);

  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      const next = e?.detail?.avatarUrl;
      if (next !== undefined) {
        setUserProfile((prev) => ({ ...prev, avatarUrl: next || null }));
      }
    };
    window.addEventListener("profile:avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("profile:avatar-updated", handleAvatarUpdate);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const avatarSrc = userProfile.avatarUrl ? resolveFileUrl(userProfile.avatarUrl) : "";
  const handleAvatarError = () => {
    setUserProfile((prev) => ({ ...prev, avatarUrl: null }));
    localStorage.removeItem("userAvatarUrl");
  };

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

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);
    if (notification.route) {
      navigate(notification.route, { state: { tab: notification.tab } });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("user");
    localStorage.removeItem("userToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userAvatarUrl");
    localStorage.removeItem("userId");
    invalidateApiCache();
    window.dispatchEvent(new CustomEvent("session:changed"));
    window.dispatchEvent(new CustomEvent("notifications:updated"));
    window.dispatchEvent(new CustomEvent("competitions:updated"));
    window.dispatchEvent(new CustomEvent("submissions:updated"));
    window.dispatchEvent(new CustomEvent("social:updated"));
    setShowProfile(false);
    navigate("/login");
  };

  const getNotificationIcon = (notification) => {
    if (notification.type === "achievement") {
      if (notification.status === "approved") return <CheckCircle2 className="w-4 h-4 text-success" />;
      if (notification.status === "rejected") return <XCircle className="w-4 h-4 text-destructive" />;
      if (notification.status === "pending") return <Clock className="w-4 h-4 text-warning" />;
    }
    const Icon = notificationIcons[notification.type] || Bell;
    const colorClass = notification.type === "team" ? "text-secondary" : 
                       notification.type === "competition" ? "text-info" :
                       notification.type === "deadline" ? "text-warning" :
                       notification.type === "submission" ? "text-info" :
                       notification.type === "evaluation" ? "text-success" :
                       notification.type === "approval" ? "text-secondary" : "text-muted-foreground";
    return <Icon className={cn("w-4 h-4", colorClass)} />;
  };

  const getNotificationBg = (notification) => {
    if (notification.type === "achievement") {
      if (notification.status === "approved") return "bg-success/10";
      if (notification.status === "rejected") return "bg-destructive/10";
      if (notification.status === "pending") return "bg-warning/10";
    }
    if (notification.type === "team" || notification.type === "approval") return "bg-secondary/10";
    if (notification.type === "competition") return "bg-info/10";
    if (notification.type === "deadline") return "bg-warning/10";
    if (notification.type === "submission") return "bg-info/10";
    if (notification.type === "evaluation") return "bg-success/10";
    return "bg-muted";
  };

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        role={role}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(!collapsed)}
              className="lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
            {/* Search removed as requested */}
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center font-medium">
                    {unreadCount}
                  </span>
                )}
              </Button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  
                  {/* Dropdown Panel */}
                  <div className="absolute right-0 top-full mt-2 w-96 max-h-[520px] bg-card border border-border rounded-xl shadow-lg z-50 flex flex-col overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                      <h3 className="font-display font-semibold text-foreground">Notifications</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-7"
                            onClick={markAllAsRead}
                          >
                            Mark all read
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon-sm"
                          onClick={() => setShowNotifications(false)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Notification List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No notifications yet</p>
                        </div>
                      ) : (
                      notifications.slice(0, 8).map((notification) => {
                          return (
                            <div 
                              key={notification.id}
                              className={cn(
                                "p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer",
                                !notification.read && "bg-secondary/5"
                              )}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                                  getNotificationBg(notification)
                                )}>
                                  {getNotificationIcon(notification)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className={cn(
                                      "text-sm font-medium truncate",
                                      !notification.read && "text-foreground",
                                      notification.read && "text-muted-foreground"
                                    )}>
                                      {notification.title}
                                    </p>
                                    {!notification.read && (
                                      <span className="w-2 h-2 bg-secondary rounded-full flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground/70 mt-1">
                                    {notification.time}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      {notifications.length > 8 && (
                        <div className="p-2 text-center border-t border-border bg-muted/5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Showing 8 of {notifications.length} notifications
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-border bg-muted/30 flex-shrink-0">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full text-xs font-semibold h-9"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/notifications");
                        }}
                      >
                        View All Notifications
                        <Eye className="w-3.5 h-3.5 ml-2" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-8 bg-border mx-2" />
            
            {/* Profile Dropdown */}
            <div className="relative">
              <Button 
                variant="ghost" 
                className="gap-2"
                onClick={() => setShowProfile(!showProfile)}
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" onError={handleAvatarError} />
                  ) : (
                    <span className="text-sm font-medium text-secondary-foreground">
                      {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
                    </span>
                  )}
                </div>
                <span className="hidden lg:inline text-sm font-medium">{userProfile.name || "User"}</span>
              </Button>

              {/* Profile Dropdown Panel */}
              {showProfile && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfile(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                    {/* Profile Header */}
                    <div className="p-4 bg-muted/30 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" onError={handleAvatarError} />
                          ) : (
                            <span className="text-lg font-medium text-secondary-foreground">
                              {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{userProfile.name || "User"}</p>
                          <p className="text-sm text-muted-foreground">{userProfile.role} • {userProfile.department || "General"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Profile Info */}
                    <div className="p-4 space-y-3">
                      {/* Email - Always Public */}
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-foreground">{userProfile.email || "No email"}</p>
                          <p className="text-xs text-muted-foreground">Email • Public</p>
                        </div>
                      </div>

                      {/* Phone - Only visible to teammates (for students) */}
                      {userProfile.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-foreground">{userProfile.phone}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {role === "student" ? (
                                <>
                                  <EyeOff className="w-3 h-3" />
                                  Phone • Only visible to teammates
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3" />
                                  Phone • Contact
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="p-2 border-t border-border">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          setShowProfile(false);
                          const route = role === "teacher" ? "/teacher/profile" : role === "admin" ? "/admin/profile" : "/profile";
                          navigate(route);
                        }}
                      >
                        <User className="w-4 h-4" />
                        Edit Profile
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
