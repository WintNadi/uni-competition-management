import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef } from "react";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";

const Login = lazy(() => import("./pages/Login"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const Competitions = lazy(() => import("./pages/Competitions"));
const CompetitionDetail = lazy(() => import("./pages/CompetitionDetail"));
const Teams = lazy(() => import("./pages/Teams"));
const Submissions = lazy(() => import("./pages/Submissions"));
const SocialFeed = lazy(() => import("./pages/SocialFeed"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const MyExternalCompetitions = lazy(() => import("./pages/MyExternalCompetitions"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Notifications = lazy(() => import("./pages/Notifications"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const TeacherProfile = lazy(() => import("./pages/TeacherProfile"));
const AdminProfile = lazy(() => import("./pages/AdminProfile"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherCompetitions = lazy(() => import("./pages/teacher/TeacherCompetitions"));
const CreateCompetition = lazy(() => import("./pages/teacher/CreateCompetition"));
const QuestionManagement = lazy(() => import("./pages/teacher/QuestionManagement"));
const QuestionCompetitions = lazy(() => import("./pages/teacher/QuestionCompetitions"));
const TeacherSubmissions = lazy(() => import("./pages/teacher/TeacherSubmissions"));
const TeacherLeaderboard = lazy(() => import("./pages/teacher/TeacherLeaderboard"));
const TeacherSocialFeed = lazy(() => import("./pages/teacher/TeacherSocialFeed"));
const TeacherCompetitionDetail = lazy(() => import("./pages/teacher/TeacherCompetitionDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminExternalCompetitions = lazy(() => import("./pages/admin/AdminExternalCompetitions"));
const AdminExternalCompetitionStudents = lazy(() => import("./pages/admin/AdminExternalCompetitionStudents"));
const AdminApprovals = lazy(() => import("./pages/admin/AdminApprovals"));
const AdminSocialModeration = lazy(() => import("./pages/admin/AdminSocialModeration"));
const AdminSocialFeed = lazy(() => import("./pages/admin/AdminSocialFeed"));
const AdminLeaderboard = lazy(() => import("./pages/admin/AdminLeaderboard"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();
const BACKGROUND_PREFETCH_INTERVAL_MS = 90000;
const PREFETCH_TRIGGER_EVENTS = [
  "session:changed",
  "competitions:updated",
  "submissions:updated",
  "notifications:updated",
  "social:updated",
  "teams:updated",
  "profile:avatar-updated",
];

const toUnique = (list) =>
  Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)));

const toUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
};

const prefetchPaths = async ({ token, paths, force = false, ttlMs = 60000 }) => {
  const uniquePaths = toUnique(paths);
  if (!token || uniquePaths.length === 0) return;
  await Promise.allSettled(
    uniquePaths.map((path) =>
      fetchJsonCached(toUrl(path), {
        token,
        force,
        ttlMs,
      })
    )
  );
};

const prefetchTeacherDerived = async ({ token, force = false }) => {
  if (!token) return;
  try {
    const [competitions, submissions] = await Promise.all([
      fetchJsonCached(toUrl("/api/competitions"), { token, force, ttlMs: 60000 }),
      fetchJsonCached(toUrl("/teacher/submissions"), { token, force, ttlMs: 60000 }),
    ]);

    const competitionList = Array.isArray(competitions) ? competitions : [];
    const submissionList = Array.isArray(submissions) ? submissions : [];

    const quizCompetitionIds = toUnique([
      ...competitionList
        .filter((item) => String(item?.format || "").toLowerCase() === "quiz")
        .map((item) => item?.competitionId || item?.id),
      ...submissionList
        .filter((item) => String(item?.submissionType || "").toUpperCase() === "QUIZ")
        .map((item) => item?.competitionId),
    ]);

    const submitterIds = toUnique(
      submissionList.map((item) => item?.submittedBy).filter(Boolean)
    ).slice(0, 80);

    const derivedPaths = [
      ...quizCompetitionIds.map(
        (competitionId) =>
          `/api/teacher/competitions/${encodeURIComponent(String(competitionId))}/questions`
      ),
    ];

    if (submitterIds.length > 0) {
      const query = submitterIds
        .map((id) => `ids=${encodeURIComponent(String(id))}`)
        .join("&");
      derivedPaths.push(`/api/users/basic?${query}`);
    }

    await prefetchPaths({ token, paths: derivedPaths, force, ttlMs: 60000 });
  } catch {
    // Keep prefetch best-effort.
  }
};

const prefetchRoleData = async ({ role, token, force = false }) => {
  if (!token) return;
  const commonPaths = [
    "/api/users/me",
    "/api/notifications",
  ];

  const rolePaths = {
    student: [
      "/api/competitions",
      "/competitions",
      "/competitions/registrations/me",
      "/teams/my",
      "/submissions",
      "/api/external/participations",
      "/api/achievements/me",
      "/api/leaderboard/merit",
      "/api/leaderboard/social",
      "/api/leaderboard/merit?limit=5",
      "/api/leaderboard/social?limit=5",
      "/milestones",
      "/api/social-feed/posts",
    ],
    teacher: [
      "/api/competitions",
      "/teacher/submissions",
      "/api/social-feed/posts",
      "/api/leaderboard/merit",
      "/api/leaderboard/social",
      "/api/leaderboard/merit?timePeriod=all&competitionType=all",
      "/api/leaderboard/social?timePeriod=all",
      "/api/leaderboard/merit?limit=5",
      "/api/leaderboard/social?limit=5",
    ],
    admin: [
      "/api/users/admin/stats",
      "/api/external/participations/admin?status=all",
      "/api/external/participations/admin?status=all&source=all",
      "/api/support/conversations/admin",
      "/api/social-feed/admin/posts",
      "/api/social-feed/posts",
      "/api/achievements",
      "/api/competitions",
      "/api/leaderboard/merit",
      "/api/leaderboard/social",
      "/api/leaderboard/merit?timePeriod=all&competitionType=all",
      "/api/leaderboard/social?timePeriod=all",
      "/api/leaderboard/merit?limit=5",
      "/api/leaderboard/social?limit=5",
      "/api/admin/reports/participation-scope/details?scope=ALL",
    ],
  };

  const normalizedRole = normalizeRole(role || "student");
  const selectedRolePaths = rolePaths[normalizedRole] || rolePaths.student;

  await prefetchPaths({
    token,
    paths: [...commonPaths, ...selectedRolePaths],
    force,
    ttlMs: 60000,
  });

  if (normalizedRole === "teacher") {
    await prefetchTeacherDerived({ token, force });
  }
};

const SessionDataWarmup = () => {
  const inFlightRef = useRef(false);
  const preparedIdentityRef = useRef("");

  useEffect(() => {
    let disposed = false;

    const runPrefetch = async (force = false) => {
      if (disposed || inFlightRef.current) return;
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
      const token = localStorage.getItem("userToken");
      if (!isLoggedIn || !token) {
        preparedIdentityRef.current = "";
        return;
      }

      const role = normalizeRole(localStorage.getItem("userRole") || "student");
      const identity = `${role}:${token}`;
      if (!force && preparedIdentityRef.current === identity) {
        return;
      }

      inFlightRef.current = true;
      preparedIdentityRef.current = identity;
      try {
        await prefetchRoleData({ role, token, force });
      } finally {
        inFlightRef.current = false;
      }
    };

    runPrefetch(false);

    const intervalId = window.setInterval(() => {
      runPrefetch(true);
    }, BACKGROUND_PREFETCH_INTERVAL_MS);

    const handleTrigger = () => {
      runPrefetch(true);
    };

    PREFETCH_TRIGGER_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleTrigger);
    });

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      PREFETCH_TRIGGER_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleTrigger);
      });
    };
  }, []);

  return null;
};

const RouteLoading = () => (
  <div className="min-h-screen w-full flex items-center justify-center text-muted-foreground">
    Loading...
  </div>
);

const normalizeRole = (roleValue) =>
  String(roleValue || "").replace(/^ROLE_/i, "").toLowerCase();

const defaultRouteForRole = (roleValue) => {
  const role = normalizeRole(roleValue || "student");
  if (role === "teacher") return "/teacher";
  if (role === "admin") return "/admin";
  return "/student";
};

const HomeRedirect = () => {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={defaultRouteForRole(localStorage.getItem("userRole"))} replace />;
};

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const RoleRoute = ({ children, allowedRoles = [] }) => {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  const role = normalizeRole(localStorage.getItem("userRole") || "student");
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={defaultRouteForRole(role)} replace />;
  }
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SessionDataWarmup />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />

            {/* Student Routes */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/student" element={<RoleRoute allowedRoles={["student"]}><StudentDashboard /></RoleRoute>} />
            <Route path="/competitions" element={<RoleRoute allowedRoles={["student"]}><Competitions /></RoleRoute>} />
            <Route path="/competitions/:id" element={<RoleRoute allowedRoles={["student"]}><CompetitionDetail /></RoleRoute>} />
            <Route path="/teams" element={<RoleRoute allowedRoles={["student"]}><Teams /></RoleRoute>} />
            <Route path="/submissions" element={<RoleRoute allowedRoles={["student"]}><Submissions /></RoleRoute>} />
            <Route path="/social" element={<RoleRoute allowedRoles={["student"]}><SocialFeed /></RoleRoute>} />
            <Route path="/leaderboard" element={<RoleRoute allowedRoles={["student"]}><Leaderboard /></RoleRoute>} />
            <Route path="/my-external-competitions" element={<RoleRoute allowedRoles={["student"]}><MyExternalCompetitions /></RoleRoute>} />
            <Route path="/contact" element={<RoleRoute allowedRoles={["student"]}><ContactUs /></RoleRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/profile" element={<RoleRoute allowedRoles={["student"]}><StudentProfile /></RoleRoute>} />

            {/* Teacher Routes */}
            <Route path="/teacher" element={<RoleRoute allowedRoles={["teacher"]}><TeacherDashboard /></RoleRoute>} />
            <Route path="/teacher/profile" element={<RoleRoute allowedRoles={["teacher"]}><TeacherProfile /></RoleRoute>} />
            <Route path="/teacher/competitions" element={<RoleRoute allowedRoles={["teacher"]}><TeacherCompetitions /></RoleRoute>} />
            <Route path="/teacher/competitions/create" element={<RoleRoute allowedRoles={["teacher"]}><CreateCompetition /></RoleRoute>} />
            <Route path="/teacher/competitions/:id" element={<RoleRoute allowedRoles={["teacher"]}><TeacherCompetitionDetail /></RoleRoute>} />
            <Route path="/teacher/competitions/:id/edit" element={<RoleRoute allowedRoles={["teacher"]}><CreateCompetition /></RoleRoute>} />
            <Route path="/teacher/competitions/:id/questions" element={<RoleRoute allowedRoles={["teacher"]}><QuestionManagement /></RoleRoute>} />
            <Route path="/teacher/questions" element={<RoleRoute allowedRoles={["teacher"]}><QuestionCompetitions /></RoleRoute>} />
            <Route path="/teacher/submissions" element={<RoleRoute allowedRoles={["teacher"]}><TeacherSubmissions /></RoleRoute>} />
            <Route path="/teacher/leaderboard" element={<RoleRoute allowedRoles={["teacher"]}><TeacherLeaderboard /></RoleRoute>} />
            <Route path="/teacher/social" element={<RoleRoute allowedRoles={["teacher"]}><TeacherSocialFeed /></RoleRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<RoleRoute allowedRoles={["admin"]}><AdminDashboard /></RoleRoute>} />
            <Route path="/admin/profile" element={<RoleRoute allowedRoles={["admin"]}><AdminProfile /></RoleRoute>} />
            <Route path="/admin/external-competitions" element={<RoleRoute allowedRoles={["admin"]}><AdminExternalCompetitions /></RoleRoute>} />
            <Route path="/admin/external-competitions/:competitionId/students" element={<RoleRoute allowedRoles={["admin"]}><AdminExternalCompetitionStudents /></RoleRoute>} />
            <Route path="/admin/approvals" element={<RoleRoute allowedRoles={["admin"]}><AdminApprovals /></RoleRoute>} />
            <Route path="/admin/social-moderation" element={<RoleRoute allowedRoles={["admin"]}><AdminSocialModeration /></RoleRoute>} />
            <Route path="/admin/social" element={<RoleRoute allowedRoles={["admin"]}><AdminSocialFeed /></RoleRoute>} />
            <Route path="/admin/leaderboard" element={<RoleRoute allowedRoles={["admin"]}><AdminLeaderboard /></RoleRoute>} />
            <Route path="/admin/reports" element={<RoleRoute allowedRoles={["admin"]}><AdminReports /></RoleRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
