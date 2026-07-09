import { useEffect, useRef, useState } from "react";
import { 
  Upload, FileText, Link as LinkIcon, Clock, CheckCircle2, 
  XCircle, AlertCircle, Eye, Download, ExternalLink, Shield, X,
  HelpCircle, CheckSquare, Play, Award, Globe
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache, resolveFileUrl } from "@/lib/api";
import { QuizAttempt } from "@/components/quiz/QuizAttempt";
import { toast } from "sonner";

const mapQuestionTypeFromBackend = (value) => {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "MCQ" || normalized === "MULTIPLE_CHOICE") return "mcq";
  if (normalized === "TRUEFALSE" || normalized === "TRUE_FALSE") return "truefalse";
  if (normalized === "FILLBLANK" || normalized === "FILL_BLANK" || normalized === "FILL_IN_BLANK") {
    return "fillblank";
  }
  return "mcq";
};

const normalizeQuizQuestions = (questions) =>
  (Array.isArray(questions) ? questions : []).map((question, index) => ({
    id: question.id || question.questionId || index + 1,
    type: mapQuestionTypeFromBackend(question.type || question.questionType),
    question: question.question || "",
    options: Array.isArray(question.options) ? question.options : null,
    marks: Number(question.marks) || 0,
    answer: null,
  }));

const participationResultOptions = [
  "Winner", "1st Runner Up", "2nd Runner Up", "3rd Place", 
  "Top 5", "Top 10", "Finalist", "Participant"
];

// External submissions - only appear when admin enables them with deadline
const mapExternalSubmissionStatus = (participationStatus, deadline) => {
  const normalized = String(participationStatus || "").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "pending") return "pending_approval";
  if (!deadline) return "pending";
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return "pending";
  return deadlineDate < new Date() ? "overdue" : "pending";
};

const statusConfig = {
  submitted: { icon: CheckCircle2, class: "bg-success/10 text-success", label: "Submitted" },
  pending: { icon: Clock, class: "bg-warning/10 text-warning", label: "Pending" },
  overdue: { icon: AlertCircle, class: "bg-destructive/10 text-destructive", label: "Finished" },
  pending_approval: { icon: Clock, class: "bg-info/10 text-info", label: "Pending Approval" },
  approved: { icon: CheckCircle2, class: "bg-success/10 text-success", label: "Approved" },
  rejected: { icon: XCircle, class: "bg-destructive/10 text-destructive", label: "Rejected" },
};

const submissionTypeLabels = {
  file: { label: "File Upload", icon: Upload, description: "Upload PDF, Word, or Excel files" },
  repo: { label: "Repository Link", icon: LinkIcon, description: "Submit GitHub, GitLab, or Bitbucket link" },
  quiz: { label: "Quiz Submission", icon: HelpCircle, description: "Answer multiple choice, true/false, and fill-in-blank questions" },
  external_proof: { label: "External Proof", icon: Award, description: "Upload certificate/proof for external competition" },
};

const formatDateTime = (value) => {
  if (!value) return "No deadline";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No deadline"
    : date.toLocaleString("en-US", {
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
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const extractDisplayFileName = (fileRef, fallback = "Attachment") => {
  if (!fileRef || typeof fileRef !== "string") return fallback;
  const trimmed = fileRef.trim();
  if (!trimmed) return fallback;

  const cleanStoredFileName = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    const proofMatch = text.match(/^proof_[0-9a-fA-F-]{36}_(?:\d+_)?(.+)$/);
    if (proofMatch?.[1]) {
      return proofMatch[1];
    }
    const genericMatch = text.match(/^(?:avatar|file|upload|material)_[0-9a-fA-F-]{8,}_(.+)$/i);
    if (genericMatch?.[1]) {
      return genericMatch[1];
    }
    return text;
  };

  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const segments = trimmed.split("/").filter(Boolean);
  const basicCandidate = cleanStoredFileName(decode(segments[segments.length - 1] || ""));
  if (basicCandidate && !/^[a-f0-9]{24}$/i.test(basicCandidate)) {
    return basicCandidate;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const queryName = parsed.searchParams.get("filename") || parsed.searchParams.get("name");
    if (queryName) return cleanStoredFileName(decode(queryName));

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    if (pathSegments.length >= 4 && pathSegments[0] === "api" && pathSegments[1] === "files") {
      const withName = cleanStoredFileName(decode(pathSegments.slice(3).join("/")));
      if (withName) return withName;
    }
  } catch {
    // fall through to fallback
  }

  return fallback;
};

const parseFileNameFromDisposition = (value) => {
  if (!value) return "";
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }
  const quotedMatch = value.match(/filename=\"([^\"]+)\"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = value.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim() || "";
};

const toSubmissionType = (format) => {
  switch ((format || "").toUpperCase()) {
    case "PROJECT":
      return "repo";
    case "QUIZ":
      return "quiz";
    case "ASSIGNMENT":
    default:
      return "file";
  }
};

const toQuizAnswerMapByQuestionId = (answers, questions) => {
  if (!answers) return {};
  const questionList = Array.isArray(questions) ? questions : [];
  return questionList.reduce((acc, question, index) => {
    const key = question?.id;
    if (key != null) {
      acc[key] = answers[index] ?? "";
    }
    return acc;
  }, {});
};

const toQuizAnswerList = (answers, questions) => {
  if (!answers) return [];
  const questionList = Array.isArray(questions) ? questions : [];
  const out = questionList.map((question) => {
    const key = question?.id;
    if (key == null) return "";
    return answers[key] ?? "";
  });
  return out;
};

const readErrorMessage = async (res) => {
  try {
    const data = await res.json();
    return data?.message || data?.error || "Request failed";
  } catch {
    return "Request failed";
  }
};

export default function Submissions() {
  const userRole = (localStorage.getItem("userRole") || "student").toLowerCase();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [internalSubmissions, setInternalSubmissions] = useState([]);
  const [externalSubmissions, setExternalSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedProofFiles, setUploadedProofFiles] = useState([]);
  const [repoLink, setRepoLink] = useState("");
  const [showQuizAttempt, setShowQuizAttempt] = useState(false);
  const [viewingQuizAnswers, setViewingQuizAnswers] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [internalNote, setInternalNote] = useState("");
  const [participationResult, setParticipationResult] = useState("");
  const [externalDescription, setExternalDescription] = useState("");
  const [currentUserId, setCurrentUserId] = useState(localStorage.getItem("userId") || "");
  const fileInputRef = useRef(null);
  const hasLoadedDataRef = useRef(false);
  const skipOwnRefreshEventsRef = useRef(0);
  const isLoadingDataRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const pendingReloadForceRef = useRef(false);

  const emitRefreshEvents = (...eventNames) => {
    if (!eventNames.length) return;
    skipOwnRefreshEventsRef.current += eventNames.length;
    eventNames.forEach((eventName) => {
      window.dispatchEvent(new CustomEvent(eventName));
    });
  };

  const loadData = async ({ force = false } = {}) => {
    if (isLoadingDataRef.current) {
      pendingReloadRef.current = true;
      pendingReloadForceRef.current = pendingReloadForceRef.current || force;
      return;
    }

    isLoadingDataRef.current = true;
    const token = localStorage.getItem("userToken");
    if (!token) {
      setInternalSubmissions([]);
      setExternalSubmissions([]);
      setLoadError("Please log in to view submissions.");
      hasLoadedDataRef.current = false;
      setLoading(false);
      isLoadingDataRef.current = false;
      return;
    }

    const shouldShowLoading = !hasLoadedDataRef.current;
    if (shouldShowLoading) {
      setLoading(true);
    }
    setLoadError("");
    try {
      const cachedUserId = localStorage.getItem("userId") || "";
      if (cachedUserId) {
        setCurrentUserId(cachedUserId);
      }
      const [competitions, registrations, submissions, teams, profile, externalParticipations] = await Promise.all([
        fetchJsonCached(`${API_BASE_URL}/competitions`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "competitions:list",
        }),
        fetchJsonCached(`${API_BASE_URL}/competitions/registrations/me`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "registrations:me",
        }),
        fetchJsonCached(`${API_BASE_URL}/submissions`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "submissions:me",
        }),
        fetchJsonCached(`${API_BASE_URL}/teams/my`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "teams:my",
        }),
        cachedUserId
          ? Promise.resolve(null)
          : fetchJsonCached(`${API_BASE_URL}/api/users/me`, {
              token,
              ttlMs: 300000,
              force,
              cacheKey: "users:me",
            }).catch(() => null),
        fetchJsonCached(`${API_BASE_URL}/api/external/participations`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "external:participations:me",
        }).catch(() => []),
      ]);

      const activeStudentId =
        profile?.id || cachedUserId || localStorage.getItem("userId") || "";
      if (profile?.id) {
        localStorage.setItem("userId", profile.id);
      }
      setCurrentUserId(activeStudentId);

      const competitionMap = new Map(
        (Array.isArray(competitions) ? competitions : []).map((c) => [c.competitionId || c.id, c])
      );

      const teamMap = new Map(
        (Array.isArray(teams) ? teams : []).map((t) => [t.teamId, t])
      );

      const submissionIndex = new Map();
      const submissionsByCompetition = new Map();
      (Array.isArray(submissions) ? submissions : []).forEach((s) => {
        const key = s.teamId
          ? `${s.competitionId}:${s.teamId}`
          : `${s.competitionId}:IND:${s.submittedBy}`;
        submissionIndex.set(key, s);

        const competitionId = String(s?.competitionId || "");
        if (!competitionId) return;
        const bucket = submissionsByCompetition.get(competitionId) || [];
        bucket.push(s);
        submissionsByCompetition.set(competitionId, bucket);
      });

      const internal = (Array.isArray(registrations) ? registrations : [])
        .map((reg) => {
          const competition = competitionMap.get(reg.competitionId);
          if (!competition) return null;
          const competitionType = String(competition?.competitionType || competition?.type || "").toUpperCase();
          if (competitionType.includes("EXTERNAL")) return null;

          const isTeam = !!reg.teamId;
          const team = isTeam ? teamMap.get(reg.teamId) : null;
          const submissionType = toSubmissionType(competition.format);
          const registrationCompetitionId = String(reg?.competitionId || "");
          const registrationTeamId = String(reg?.teamId || "");
          const registrationStudentId = String(reg?.studentId || "");
          const submissionKey = isTeam
            ? `${registrationCompetitionId}:${registrationTeamId}`
            : `${registrationCompetitionId}:IND:${registrationStudentId}`;
          let submission = submissionIndex.get(submissionKey);

          // Fallback: endpoint `/submissions` already returns only current student's
          // submissions (or their team submissions), so this safely recovers matches
          // when `studentId`/`submittedBy` differ in shape.
          if (!submission) {
            const candidates = submissionsByCompetition.get(registrationCompetitionId) || [];
            if (isTeam) {
              submission =
                candidates.find(
                  (item) => String(item?.teamId || "") === registrationTeamId
                ) || null;
            } else {
              submission =
                candidates.find((item) => {
                  if (item?.teamId) return false;
                  const submittedBy = String(item?.submittedBy || "");
                  return (
                    submittedBy === registrationStudentId ||
                    submittedBy === String(activeStudentId || "")
                  );
                }) ||
                candidates.find((item) => !item?.teamId) ||
                null;
            }
          }
          const submissionOpenAt = competition.registrationClose || competition.registrationDeadline;
          const deadline = competition.submissionDeadline;

          if (!submission && !isDateReached(submissionOpenAt)) {
            return null;
          }

          const status = submission
            ? "submitted"
            : isDeadlinePassed(deadline)
              ? "overdue"
              : "pending";

          const quiz = submissionType === "quiz"
            ? {
                title: competition.title,
                timeLimit: competition.quizDurationMinutes
                  ? `${competition.quizDurationMinutes} minutes`
                  : "60 minutes",
                questions: [],
              }
            : null;

          return {
            id: reg.id || `${reg.competitionId}-${reg.teamId || reg.studentId}`,
            competitionId: reg.competitionId,
            competition: competition.title,
            teamId: reg.teamId || null,
            studentId: reg.studentId || null,
            team: team ? team.teamName : (isTeam ? "Team" : null),
            teamLeaderId: team ? team.leaderId : null,
            isTeam,
            submissionType,
            submittedAt: submission?.submittedAt ? formatDateTime(submission.submittedAt) : null,
            submittedAtRaw: submission?.submittedAt || null,
            deadline,
            submissionOpenAt,
            status,
            files: submission?.file ? [submission.file] : [],
            repoLink: submission?.repoLink || null,
            rawQuizAnswers: Array.isArray(submission?.quizAnswers) ? submission.quizAnswers : [],
            quizAnswers: null,
            description: submission?.description || "",
            marksAwarded: submission?.marksAwarded ?? null,
            feedback: submission?.feedback || "",
            submissionStatus: submission?.submissionStatus || null,
            totalMarks: competition?.totalMarks ?? null,
            allowedFileTypes: competition?.allowedFileTypes || "",
            canResubmit: submissionType !== "quiz",
            isExternal: false,
            quiz,
            sortDate: submission?.submittedAt || deadline || submissionOpenAt || competition?.createdAt || null,
          };
        })
        .filter(Boolean);

      const quizCompetitionIds = Array.from(
        new Set(
          internal
            .filter((item) => item.submissionType === "quiz")
            .map((item) => item.competitionId)
        )
      );

      let quizQuestionMap = new Map();
      if (quizCompetitionIds.length > 0) {
        const quizPairs = await Promise.all(
          quizCompetitionIds.map(async (competitionId) => {
            const res = await fetch(
              `${API_BASE_URL}/competitions/${competitionId}/submissions/quiz/questions`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) {
              return [competitionId, []];
            }
            const data = await res.json().catch(() => []);
            return [competitionId, normalizeQuizQuestions(data)];
          })
        );
        quizQuestionMap = new Map(quizPairs);
      }

      const internalWithQuizQuestions = internal.map((item) => {
        if (item.submissionType !== "quiz") {
          return item;
        }
        return {
          ...item,
          totalMarks: item.submissionType === "quiz"
            ? (quizQuestionMap.get(item.competitionId) || []).reduce((sum, question) => sum + (Number(question?.marks) || 0), 0)
            : item.totalMarks,
          quiz: {
            ...item.quiz,
            questions: quizQuestionMap.get(item.competitionId) || [],
          },
          quizAnswers: toQuizAnswerMapByQuestionId(
            item.rawQuizAnswers,
            quizQuestionMap.get(item.competitionId) || []
          ),
        };
      });
      internalWithQuizQuestions.sort((a, b) => toTimestamp(b.sortDate) - toTimestamp(a.sortDate));
      setInternalSubmissions(internalWithQuizQuestions);

      const externalCompetitionList = (Array.isArray(competitions) ? competitions : [])
        .filter((competition) => String(competition?.competitionType || "").toUpperCase() === "EXTERNAL")
        .filter((competition) => !!competition?.proofDeadline);
      const participationByCompetitionId = new Map(
        (Array.isArray(externalParticipations) ? externalParticipations : [])
          .filter((item) => item?.competitionId)
          .map((item) => [String(item.competitionId), item])
      );
      const mappedExternal = externalCompetitionList
        .map((competition) => {
          const competitionId = String(competition.competitionId || competition.id || "");
          if (!competitionId) return null;
          const participation = participationByCompetitionId.get(competitionId);
          const deadline = competition.proofDeadline;
          const submittedAtRaw = participation?.updatedAt || participation?.submittedAt || null;
          return {
            id: participation?.id || `external-${competitionId}`,
            externalParticipationId: participation?.id || null,
            competitionId,
            competition: competition.title || "External Competition",
            organizer: competition.organizer || "Unknown organizer",
            scale: competition.scale || "-",
            deadline,
            submittedAt: submittedAtRaw ? formatDateTime(submittedAtRaw) : null,
            submittedAtRaw,
            status: mapExternalSubmissionStatus(participation?.status, deadline),
            files: Array.isArray(participation?.proofFiles) ? participation.proofFiles : [],
            participationResult: participation?.participationResult || null,
            description: participation?.description || "",
            adminNote: participation?.adminNote || participation?.notes || "",
            attendanceRecoveryReport: participation?.attendanceRecoveryReport || null,
            attendanceRecoveryGeneratedAt: participation?.attendanceRecoveryGeneratedAt
              ? formatDateTime(participation.attendanceRecoveryGeneratedAt)
              : null,
            adminEnabled: true,
            isExternal: true,
            websiteLink: competition.websiteLink || competition.website || null,
            sortDate: submittedAtRaw || deadline || competition.startDate || competition.createdAt || null,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aDate = new Date(a.deadline || 0).getTime();
          const bDate = new Date(b.deadline || 0).getTime();
          return bDate - aDate;
        });
      setExternalSubmissions(mappedExternal);
    } catch (error) {
      const message = error?.message || "Failed to load submissions.";
      setLoadError(message);
      setInternalSubmissions([]);
      setExternalSubmissions([]);
    } finally {
      hasLoadedDataRef.current = true;
      if (shouldShowLoading) {
        setLoading(false);
      }
      isLoadingDataRef.current = false;
      if (pendingReloadRef.current) {
        const queuedForce = pendingReloadForceRef.current;
        pendingReloadRef.current = false;
        pendingReloadForceRef.current = false;
        void loadData({ force: queuedForce });
      }
    }
  };

  useEffect(() => {
    if (userRole !== "student") {
      setLoading(false);
      setLoadError("Submissions are available for student role only.");
      return;
    }
    loadData({ force: false });
    const handleSubmissionUpdate = () => {
      if (skipOwnRefreshEventsRef.current > 0) {
        skipOwnRefreshEventsRef.current -= 1;
        return;
      }
      loadData({ force: false });
    };
    window.addEventListener("submissions:updated", handleSubmissionUpdate);
    window.addEventListener("notifications:updated", handleSubmissionUpdate);
    window.addEventListener("competitions:updated", handleSubmissionUpdate);
    window.addEventListener("session:changed", handleSubmissionUpdate);
    return () => {
      window.removeEventListener("submissions:updated", handleSubmissionUpdate);
      window.removeEventListener("notifications:updated", handleSubmissionUpdate);
      window.removeEventListener("competitions:updated", handleSubmissionUpdate);
      window.removeEventListener("session:changed", handleSubmissionUpdate);
    };
  }, [userRole]);

  const matchesInternalTarget = (item, target) => {
    if (!item || !target) return false;
    if (item.competitionId !== target.competitionId) return false;
    if (target.isTeam) {
      if (!item.isTeam) return false;
      if (item.teamId && target.teamId) {
        return item.teamId === target.teamId;
      }
      return item.id === target.id;
    }
    if (item.isTeam) return false;
    if (item.studentId && target.studentId) {
      return item.studentId === target.studentId;
    }
    return item.id === target.id;
  };

  const markInternalSubmittedLocally = (target, patch = {}) => {
    if (!target) return;
    const submittedAtIso = new Date().toISOString();
    const submittedAtLabel = formatDateTime(submittedAtIso);
    setInternalSubmissions((prev) =>
      prev
        .map((item) => {
          if (!matchesInternalTarget(item, target)) {
            return item;
          }
          return {
            ...item,
            status: "submitted",
            submittedAt: submittedAtLabel,
            submittedAtRaw: submittedAtIso,
            sortDate: submittedAtIso,
            ...patch,
          };
        })
        .sort((a, b) => toTimestamp(b.sortDate) - toTimestamp(a.sortDate))
    );
  };

  const markExternalSubmittedLocally = (competitionId, patch = {}) => {
    if (!competitionId) return;
    const submittedAtIso = new Date().toISOString();
    const submittedAtLabel = formatDateTime(submittedAtIso);
    setExternalSubmissions((prev) =>
      prev.map((item) => {
        if (String(item.competitionId) !== String(competitionId)) {
          return item;
        }
        const next = {
          ...item,
          status: "pending_approval",
          submittedAt: submittedAtLabel,
          submittedAtRaw: submittedAtIso,
          sortDate: submittedAtIso,
          ...patch,
        };
        if (!Array.isArray(next.files) || next.files.length === 0) {
          next.files = item.files;
        }
        return next;
      })
    );
  };

  const canSubmit = (submission) => {
    if (!submission.isTeam) return true;
    return submission.teamLeaderId === currentUserId;
  };

  const isDeadlinePassed = (deadline) => {
    if (!deadline) return false;
    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) return false;
    return date < new Date();
  };

  const isDateReached = (value) => {
    if (!value) return true;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return true;
    return date <= new Date();
  };

  const matchesSubmissionFilter = (submission) => {
    if (statusFilter === "all") return true;
    const status = String(submission?.status || "").toLowerCase();
    if (statusFilter === "pending") {
      return status === "pending";
    }
    if (statusFilter === "submitted") {
      if (submission?.isExternal) {
        return status === "pending_approval" || status === "approved" || status === "rejected";
      }
      return status === "submitted";
    }
    return true;
  };

  const deadlineSortValue = (submission) => {
    const rawDeadline = submission?.deadline;
    if (!rawDeadline) return Number.POSITIVE_INFINITY;
    const parsed = new Date(rawDeadline).getTime();
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };

  const latestSortValue = (submission) => {
    const submittedAt = toTimestamp(submission?.submittedAtRaw || submission?.submittedAt || 0);
    if (submittedAt > 0) return submittedAt;
    const activityAt = toTimestamp(submission?.sortDate || 0);
    if (activityAt > 0) return activityAt;
    return toTimestamp(submission?.deadline || 0);
  };

  const isDeadlineOverForSort = (submission) => {
    const status = String(submission?.status || "").toLowerCase();
    if (status === "overdue") return true;
    const rawDeadline = submission?.deadline;
    if (!rawDeadline) return false;
    const parsed = new Date(rawDeadline).getTime();
    if (Number.isNaN(parsed)) return false;
    return parsed < Date.now();
  };

  const byLatestToOldest = (a, b) => {
    return latestSortValue(b) - latestSortValue(a);
  };

  const byNearestDeadlineFirst = (a, b) => {
    const deadlineDiff = deadlineSortValue(a) - deadlineSortValue(b);
    if (deadlineDiff !== 0) return deadlineDiff;
    return byLatestToOldest(a, b);
  };

  const byAllTabPriority = (a, b) => {
    const aOver = isDeadlineOverForSort(a);
    const bOver = isDeadlineOverForSort(b);
    if (aOver !== bOver) {
      return aOver ? 1 : -1;
    }

    if (!aOver && !bOver) {
      // Active submissions first by nearest deadline (few minutes left shown first).
      const activeDeadlineDiff = deadlineSortValue(a) - deadlineSortValue(b);
      if (activeDeadlineDiff !== 0) return activeDeadlineDiff;
      return byLatestToOldest(a, b);
    }

    // Overdue submissions: latest overdue deadline first.
    const overdueDeadlineDiff = deadlineSortValue(b) - deadlineSortValue(a);
    if (overdueDeadlineDiff !== 0) return overdueDeadlineDiff;
    return byLatestToOldest(a, b);
  };

  const sortComparator = statusFilter === "all"
    ? byAllTabPriority
    : statusFilter === "pending"
      ? byNearestDeadlineFirst
      : byLatestToOldest;

  const filteredInternalSubmissions = internalSubmissions
    .filter(matchesSubmissionFilter)
    .slice()
    .sort(sortComparator);
  const filteredExternalSubmissions = externalSubmissions
    .filter((submission) => submission.adminEnabled)
    .filter(matchesSubmissionFilter)
    .slice()
    .sort(sortComparator);
  const filteredAllSubmissions = [...filteredInternalSubmissions, ...filteredExternalSubmissions]
    .sort(sortComparator);
  const visibleExternalCount = externalSubmissions.filter((submission) => submission.adminEnabled).length;
  const visibleAllCount = internalSubmissions.length + visibleExternalCount;

  const openSubmitModal = (submission) => {
    if (submission.status === "overdue") {
      toast.error("Submission is finished. Deadline is over.");
      return;
    }

    if (submission.submissionType === "quiz" && submission.status === "submitted") {
      setSelectedSubmission(submission);
      setViewingQuizAnswers(submission.quizAnswers);
      setShowQuizAttempt(true);
      return;
    }
    
    if (submission.submissionType === "quiz" && submission.status === "pending") {
      if ((submission.quiz?.questions?.length || 0) === 0) {
        toast.error("Quiz questions are not available yet. Ask teacher to publish questions.");
        return;
      }
      setSelectedSubmission(submission);
      setShowQuizAttempt(true);
      return;
    }
    
    setSelectedSubmission(submission);
    setShowSubmitModal(true);
    setUploadedFile(null);
    setUploadedProofFiles([]);
    setRepoLink(submission.repoLink || "");
    setInternalNote(submission.description || "");
    setParticipationResult(submission.participationResult || "");
    setExternalDescription(submission.description || "");
  };

  const handleFileUpload = (e) => {
    if (selectedSubmission?.isExternal) {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const invalid = files.find((file) => {
        const ext = file.name.split(".").pop().toLowerCase();
        return !["png", "pdf"].includes(ext);
      });
      if (invalid) {
        toast.error("Only PNG and PDF files are allowed for external submissions");
        return;
      }
      setUploadedProofFiles((prev) => {
        const next = [...prev];
        for (const file of files) {
          if (!next.some((existing) => existing.name === file.name && existing.size === file.size)) {
            next.push(file);
          }
        }
        return next;
      });
      return;
    }

    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      // Check custom allowed file types for internal submissions
      if (!selectedSubmission?.isExternal && selectedSubmission?.allowedFileTypes) {
        const allowedExts = selectedSubmission.allowedFileTypes.split(',').map(t => t.replace('.', '').trim());
        if (!allowedExts.includes(ext)) {
          toast.error(`Only ${selectedSubmission.fileTypeDescription || selectedSubmission.allowedFileTypes} files are allowed`);
          return;
        }
      }
      setUploadedFile(file);
    }
  };

  const removeUploadedProofFile = (index) => {
    setUploadedProofFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleFileView = (fileRef) => {
    if (!fileRef) return;
    const url = resolveFileUrl(fileRef);
    if (!url) {
      toast.error("File link is not available.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleFileDownload = async (fileRef, fallbackName = "attachment") => {
    if (!fileRef) return;
    const token = localStorage.getItem("userToken");
    const url = resolveFileUrl(fileRef);
    if (!url) {
      toast.error("File link is not available.");
      return;
    }

    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("Download failed");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const headerFileName = parseFileNameFromDisposition(response.headers.get("content-disposition"));
      const fileName = headerFileName || extractDisplayFileName(fileRef, fallbackName);
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      handleFileView(fileRef);
    }
  };

  const handleQuizSubmit = async (answers) => {
    if (!selectedSubmission) return;
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please log in to submit.");
      return;
    }

    try {
      const totalQuestions = selectedSubmission.quiz?.questions?.length || 0;
      const payload = {
        quizAnswers: toQuizAnswerList(answers, selectedSubmission.quiz?.questions || []).slice(0, totalQuestions),
        questionIds: (selectedSubmission.quiz?.questions || []).map((question) => question.id),
      };

      const res = await fetch(
        `${API_BASE_URL}/competitions/${selectedSubmission.competitionId}/submissions/quiz`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      toast.success("Quiz submitted!");
      markInternalSubmittedLocally(selectedSubmission, {
        rawQuizAnswers: payload.quizAnswers,
        quizAnswers: answers,
      });
      setStatusFilter("submitted");
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/submissions")
          || value.includes("/competitions/registrations/me")
          || value.includes("submissions:")
          || value.includes("registrations:me");
      });
      emitRefreshEvents("submissions:updated");
      void loadData({ force: false });
    } catch (error) {
      toast.error(error?.message || "Failed to submit quiz.");
    } finally {
      setShowQuizAttempt(false);
      setSelectedSubmission(null);
      setViewingQuizAnswers(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSubmission) return;

    if (selectedSubmission.isExternal) {
      const canResubmit =
        selectedSubmission.status === "pending" || selectedSubmission.status === "rejected";
      if (!canResubmit || isDeadlinePassed(selectedSubmission.deadline)) {
        toast.error("External proof cannot be submitted right now.");
        return;
      }
      if (uploadedProofFiles.length === 0) {
        toast.error("Please upload proof files (PNG or PDF)");
        return;
      }
      if (!participationResult) {
        toast.error("Please select your participation result");
        return;
      }
      if (!externalDescription.trim()) {
        toast.error("Please provide a description of your participation");
        return;
      }
      const token = localStorage.getItem("userToken");
      if (!token) {
        toast.error("Please log in to submit.");
        return;
      }
      try {
        const createRes = await fetch(`${API_BASE_URL}/api/external/participations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            competitionId: selectedSubmission.competitionId,
            title: selectedSubmission.competition,
            description: externalDescription.trim(),
            participationResult,
          }),
        });
        if (!createRes.ok) {
          throw new Error(await readErrorMessage(createRes));
        }
        const created = await createRes.json();
        const participationId = created?.id;
        if (!participationId) {
          throw new Error("External submission was created but ID is missing.");
        }

        const uploadedUrls = [];
        for (const file of uploadedProofFiles) {
          const formData = new FormData();
          formData.append("file", file);
          const uploadRes = await fetch(`${API_BASE_URL}/api/external/participations/${participationId}/proof`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (!uploadRes.ok) {
            throw new Error(await readErrorMessage(uploadRes));
          }
          const uploadBody = await uploadRes.json().catch(() => null);
          const uploadedUrl = uploadBody?.message || uploadBody?.url || uploadBody?.file || null;
          if (uploadedUrl) {
            uploadedUrls.push(uploadedUrl);
          }
        }

        toast.success("External participation proof submitted for admin approval!");
        markExternalSubmittedLocally(selectedSubmission.competitionId, {
          externalParticipationId: participationId,
          files: uploadedUrls.length > 0 ? uploadedUrls : undefined,
          participationResult,
          description: externalDescription.trim(),
        });
        setStatusFilter("submitted");
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes("/api/external/participations")
            || value.includes("/api/competitions")
            || value.includes("/api/notifications")
            || value.includes("external:participations:")
            || value.includes("competitions:")
            || value.includes("notifications");
        });
        emitRefreshEvents("submissions:updated", "notifications:updated");
        setShowSubmitModal(false);
        setUploadedProofFiles([]);
        setParticipationResult("");
        setExternalDescription("");
        void loadData({ force: false });
      } catch (error) {
        toast.error(error?.message || "Failed to submit external participation proof.");
      }
      return;
    }

    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please log in to submit.");
      return;
    }

    const competitionId = selectedSubmission.competitionId;
    const isUpdate = selectedSubmission.status === "submitted";

    try {
      let endpoint = "";
      let payload = {};

      if (selectedSubmission.submissionType === "file") {
        const fileName = uploadedFile?.name || selectedSubmission.files?.[0];
        if (!fileName) {
          toast.error("Please upload a file before submitting.");
          return;
        }
        if (!internalNote.trim()) {
          toast.error("Please provide your submission note.");
          return;
        }
        endpoint = `/competitions/${competitionId}/submissions/assignment`;
        payload = { file: fileName, description: internalNote.trim() };
      } else if (selectedSubmission.submissionType === "repo") {
        const link = repoLink || selectedSubmission.repoLink;
        if (!link) {
          toast.error("Please provide a repository link.");
          return;
        }
        if (!internalNote.trim()) {
          toast.error("Please provide your submission note.");
          return;
        }
        endpoint = `/competitions/${competitionId}/submissions/project`;
        payload = { repoLink: link, description: internalNote.trim() };
      } else {
        toast.error("Unsupported submission type.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const savedSubmission = await res.json().catch(() => null);
      if (selectedSubmission.submissionType === "file") {
        markInternalSubmittedLocally(selectedSubmission, {
          files: savedSubmission?.file
            ? [savedSubmission.file]
            : (payload.file ? [payload.file] : selectedSubmission.files),
          description: savedSubmission?.description || payload.description || selectedSubmission.description,
        });
      } else if (selectedSubmission.submissionType === "repo") {
        markInternalSubmittedLocally(selectedSubmission, {
          repoLink: savedSubmission?.repoLink || payload.repoLink || selectedSubmission.repoLink,
          description: savedSubmission?.description || payload.description || selectedSubmission.description,
        });
      } else {
        markInternalSubmittedLocally(selectedSubmission);
      }
      setStatusFilter("submitted");

      toast.success("Submission successful!");
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/submissions")
          || value.includes("/competitions/registrations/me")
          || value.includes("submissions:")
          || value.includes("registrations:me");
      });
      emitRefreshEvents("submissions:updated");
      setShowSubmitModal(false);
      setInternalNote("");
      setUploadedFile(null);
      setRepoLink("");
      void loadData({ force: false });
    } catch (error) {
      toast.error(error?.message || "Failed to submit.");
    }
  };

  if (userRole !== "student") {
    return (
      <AppLayout role={userRole}>
        <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-foreground">My Submissions</h1>
          <div className="card-static p-6 text-center text-muted-foreground">
            Submissions are available for student role only.
          </div>
        </div>
      </AppLayout>
    );
  }

  // Quiz full-screen mode
  if (showQuizAttempt && selectedSubmission?.quiz) {
    return (
      <QuizAttempt
        quiz={selectedSubmission.quiz}
        onSubmit={handleQuizSubmit}
        onCancel={() => {
          setShowQuizAttempt(false);
          setSelectedSubmission(null);
          setViewingQuizAnswers(null);
        }}
        submittedAnswers={viewingQuizAnswers}
        isViewMode={viewingQuizAnswers !== null}
      />
    );
  }

  const renderInternalSubmission = (submission) => {
    const StatusIcon = statusConfig[submission.status].icon;
    const isLeader = canSubmit(submission);
    const TypeInfo = submissionTypeLabels[submission.submissionType];
    const isQuiz = submission.submissionType === "quiz";
    const hasQuizQuestions = (submission.quiz?.questions?.length || 0) > 0;
    const isSubmissionOver = submission.status === "overdue";
    const showEvaluation = isDeadlinePassed(submission.deadline)
      && (submission.marksAwarded != null || (submission.feedback && submission.feedback.trim().length > 0));
    
    return (
      <div key={submission.id} className="card-static p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-lg">{submission.competition}</h3>
              <span className={cn("badge-status", statusConfig[submission.status].class)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig[submission.status].label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {submission.isTeam ? (
                <>
                  <span>Team: {submission.team}</span>
                  <span className="badge-status bg-muted text-muted-foreground text-xs">
                    {isLeader ? "You are Leader" : "Team Member"}
                  </span>
                </>
              ) : (
                <span className="badge-status bg-accent text-accent-foreground text-xs">
                  Individual
                </span>
              )}
              <span className="badge-status bg-secondary/10 text-secondary text-xs flex items-center gap-1">
                <TypeInfo.icon className="w-3 h-3" />
                {TypeInfo.label}
              </span>
              {!isQuiz && (
                <span className="badge-status bg-info/10 text-info text-xs">
                  Resubmission allowed
                </span>
              )}
              {isQuiz && (
                <span className="badge-status bg-warning/10 text-warning text-xs">
                  No resubmission
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-warning" />
              <span>Deadline: <strong className="text-foreground">{formatDateTime(submission.deadline)}</strong></span>
            </div>
          </div>
        </div>

        {submission.status === "submitted" ? (
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Submitted on {submission.submittedAt}
            </p>
            {!isQuiz && submission.description && (
              <p className="text-sm text-foreground">{submission.description}</p>
            )}
            {showEvaluation && (
              <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                <p className="text-xs text-success font-medium">Evaluation Result</p>
                {submission.marksAwarded != null && (
                  <p className="text-sm text-foreground mt-1">
                    Score: <strong>{submission.marksAwarded}</strong>
                    {submission.totalMarks != null && submission.totalMarks > 0 ? ` / ${submission.totalMarks}` : ""}
                  </p>
                )}
                {submission.feedback && (
                  <p className="text-sm text-foreground mt-1">{submission.feedback}</p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {submission.files.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm"
                >
                  <FileText className="w-4 h-4 text-secondary" />
                  {extractDisplayFileName(file, `File ${index + 1}`)}
                  <Button 
                    variant="ghost" 
                    size="icon-sm"
                    onClick={() => handleFileView(file)}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon-sm"
                    onClick={() => handleFileDownload(file)}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {submission.repoLink && (
                <a 
                  href={submission.repoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm hover:bg-muted transition-colors"
                >
                  <LinkIcon className="w-4 h-4 text-secondary" />
                  Repository
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {isQuiz && submission.quizAnswers && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
                  <CheckSquare className="w-4 h-4" />
                  Quiz Completed ({Object.values(submission.quizAnswers).filter(a => a !== "").length}/{submission.quiz.questions.length} answered)
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1"
                onClick={() => openSubmitModal(submission)}
              >
                <Eye className="w-4 h-4" />
                {isQuiz ? "View Answers" : "View Submission"}
              </Button>
            </div>
          </div>
        ) : (
          <div className={cn(
            "rounded-lg p-4",
            isLeader ? "bg-warning/5 border border-warning/20" : "bg-muted/30 border border-border"
          )}>
            {isLeader ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", isSubmissionOver ? "text-destructive" : "text-warning")} />
                  <div>
                    <p className="font-medium text-foreground">{isSubmissionOver ? "Submission Finished" : "Submission Required"}</p>
                    <p className="text-sm text-muted-foreground">
                      {isSubmissionOver ? "Submission deadline has passed. You cannot submit now." : TypeInfo.description}
                    </p>
                  </div>
                </div>
                
                {submission.submissionType === "file" && (
                  <div 
                    className={cn(
                      "border-2 border-dashed border-border rounded-lg p-4 text-center transition-colors",
                      isSubmissionOver ? "opacity-60 cursor-not-allowed bg-muted/40" : "hover:border-secondary cursor-pointer"
                    )}
                    onClick={() => {
                      if (!isSubmissionOver) {
                        openSubmitModal(submission);
                      }
                    }}
                  >
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Upload Files</p>
                    <p className="text-xs text-muted-foreground">
                      {submission.fileTypeDescription || ".pdf, .doc, .docx, .xlsx up to 50MB"}
                    </p>
                  </div>
                )}
                
                {submission.submissionType === "repo" && (
                  <div 
                    className={cn(
                      "border-2 border-dashed border-border rounded-lg p-4 text-center transition-colors",
                      isSubmissionOver ? "opacity-60 cursor-not-allowed bg-muted/40" : "hover:border-secondary cursor-pointer"
                    )}
                    onClick={() => {
                      if (!isSubmissionOver) {
                        openSubmitModal(submission);
                      }
                    }}
                  >
                    <LinkIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Add Repository Link</p>
                    <p className="text-xs text-muted-foreground">GitHub, GitLab, Bitbucket</p>
                  </div>
                )}
                
                {submission.submissionType === "quiz" && (
                  <div 
                    className={cn(
                      "border-2 border-dashed border-secondary/50 rounded-lg p-6 text-center transition-colors",
                      hasQuizQuestions
                        ? (isSubmissionOver ? "bg-muted/40 cursor-not-allowed opacity-80" : "bg-secondary/5 cursor-pointer hover:bg-secondary/10")
                        : "bg-muted/40 cursor-not-allowed opacity-80"
                    )}
                    onClick={() => {
                      if (!isSubmissionOver) {
                        openSubmitModal(submission);
                      }
                    }}
                  >
                    <Play className="w-10 h-10 mx-auto text-secondary mb-3" />
                    <p className="text-lg font-semibold text-foreground">Start Quiz</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {submission.quiz?.questions.length || 0} questions • {submission.quiz?.timeLimit}
                    </p>
                    <p className="text-xs text-warning mt-2 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Full-screen mode â€¢ No resubmission allowed
                    </p>
                    {!hasQuizQuestions && (
                      <p className="text-xs text-destructive mt-2">
                        No published questions yet.
                      </p>
                    )}
                  </div>
                )}
                
                <Button 
                  className="w-full mt-4" 
                  disabled={isSubmissionOver || (isQuiz && !hasQuizQuestions)}
                  onClick={() => openSubmitModal(submission)}
                >
                  {submission.submissionType === "quiz" ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Quiz
                    </>
                  ) : (
                    "Submit Entry"
                  )}
                </Button>
              </>
            ) : (
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Waiting for Team Leader</p>
                  <p className="text-sm text-muted-foreground">
                    Only the team leader can submit for this competition. Contact your team leader to submit the project.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderExternalSubmission = (submission) => {
    const StatusIcon = statusConfig[submission.status].icon;
    const deadlinePassed = isDeadlinePassed(submission.deadline);
    const canSubmitNow = !deadlinePassed && (submission.status === "pending" || submission.status === "rejected");
    const isViewOnly = !canSubmitNow;
    
    return (
      <div key={submission.id} className="card-static p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-lg">{submission.competition}</h3>
              <span className={cn("badge-status", statusConfig[submission.status].class)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig[submission.status].label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Globe className="w-4 h-4" />
                {submission.organizer}
              </span>
              <span className="badge-status bg-accent text-accent-foreground text-xs">
                {submission.scale}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-warning" />
              <span>Deadline: <strong className="text-foreground">{formatDateTime(submission.deadline)}</strong></span>
            </div>
          </div>
        </div>

        {/* Info text - initial submit */}
        {submission.status === "pending" && (
          <div className="bg-info/5 border border-info/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-info flex items-center gap-2">
              <Award className="w-4 h-4" />
              External participation can be uploaded for this competition.
            </p>
          </div>
        )}

        {/* Info text - rejected resubmission */}
        {submission.status === "rejected" && !deadlinePassed && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-warning flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Rejected by admin. You can resubmit before the proof deadline.
            </p>
            {submission.adminNote && (
              <p className="text-xs text-muted-foreground mt-1">
                Reason: <strong className="text-foreground">{submission.adminNote}</strong>
              </p>
            )}
          </div>
        )}

        {/* View-only notice for pending_approval and approved */}
        {isViewOnly && (
          <div className={cn(
            "rounded-lg p-3 mb-4 flex items-center gap-3",
            submission.status === "approved" 
              ? "bg-success/10 border border-success/20" 
              : "bg-info/10 border border-info/20"
          )}>
            {submission.status === "approved" ? (
              <>
                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="font-medium text-success text-sm">Approved</p>
                  <p className="text-xs text-muted-foreground">Your participation has been verified</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-info/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-info" />
                </div>
                <div>
                  <p className="font-medium text-info text-sm">Pending Review</p>
                  <p className="text-xs text-muted-foreground">Your submission is being reviewed by admin</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Rejected notice */}
        {submission.status === "rejected" && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-destructive flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Your submission was rejected.
            </p>
            {submission.adminNote && (
              <p className="text-xs text-muted-foreground mt-1">
                Reason: <strong className="text-foreground">{submission.adminNote}</strong>
              </p>
            )}
          </div>
        )}
        {submission.status === "approved" && submission.attendanceRecoveryReport && (
          <div className="bg-success/5 border border-success/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-success font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Attendance Recovery Report
            </p>
            <p className="text-sm text-foreground mt-1">{submission.attendanceRecoveryReport}</p>
            {submission.attendanceRecoveryGeneratedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Generated at {submission.attendanceRecoveryGeneratedAt}
              </p>
            )}
          </div>
        )}

        {submission.status === "overdue" ? (
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <p className="text-sm text-muted-foreground">
              Proof submission deadline is over. You can no longer submit for this competition.
            </p>
          </div>
        ) : !canSubmitNow ? (
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Submitted on {submission.submittedAt}
            </p>
            {submission.description && (
              <p className="text-sm text-foreground">{submission.description}</p>
            )}
            {submission.status === "rejected" && submission.adminNote && (
              <p className="text-xs text-muted-foreground">
                Reason: <strong className="text-foreground">{submission.adminNote}</strong>
              </p>
            )}
            {submission.status === "approved" && submission.attendanceRecoveryReport && (
              <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                <p className="text-xs text-success font-medium">Attendance Recovery Report</p>
                <p className="text-sm text-foreground mt-1">{submission.attendanceRecoveryReport}</p>
                {submission.attendanceRecoveryGeneratedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Generated at {submission.attendanceRecoveryGeneratedAt}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {submission.files.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm"
                >
                  <FileText className="w-4 h-4 text-secondary" />
                  {extractDisplayFileName(file, `Proof File ${index + 1}`)}
                  <Button 
                    variant="ghost" 
                    size="icon-sm"
                    onClick={() => handleFileView(file)}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon-sm"
                    onClick={() => handleFileDownload(file)}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {submission.participationResult && (
                <span className="badge-status bg-secondary/10 text-secondary">
                  Result: {submission.participationResult}
                </span>
              )}
            </div>
            
            {/* View button for approved/pending_approval */}
            {isViewOnly && (
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1"
                  onClick={() => {
                    setSelectedSubmission(submission);
                    setShowSubmitModal(true);
                    setParticipationResult(submission.participationResult || "");
                    setExternalDescription(submission.description || "");
                  }}
                >
                  <Eye className="w-4 h-4" />
                  View Submission
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg p-4 bg-muted/30 border border-border">
            <div 
              className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-secondary transition-colors cursor-pointer"
              onClick={() => openSubmitModal(submission)}
            >
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Upload Proof Files</p>
              <p className="text-xs text-muted-foreground">PNG or PDF files only</p>
            </div>
            
            <Button 
              className="w-full mt-4" 
              onClick={() => openSubmitModal(submission)}
            >
              {submission.status === "rejected" ? "Resubmit Participation Proof" : "Submit Participation Proof"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout role="student">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Submissions
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your competition submissions
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-6 py-2.5 text-sm font-medium transition-colors",
              activeTab === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            All ({visibleAllCount})
          </button>
          <button
            onClick={() => setActiveTab("internal")}
            className={cn(
              "px-6 py-2.5 text-sm font-medium transition-colors",
              activeTab === "internal"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            Internal ({internalSubmissions.length})
          </button>
          <button
            onClick={() => setActiveTab("external")}
            className={cn(
              "px-6 py-2.5 text-sm font-medium transition-colors",
              activeTab === "external"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            External ({visibleExternalCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("pending")}
          >
            Pending
          </Button>
          <Button
            variant={statusFilter === "submitted" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("submitted")}
          >
            Submitted
          </Button>
        </div>

        {/* Info Banner */}
        {activeTab === "all" && (
          <div className="bg-muted/40 border border-border rounded-lg p-4 flex items-start gap-3">
            <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">All Submissions</p>
              <p className="text-sm text-muted-foreground">
                Active submissions are shown first by nearest deadline. Overdue items are listed after that from latest overdue deadline to oldest.
              </p>
            </div>
          </div>
        )}

        {activeTab === "internal" && (
          <div className="bg-info/10 border border-info/20 rounded-lg p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Submission Guidelines</p>
              <p className="text-sm text-muted-foreground">
                For team competitions, only the team leader can submit. Each competition allows only one type of submission. 
                <strong> File and repository submissions can be resubmitted within the deadline. Quiz submissions cannot be changed once submitted.</strong>
              </p>
            </div>
          </div>
        )}

        {activeTab === "external" && (
          <div className="bg-accent/50 border border-accent rounded-lg p-4 flex items-start gap-3">
            <Award className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">External Participation</p>
              <p className="text-sm text-muted-foreground">
                Upload proof of your participation in external competitions. Submit a description, your result, and proof files (PNG or PDF). 
                <strong> If admin rejects your proof, you can resubmit before the deadline.</strong>
              </p>
            </div>
          </div>
        )}

        {/* Submissions List */}
        <div className="space-y-4">
          {(activeTab === "all" || activeTab === "internal") && loading && (
            <div className="card-static p-6 text-center text-muted-foreground">
              Loading submissions...
            </div>
          )}
          {(activeTab === "all" || activeTab === "internal") && !loading && loadError && (
            <div className="card-static p-6 text-center text-destructive">
              {loadError}
            </div>
          )}
          {activeTab === "all" && !loading && !loadError && filteredAllSubmissions.map((submission) => (
            submission.isExternal
              ? renderExternalSubmission(submission)
              : renderInternalSubmission(submission)
          ))}
          {activeTab === "internal" && !loading && !loadError && filteredInternalSubmissions.map(renderInternalSubmission)}
          {activeTab === "external" && filteredExternalSubmissions.map(renderExternalSubmission)}
        </div>

        {activeTab === "all" && !loading && !loadError && filteredAllSubmissions.length === 0 && (
          <div className="card-static p-12 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No submissions found for this filter.</p>
          </div>
        )}

        {activeTab === "internal" && !loading && !loadError && filteredInternalSubmissions.length === 0 && (
          <div className="card-static p-12 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No internal submissions found for this filter.</p>
          </div>
        )}

        {activeTab === "external" && filteredExternalSubmissions.length === 0 && (
          <div className="card-static p-12 text-center">
            <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No external submissions found for this filter.</p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={selectedSubmission?.isExternal 
            ? ".png,.pdf" 
            : (selectedSubmission?.allowedFileTypes || ".pdf,.doc,.docx,.xlsx,.xls,.zip")}
          multiple={!!selectedSubmission?.isExternal}
          onChange={handleFileUpload}
        />

        {/* Submit Modal */}
        {showSubmitModal && selectedSubmission && (() => {
          const isExternalViewOnly = selectedSubmission.isExternal && (
            selectedSubmission.status === "approved"
            || selectedSubmission.status === "pending_approval"
            || selectedSubmission.status === "overdue"
            || (selectedSubmission.status === "rejected" && isDeadlinePassed(selectedSubmission.deadline))
          );
          
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
            <div className="card-static w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 m-4 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-xl">
                  {selectedSubmission.isExternal 
                    ? (isExternalViewOnly ? "View Submission" : "Submit External Participation Proof")
                    : (selectedSubmission.status === "submitted" ? "View Submission" : "Submit Entry")} - {selectedSubmission.competition}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowSubmitModal(false); setInternalNote(""); }}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* External Proof Submission */}
                {selectedSubmission.isExternal && (
                  <>
                    {/* View-only banner */}
                    {isExternalViewOnly && (
                      <div className={cn(
                        "rounded-lg p-3 mb-2",
                        selectedSubmission.status === "approved" 
                          ? "bg-success/10 border border-success/20" 
                          : selectedSubmission.status === "pending_approval"
                            ? "bg-warning/10 border border-warning/20"
                            : "bg-muted/50 border border-border"
                      )}>
                        <p className={cn(
                          "text-sm flex items-center gap-2",
                          selectedSubmission.status === "approved"
                            ? "text-success"
                            : selectedSubmission.status === "pending_approval"
                              ? "text-warning"
                              : "text-muted-foreground"
                        )}>
                          {selectedSubmission.status === "approved" ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              This submission has been approved. View-only mode.
                            </>
                          ) : selectedSubmission.status === "pending_approval" ? (
                            <>
                              <Clock className="w-4 h-4" />
                              This submission is pending review. View-only mode.
                            </>
                          ) : selectedSubmission.status === "rejected" ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              This submission was rejected and deadline is over. View-only mode.
                            </>
                          ) : selectedSubmission.status === "overdue" ? (
                            <>
                              <Clock className="w-4 h-4" />
                              Proof deadline is over. View-only mode.
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4" />
                              View-only mode.
                            </>
                          )}
                        </p>
                      </div>
                    )}

                    {selectedSubmission.status === "rejected" && selectedSubmission.adminNote && (
                      <div className="rounded-lg p-3 bg-destructive/5 border border-destructive/20">
                        <p className="text-sm text-destructive">
                          Rejection reason: <strong className="text-foreground">{selectedSubmission.adminNote}</strong>
                        </p>
                      </div>
                    )}
                    {selectedSubmission.status === "approved" && selectedSubmission.attendanceRecoveryReport && (
                      <div className="rounded-lg p-3 bg-success/5 border border-success/20">
                        <p className="text-sm text-success font-medium">Attendance Recovery Report</p>
                        <p className="text-sm text-foreground mt-1">{selectedSubmission.attendanceRecoveryReport}</p>
                        {selectedSubmission.attendanceRecoveryGeneratedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Generated at {selectedSubmission.attendanceRecoveryGeneratedAt}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">
                        Description {!isExternalViewOnly && <span className="text-destructive">*</span>}
                      </label>
                      {isExternalViewOnly ? (
                        <div className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm">
                          {selectedSubmission.description || "No description provided"}
                        </div>
                      ) : (
                        <textarea
                          placeholder="Describe your participation in this competition..."
                          rows={3}
                          value={externalDescription}
                          onChange={(e) => setExternalDescription(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">
                        Participation Result {!isExternalViewOnly && <span className="text-destructive">*</span>}
                      </label>
                      {isExternalViewOnly ? (
                        <div className="w-full h-10 px-3 flex items-center rounded-lg bg-muted/30 border border-border text-sm">
                          {selectedSubmission.participationResult || "Not specified"}
                        </div>
                      ) : (
                        <select
                          value={participationResult}
                          onChange={(e) => setParticipationResult(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Select your result</option>
                          {participationResultOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">
                        Proof Files {!isExternalViewOnly && <span className="text-destructive">*</span>}
                      </label>
                      {isExternalViewOnly ? (
                        <div className="rounded-lg p-4 bg-muted/30 border border-border">
                          {selectedSubmission.files.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedSubmission.files.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm">
                                  <FileText className="w-4 h-4 text-secondary" />
                                  <span className="font-medium">{extractDisplayFileName(file, `Proof File ${idx + 1}`)}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon-sm"
                                    onClick={() => handleFileView(file)}
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon-sm"
                                    onClick={() => handleFileDownload(file)}
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No files uploaded</p>
                          )}
                        </div>
                      ) : (
                        <div 
                          className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-secondary transition-colors cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadedProofFiles.length > 0 ? (
                            <div className="space-y-2">
                              {uploadedProofFiles.map((file, idx) => (
                                <div key={`${file.name}-${idx}`} className="flex items-center justify-center gap-2">
                                  <FileText className="w-6 h-6 text-secondary" />
                                  <span className="font-medium">{file.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-2"
                                    onClick={(e) => { e.stopPropagation(); removeUploadedProofFile(idx); }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              <p className="text-xs text-muted-foreground mt-2">Click to add more proof files</p>
                            </div>
                          ) : selectedSubmission.files.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground mb-2">Current submission:</p>
                              {selectedSubmission.files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-center gap-2">
                                  <FileText className="w-6 h-6 text-secondary" />
                                  <span className="font-medium">{extractDisplayFileName(file, `Proof File ${idx + 1}`)}</span>
                                </div>
                              ))}
                              <p className="text-xs text-muted-foreground mt-2">Click to upload a new file</p>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                              <p className="text-sm font-medium">Click to upload proof files</p>
                              <p className="text-xs text-muted-foreground">PNG or PDF files only</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Internal File Upload Submission */}
                {!selectedSubmission.isExternal && selectedSubmission.submissionType === "file" && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Upload File</label>
                    <div 
                      className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-secondary transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadedFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-8 h-8 text-secondary" />
                          <div className="text-left">
                            <p className="font-medium">{uploadedFile.name}</p>
                            <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="ml-2"
                            onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : selectedSubmission.files.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground mb-2">Current submission:</p>
                          {selectedSubmission.files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-center gap-2">
                              <FileText className="w-6 h-6 text-secondary" />
                              <span className="font-medium">{extractDisplayFileName(file, `File ${idx + 1}`)}</span>
                              <Button 
                                variant="ghost" 
                                size="icon-sm"
                                onClick={(e) => { e.stopPropagation(); handleFileView(file); }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon-sm"
                                onClick={(e) => { e.stopPropagation(); handleFileDownload(file); }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground mt-2">Click to upload a new file</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedSubmission.fileTypeDescription || ".pdf, .doc, .docx, .xlsx up to 50MB"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Internal Repository Link Submission */}
                {!selectedSubmission.isExternal && selectedSubmission.submissionType === "repo" && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Repository Link</label>
                    <input
                      type="url"
                      placeholder="https://github.com/username/repo"
                      value={repoLink}
                      onChange={(e) => setRepoLink(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter your GitHub, GitLab, or Bitbucket repository URL
                    </p>
                    {selectedSubmission.repoLink && selectedSubmission.status === "submitted" && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Current submission:</p>
                        <a 
                          href={selectedSubmission.repoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-secondary hover:underline"
                        >
                          <LinkIcon className="w-4 h-4" />
                          {selectedSubmission.repoLink}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Notes (Assignment / Project only) */}
                {!selectedSubmission.isExternal && selectedSubmission.submissionType !== "quiz" && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      Submission Note <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      placeholder="Explain your submission approach and key points..."
                      rows={3}
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => { setShowSubmitModal(false); setInternalNote(""); }}>
                  {isExternalViewOnly ? "Close" : "Cancel"}
                </Button>
                {!isExternalViewOnly && (
                  <Button onClick={handleSubmit}>
                    {selectedSubmission.isExternal 
                      ? "Submit for Approval"
                      : (selectedSubmission.status === "submitted" ? "Update Submission" : "Submit")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
        })()}
      </div>
    </AppLayout>
  );
}
