import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Upload,
  Bell,
  MessageSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  BarChart3,
  FileText,
  Shield,
  Menu,
  Award,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const studentNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Trophy, label: "Competitions", path: "/competitions" },
  { icon: Users, label: "My Teams", path: "/teams" },
  { icon: Upload, label: "Submissions", path: "/submissions" },
  { icon: Award, label: "My External Competitions", path: "/my-external-competitions" },
  { icon: MessageSquare, label: "Social Feed", path: "/social" },
  { icon: BarChart3, label: "Leaderboard", path: "/leaderboard" },
  { icon: Mail, label: "Contact Us", path: "/contact" },
];

const teacherNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/teacher" },
  { icon: Trophy, label: "Competitions", path: "/teacher/competitions" },
  { icon: FileText, label: "Questions", path: "/teacher/questions" },
  { icon: Upload, label: "Submissions", path: "/teacher/submissions" },
  { icon: BarChart3, label: "Leaderboard", path: "/teacher/leaderboard" },
  { icon: MessageSquare, label: "Social Feed", path: "/teacher/social" },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Trophy, label: "External Competitions", path: "/admin/external-competitions" },
  { icon: Shield, label: "Approvals", path: "/admin/approvals" },
  { icon: MessageSquare, label: "Social Moderation", path: "/admin/social-moderation" },
  { icon: Award, label: "Social Feed", path: "/admin/social" },
  { icon: BarChart3, label: "Leaderboard", path: "/admin/leaderboard" },
  { icon: FileText, label: "Reports", path: "/admin/reports" },
];

const roleNavItems = {
  student: studentNavItems,
  teacher: teacherNavItems,
  admin: adminNavItems,
};

export function AppSidebar({ role = "student", collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = roleNavItems[role] || studentNavItems;

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const roleLabels = {
    student: "Student Portal",
    teacher: "Teacher Portal",
    admin: "Admin Portal",
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-sidebar-foreground">
              AcademiX
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
            <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className={cn(
            "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed && "hidden"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-3">
          <span className="text-xs font-medium text-sidebar-muted uppercase tracking-wider">
            {roleLabels[role]}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 flex-shrink-0",
                  isActive ? "text-sidebar-primary-foreground" : "text-sidebar-muted group-hover:text-sidebar-foreground"
                )}
              />
              {!collapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>

      {/* Collapse Button (when collapsed) */}
      {collapsed && (
        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            className="w-full text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </aside>
  );
}
