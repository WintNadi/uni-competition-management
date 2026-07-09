import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Eye,
  CheckCircle,
  Clock,
  FileText,
  Download,
  ExternalLink,
  Users,
  Calendar,
  Star,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  API_BASE_URL,
  fetchJsonCached,
  invalidateApiCache,
  resolveFileUrl,
} from "@/lib/api";

const statusStyles = {
  pending: {
    bg: "bg-warning/10",
    text: "text-warning",
    label: "Pending Review",
  },
  evaluated: { bg: "bg-success/10", text: "text-success", label: "Evaluated" },
};

const readErrorMessage = async (res) => {
  try {
    const data = await res.json();
    return data?.message || data?.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const toSortTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const decodeSafe = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const cleanStoredFileName = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const proofMatch = text.match(/^proof_[0-9a-fA-F-]{36}_(?:\d+_)?(.+)$/);
  if (proofMatch?.[1]) {
    return proofMatch[1];
  }

  const genericMatch = text.match(
    /^(?:avatar|file|upload|material)_[0-9a-fA-F-]{8,}_(.+)$/i,
  );
  if (genericMatch?.[1]) {
    return genericMatch[1];
  }

  return text;
};

const extractDisplayFileName = (fileRef, fallback = "Attachment") => {
  if (!fileRef || typeof fileRef !== "string") return fallback;
  const trimmed = fileRef.trim();
  if (!trimmed) return fallback;

  const plainSegments = trimmed.split("/").filter(Boolean);
  const plainCandidate = decodeSafe(
    plainSegments[plainSegments.length - 1] || "",
  );
  const plainName = cleanStoredFileName(plainCandidate);
  if (plainName && !/^[a-f0-9]{24}$/i.test(plainName)) {
    return plainName;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const fromQuery =
      parsed.searchParams.get("filename") || parsed.searchParams.get("name");
    if (fromQuery) return cleanStoredFileName(decodeSafe(fromQuery));

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    if (
      pathSegments.length >= 4 &&
      pathSegments[0] === "api" &&
      pathSegments[1] === "files"
    ) {
      const fromPath = decodeSafe(pathSegments.slice(3).join("/"));
      if (fromPath) return cleanStoredFileName(fromPath);
    }

    const candidate = decodeSafe(pathSegments[pathSegments.length - 1] || "");
    const cleaned = cleanStoredFileName(candidate);
    if (cleaned && !/^[a-f0-9]{24}$/i.test(cleaned)) {
      return cleaned;
    }
  } catch {
    // ignore parse errors
  }

  return fallback;
};

const mapSubmissionType = (type) => {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "PROJECT") return "repository";
  if (normalized === "QUIZ") return "quiz";
  return "file";
};

const mapStatus = (status) =>
  String(status || "").toUpperCase() === "EVALUATED" ? "evaluated" : "pending";

const normalizeQuestionType = (type) => {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "TRUE_FALSE") return "TRUE_FALSE";
  if (normalized === "FILL_IN_BLANK") return "FILL_IN_BLANK";
  return "MULTIPLE_CHOICE";
};

const resolveCorrectAnswerText = (question) => {
  if (!question) return "-";
  const type = normalizeQuestionType(question.questionType);
  const correct = question.correctAnswer;
  if (correct == null) return "-";

  if (type === "MULTIPLE_CHOICE") {
    if (typeof correct === "number") {
      return Array.isArray(question.options) &&
        question.options[correct] != null
        ? question.options[correct]
        : String(correct);
    }
    const parsed = Number.parseInt(String(correct), 10);
    if (
      !Number.isNaN(parsed) &&
      Array.isArray(question.options) &&
      question.options[parsed] != null
    ) {
      return question.options[parsed];
    }
    return String(correct);
  }

  return String(correct);
};

const isQuizAnswerCorrect = (question, studentAnswerRaw) => {
  if (!question) return false;
  const studentAnswer = String(studentAnswerRaw ?? "").trim();
  if (!studentAnswer) return false;
  const type = normalizeQuestionType(question.questionType);
  const correct = question.correctAnswer;
  if (correct == null) return false;

  if (type === "MULTIPLE_CHOICE") {
    const correctText = resolveCorrectAnswerText(question).trim();
    return (
      studentAnswer === correctText ||
      studentAnswer.toLowerCase() === correctText.toLowerCase()
    );
  }

  const correctText = String(correct).trim();
  return studentAnswer.toLowerCase() === correctText.toLowerCase();
};

const toQuestionMark = (question) => {
  const marks = Number(question?.marks);
  if (!Number.isFinite(marks) || marks < 0) return 0;
  return marks;
};

const buildAutoQuestionScores = (questions, answers) => {
  const questionList = Array.isArray(questions) ? questions : [];
  const answerList = Array.isArray(answers) ? answers : [];
  return questionList.map((question, index) => {
    const answer = answerList[index] ?? "";
    return isQuizAnswerCorrect(question, answer) ? toQuestionMark(question) : 0;
  });
};

const sumQuestionScores = (scores) =>
  (Array.isArray(scores) ? scores : []).reduce(
    (sum, score) => sum + (Number.isFinite(Number(score)) ? Number(score) : 0),
    0,
  );

export default function TeacherSubmissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCompetition = searchParams.get("competition") || "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [competitionFilter, setCompetitionFilter] =
    useState(initialCompetition);
  const [statusFilter, setStatusFilter] = useState("all");
  const [participantFilter, setParticipantFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [scoreInput, setScoreInput] = useState("");
  const [questionScores, setQuestionScores] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [quizQuestionBank, setQuizQuestionBank] = useState({});
  const [competitions, setCompetitions] = useState([
    { id: "all", title: "All Competitions" },
  ]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const syncCompetitionQuery = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "all") {
      next.delete("competition");
    } else {
      next.set("competition", value);
    }
    setSearchParams(next, { replace: true });
  };

  const loadData = async ({ force = false } = {}) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoadError("Please log in as teacher.");
      setSubmissions([]);
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      const competitionsData = await fetchJsonCached(
        `${API_BASE_URL}/api/competitions`,
        {
          token,
          ttlMs: 120000,
          force,
          cacheKey: "teacher:competitions:list",
        },
      );
      const competitionList = Array.isArray(competitionsData)
        ? competitionsData.map((c) => ({
            id: c.competitionId || c.id,
            title: c.title || "Untitled Competition",
            totalMarks: c.totalMarks,
          }))
        : [];
      setCompetitions([
        { id: "all", title: "All Competitions" },
        ...competitionList,
      ]);

      const submissionsUrl =
        competitionFilter !== "all"
          ? `${API_BASE_URL}/teacher/competitions/${competitionFilter}/submissions`
          : `${API_BASE_URL}/teacher/submissions`;
      const submissionsData = await fetchJsonCached(submissionsUrl, {
        token,
        ttlMs: 120000,
        force,
        cacheKey: `teacher:submissions:${competitionFilter}`,
      });
      const rawSubmissions = Array.isArray(submissionsData)
        ? submissionsData
        : [];

      const quizCompetitionIds = [
        ...new Set(
          rawSubmissions
            .filter(
              (s) => String(s.submissionType || "").toUpperCase() === "QUIZ",
            )
            .map((s) => s.competitionId)
            .filter((id) => typeof id === "string" && id.length > 0),
        ),
      ];

      const quizQuestionPairs = await Promise.all(
        quizCompetitionIds.map(async (competitionId) => {
          try {
            const data = await fetchJsonCached(
              `${API_BASE_URL}/api/teacher/competitions/${competitionId}/questions`,
              {
                token,
                ttlMs: 120000,
                force,
                cacheKey: `teacher:questions:${competitionId}`,
              },
            );
            return [competitionId, Array.isArray(data) ? data : []];
          } catch {
            return [competitionId, []];
          }
        }),
      );
      const quizQuestionMap = Object.fromEntries(quizQuestionPairs);
      setQuizQuestionBank(quizQuestionMap);

      const userIds = [
        ...new Set(
          rawSubmissions
            .map((s) => s.submittedBy)
            .filter((id) => typeof id === "string" && id.length > 0),
        ),
      ];

      let userMap = new Map();
      if (userIds.length > 0) {
        const query = userIds
          .map((id) => `ids=${encodeURIComponent(id)}`)
          .join("&");
        try {
          const users = await fetchJsonCached(
            `${API_BASE_URL}/api/users/basic?${query}`,
            {
              token,
              ttlMs: 120000,
              force,
              cacheKey: `users:basic:${query}`,
            },
          );
          const list = Array.isArray(users) ? users : [];
          userMap = new Map(list.map((u) => [u.id, u]));
        } catch {
          userMap = new Map();
        }
      }

      const competitionMap = new Map(competitionList.map((c) => [c.id, c]));
      const mapped = rawSubmissions.map((s) => {
        const type = mapSubmissionType(s.submissionType);
        const status = mapStatus(s.submissionStatus);
        const participant = userMap.get(s.submittedBy);
        const participantName = s.isTeamSubmission
          ? `Team (${participant?.username || s.submittedBy || "Unknown"})`
          : participant?.username || s.submittedBy || "Unknown";
        const competition = competitionMap.get(s.competitionId);

        const quizQuestionPool =
          mapSubmissionType(s.submissionType) === "quiz"
            ? quizQuestionMap[s.competitionId] || []
            : [];

        const quizQuestionIds = Array.isArray(s.quizQuestionIds)
          ? s.quizQuestionIds
          : [];

        // ✅ Use stored randomized order (quizQuestionIds) so answers match correct questions
        const quizQuestions = quizQuestionIds.length
          ? (() => {
              const byId = new Map(
                (quizQuestionPool || [])
                  .filter((q) => q && q.id)
                  .map((q) => [q.id, q]),
              );
              return quizQuestionIds.map((id) => byId.get(id)).filter(Boolean);
            })()
          : quizQuestionPool;

        const quizAnswers = Array.isArray(s.quizAnswers) ? s.quizAnswers : [];
        const answeredCount = Array.isArray(s.quizAnswers)
          ? s.quizAnswers.filter(
              (answer) => String(answer || "").trim().length > 0,
            ).length
          : 0;

        const autoMarksAwarded = Number.isFinite(Number(s.autoMarksAwarded))
          ? Number(s.autoMarksAwarded)
          : null;

        const storedAutoScores = Array.isArray(s.autoQuestionScores)
          ? s.autoQuestionScores
          : [];

        const fallbackAutoScores =
          mapSubmissionType(s.submissionType) === "quiz"
            ? buildAutoQuestionScores(quizQuestions, quizAnswers)
            : [];

        const effectiveAutoScores =
          storedAutoScores.length === quizQuestions.length &&
          quizQuestions.length > 0
            ? storedAutoScores
            : fallbackAutoScores;

        const autoCheckedCount = effectiveAutoScores.reduce(
          (count, score) => count + (Number(score) > 0 ? 1 : 0),
          0,
        );

        const autoScore =
          autoMarksAwarded != null
            ? autoMarksAwarded
            : sumQuestionScores(effectiveAutoScores);

        const computedTotalMarks = quizQuestions.reduce(
          (sum, question) => sum + (Number(question?.marks) || 0),
          0,
        );

        return {
          id: s.submissionId,
          competitionId: s.competitionId,
          competitionTitle: competition?.title || s.competitionId,
          participantName,
          participantType: s.isTeamSubmission ? "team" : "individual",
          submissionType: type,
          submissionUrl: s.repoLink,
          fileRef: s.file,
          fileName: extractDisplayFileName(s.file, "Attachment"),
          submittedAt: formatDateTime(s.submittedAt),
          submittedAtRaw: s.submittedAt || null,
          status,
          score: s.marksAwarded ?? null,

          // ✅ new fields used by UI
          autoMarksAwarded,
          autoQuestionScores: effectiveAutoScores,
          quizQuestionIds,

          feedback: s.feedback || "",
          questionScores: Array.isArray(s.questionScores)
            ? s.questionScores
            : [],
          totalMarks:
            Number(competition?.totalMarks) > 0
              ? Number(competition.totalMarks)
              : computedTotalMarks > 0
                ? computedTotalMarks
                : null,

          studentNote: s.description || "",
          quizScore: answeredCount,
          totalQuestions: quizQuestions.length || quizAnswers.length,
          quizQuestions,
          quizAnswers,
          autoCheckedCount,
          autoScore,
        };
      });

      mapped.sort(
        (a, b) =>
          toSortTimestamp(b.submittedAtRaw) - toSortTimestamp(a.submittedAtRaw),
      );

      setSubmissions(mapped);
    } catch (error) {
      setLoadError(error?.message || "Failed to load submissions.");
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({ force: false });
    const handleSubmissionRefresh = () => loadData({ force: false });
    window.addEventListener("submissions:updated", handleSubmissionRefresh);
    return () => {
      window.removeEventListener(
        "submissions:updated",
        handleSubmissionRefresh,
      );
    };
  }, [competitionFilter]);

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((sub) => {
        const search = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !search ||
          sub.participantName.toLowerCase().includes(search) ||
          sub.competitionTitle.toLowerCase().includes(search);

        const matchesCompetition =
          competitionFilter === "all" ||
          sub.competitionId === competitionFilter;
        const matchesStatus =
          statusFilter === "all" || sub.status === statusFilter;
        const matchesParticipant =
          participantFilter === "all" ||
          sub.participantType === participantFilter;

        return (
          matchesSearch &&
          matchesCompetition &&
          matchesStatus &&
          matchesParticipant
        );
      }),
    [
      submissions,
      searchQuery,
      competitionFilter,
      statusFilter,
      participantFilter,
    ],
  );

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const evaluatedSubmissions = submissions.filter(
    (s) => s.status === "evaluated" && s.score != null && s.totalMarks,
  );
  const evaluatedCount = submissions.filter(
    (s) => s.status === "evaluated",
  ).length;
  const averagePercentage =
    evaluatedSubmissions.length === 0
      ? 0
      : Math.round(
          evaluatedSubmissions.reduce(
            (acc, s) => acc + (s.score / s.totalMarks) * 100,
            0,
          ) / evaluatedSubmissions.length,
        );

  const handleEvaluate = async () => {
    if (!selectedSubmission) return;
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please log in as teacher.");
      return;
    }

    const score = Number(scoreInput);
    if (Number.isNaN(score)) {
      toast.error("Please enter a valid score.");
      return;
    }
    if (
      selectedSubmission.totalMarks != null &&
      (score < 0 || score > selectedSubmission.totalMarks)
    ) {
      toast.error(
        `Score must be between 0 and ${selectedSubmission.totalMarks}.`,
      );
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/evaluation/${selectedSubmission.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            marksAwarded: score,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      toast.success("Submission evaluated successfully.");
      invalidateApiCache((key) => {
        const value = String(key);
        return (
          value.includes("/submissions") ||
          value.includes("/teacher/submissions") ||
          value.includes("submissions:") ||
          value.includes("teacher:submissions:")
        );
      });
      window.dispatchEvent(new CustomEvent("submissions:updated"));
      window.dispatchEvent(new CustomEvent("social:updated"));
      setSelectedSubmission(null);
      setScoreInput("");
      setQuestionScores([]);
      await loadData({ force: false });
    } catch (error) {
      toast.error(error?.message || "Failed to save evaluation.");
    }
  };

  const handleConfirmQuizEvaluation = async () => {
    if (!selectedSubmission) return;
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please log in as teacher.");
      return;
    }

    const quizQuestions = quizQuestionsForReview;
    if (!quizQuestions.length) {
      toast.error("Quiz questions are not available.");
      return;
    }

    const normalizedScores = quizQuestions.map((question, index) => {
      const raw = Number(questionScores[index]);
      const max = toQuestionMark(question);
      const safe = Number.isFinite(raw) ? raw : 0;
      if (safe < 0) return 0;
      if (safe > max) return max;
      return safe;
    });
    const score = sumQuestionScores(normalizedScores);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/evaluation/${selectedSubmission.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            marksAwarded: score,
            questionScores: normalizedScores,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      toast.success("Quiz evaluation confirmed.");
      invalidateApiCache((key) => {
        const value = String(key);
        return (
          value.includes("/submissions") ||
          value.includes("/teacher/submissions") ||
          value.includes("submissions:") ||
          value.includes("teacher:submissions:")
        );
      });
      window.dispatchEvent(new CustomEvent("submissions:updated"));
      window.dispatchEvent(new CustomEvent("social:updated"));
      setSelectedSubmission(null);
      setScoreInput("");
      setQuestionScores([]);
      await loadData({ force: false });
    } catch (error) {
      toast.error(error?.message || "Failed to confirm quiz evaluation.");
    }
  };

  const openFile = (fileNameOrPath) => {
    if (!fileNameOrPath) return;
    const resolved = resolveFileUrl(fileNameOrPath);
    if (!resolved) {
      toast.info(`File reference: ${fileNameOrPath}`);
      return;
    }
    window.open(resolved, "_blank", "noopener,noreferrer");
  };

  const isEvaluated = selectedSubmission?.status === "evaluated";
  const isQuizSubmission = selectedSubmission?.submissionType === "quiz";
  const quizQuestionsForReview = isQuizSubmission
    ? selectedSubmission?.quizQuestions?.length
      ? selectedSubmission.quizQuestions
      : quizQuestionBank[selectedSubmission?.competitionId] || []
    : [];
  const fallbackQuizQuestionScores = isQuizSubmission
    ? buildAutoQuestionScores(
        quizQuestionsForReview,
        selectedSubmission?.quizAnswers || [],
      )
    : [];
  const effectiveQuestionScores = isQuizSubmission
    ? questionScores.length === quizQuestionsForReview.length &&
      questionScores.length > 0
      ? questionScores
      : fallbackQuizQuestionScores
    : [];
  const quizTotalScore = sumQuestionScores(effectiveQuestionScores);
  const handleQuestionScoreChange = (index, rawValue) => {
    const max = toQuestionMark(quizQuestionsForReview[index]);
    const parsed = Number(rawValue);
    const nextValue = Number.isFinite(parsed)
      ? Math.max(0, Math.min(max, parsed))
      : 0;
    setQuestionScores((prev) => {
      const base =
        prev.length === quizQuestionsForReview.length
          ? [...prev]
          : [...fallbackQuizQuestionScores];
      base[index] = nextValue;
      return base;
    });
  };

  return (
    <AppLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Submissions
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and evaluate submissions from competitions you created.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-static p-4">
            <p className="text-sm text-muted-foreground">Total Submissions</p>
            <p className="text-2xl font-bold text-foreground">
              {submissions.length}
            </p>
          </div>
          <div className="card-static p-4 border-l-4 border-l-warning">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
          </div>
          <div className="card-static p-4 border-l-4 border-l-success">
            <p className="text-sm text-muted-foreground">Evaluated</p>
            <p className="text-2xl font-bold text-success">{evaluatedCount}</p>
          </div>
          <div className="card-static p-4">
            <p className="text-sm text-muted-foreground">Avg. Score</p>
            <p className="text-2xl font-bold text-foreground">
              {averagePercentage}%
            </p>
          </div>
        </div>

        <div className="card-static p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by participant or competition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={participantFilter}
                onChange={(e) => setParticipantFilter(e.target.value)}
                className="h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Participation Type</option>
                <option value="team">Team</option>
                <option value="individual">Individual</option>
              </select>

              <select
                value={competitionFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setCompetitionFilter(value);
                  syncCompetitionQuery(value);
                }}
                className="h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.title}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="evaluated">Evaluated</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="card-static p-6 text-center text-muted-foreground">
            Loading submissions...
          </div>
        )}

        {!loading && loadError && (
          <div className="card-static p-6 text-center text-destructive">
            {loadError}
          </div>
        )}

        {!loading && !loadError && (
          <div className="space-y-4">
            {filteredSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="card-static p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">
                        {submission.participantName}
                      </h3>
                      <span
                        className={cn(
                          "badge-status text-xs",
                          statusStyles[submission.status].bg,
                          statusStyles[submission.status].text,
                        )}
                      >
                        {statusStyles[submission.status].label}
                      </span>
                      {submission.participantType === "team" && (
                        <span className="badge-status text-xs bg-info/10 text-info">
                          <Users className="w-3 h-3 mr-1" />
                          Team
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {submission.competitionTitle}
                    </p>

                    {submission.studentNote && (
                      <div className="mt-3 mb-3 p-3 rounded-lg bg-info/5 border border-info/20">
                        <p className="text-xs font-medium text-info mb-1">
                          Student Note
                        </p>
                        <p className="text-sm text-foreground">
                          {submission.studentNote}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {submission.submittedAt}
                      </span>
                      {submission.submissionType === "file" &&
                        submission.fileName && (
                          <span className="flex items-center gap-1 text-info">
                            <FileText className="w-4 h-4" />
                            {submission.fileName}
                          </span>
                        )}
                      {submission.submissionType === "repository" &&
                        submission.submissionUrl && (
                          <a
                            href={submission.submissionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-info hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Repository
                          </a>
                        )}
                      {submission.submissionType === "quiz" && (
                        <span className="flex items-center gap-1 text-secondary">
                          <CheckCircle className="w-4 h-4" />
                          {submission.quizScore}/{submission.totalQuestions}{" "}
                          answered
                        </span>
                      )}
                      {submission.totalMarks != null &&
  (submission.score != null || submission.autoMarksAwarded != null) && (
    <span
      className={cn(
        "flex items-center gap-1 font-semibold",
        submission.status === "evaluated" ? "text-success" : "text-info",
      )}
    >
      <Star className="w-4 h-4" />
      {(submission.score != null ? submission.score : submission.autoMarksAwarded) || 0}/
      {submission.totalMarks}
      {submission.status !== "evaluated" &&
        submission.autoMarksAwarded != null && (
          <span className="ml-2 text-xs text-muted-foreground">(Auto)</span>
        )}
      {submission.status === "evaluated" &&
        submission.autoMarksAwarded != null &&
        submission.score != null &&
        submission.score !== submission.autoMarksAwarded && (
          <span className="ml-2 text-xs text-muted-foreground">
            (Auto {submission.autoMarksAwarded})
          </span>
        )}
    </span>
  )}

                    </div>
                  </div>

                  <div className="flex gap-2">
                    {submission.submissionType === "file" &&
                      submission.fileName && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() =>
                            openFile(submission.fileRef || submission.fileName)
                          }
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </Button>
                      )}
                    <Button
                      size="sm"
                      className="gap-2"
                      variant={
                        submission.status === "evaluated"
                          ? "outline"
                          : "default"
                      }
                      onClick={() => {
                        setSelectedSubmission(submission);
                        const initialScore =
                          submission.score != null
                            ? String(submission.score)
                            : String(
                                Number.isFinite(submission.autoScore)
                                  ? Number(submission.autoScore)
                                  : 0,
                              );
                        setScoreInput(initialScore);
                        if (submission.submissionType === "quiz") {
                          const quizQuestions = submission.quizQuestions?.length
                            ? submission.quizQuestions
                            : quizQuestionBank[submission.competitionId] || [];
                          const autoScores = buildAutoQuestionScores(
                            quizQuestions,
                            submission.quizAnswers || [],
                          );

                          const existingScores =
                            Array.isArray(submission.questionScores) &&
                            submission.questionScores.length ===
                              quizQuestions.length
                              ? submission.questionScores
                              : autoScores;

                          setQuestionScores(existingScores);

                          const normalizedScores = quizQuestions.map(
                            (question, index) => {
                              const raw = Number(existingScores[index]);
                              const max = toQuestionMark(question);
                              if (!Number.isFinite(raw)) {
                                return Math.min(
                                  max,
                                  Math.max(0, autoScores[index] ?? 0),
                                );
                              }
                              return Math.min(max, Math.max(0, raw));
                            },
                          );
                          setQuestionScores(normalizedScores);
                        } else {
                          setQuestionScores([]);
                        }
                      }}
                    >
                      {submission.submissionType === "quiz" ? (
                        <>
                          <Eye className="w-4 h-4" />
                          Review Quiz
                        </>
                      ) : submission.status === "evaluated" ? (
                        <>
                          <Eye className="w-4 h-4" />
                          View
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Evaluate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredSubmissions.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No submissions found
                </h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters.
                </p>
              </div>
            )}
          </div>
        )}

        {selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              className={cn(
                "bg-card rounded-xl p-6 w-full",
                isQuizSubmission
                  ? "max-w-4xl max-h-[90vh] overflow-y-auto"
                  : "max-w-lg",
              )}
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {isQuizSubmission ? "Quiz Review" : "Evaluate Submission"}
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="font-medium text-foreground">
                    {selectedSubmission.participantName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSubmission.competitionTitle}
                  </p>
                </div>

                {isQuizSubmission ? (
                  <>
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <div className="rounded-lg border border-border p-3 bg-muted/20">
                        <p className="text-muted-foreground">Answered</p>
                        <p className="font-semibold text-foreground">
                          {selectedSubmission.quizScore}/
                          {selectedSubmission.totalQuestions}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-3 bg-muted/20">
                        <p className="text-muted-foreground">
                          Auto Checked Correct
                        </p>
                        <p className="font-semibold text-success">
                          {selectedSubmission.autoCheckedCount}/
                          {selectedSubmission.totalQuestions}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-3 bg-muted/20">
                        <p className="text-muted-foreground">Score</p>
                        <p className="font-semibold text-foreground">
                          {quizTotalScore}
                          {selectedSubmission.totalMarks != null
                            ? ` / ${selectedSubmission.totalMarks}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {quizQuestionsForReview.length === 0 && (
                        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                          Quiz question details are not available.
                        </div>
                      )}
                      {quizQuestionsForReview.map((question, index) => {
                        const studentAnswer =
                          selectedSubmission.quizAnswers?.[index] ?? "";
                        const hasOptions =
                          Array.isArray(question.options) &&
                          question.options.length > 0;
                        const correctAnswerText = String(
                          resolveCorrectAnswerText(question) || "",
                        ).trim();
                        const marks = toQuestionMark(question);
                        const questionScore = Number(
                          effectiveQuestionScores[index] ?? 0,
                        );
                        const isAnswerCorrect = isQuizAnswerCorrect(
                          question,
                          studentAnswer,
                        );
                        return (
                          <div
                            key={
                              question.id ||
                              `${selectedSubmission.id}-q-${index}`
                            }
                            className="rounded-lg border border-border p-4"
                          >
                            <p className="text-sm font-medium text-foreground">
                              Q{index + 1}.{" "}
                              {question.question || "Untitled question"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Marks: {marks}
                            </p>
                            {hasOptions && (
                              <div className="mt-3 space-y-1">
                                {question.options.map((option, optionIndex) => {
                                  const normalizedOption = String(
                                    option || "",
                                  ).trim();
                                  const normalizedStudentAnswer = String(
                                    studentAnswer || "",
                                  ).trim();
                                  const normalizedCorrectAnswer =
                                    correctAnswerText;
                                  const isStudentChoice =
                                    normalizedOption.toLowerCase() ===
                                    normalizedStudentAnswer.toLowerCase();
                                  const isCorrectOption =
                                    normalizedOption.toLowerCase() ===
                                    normalizedCorrectAnswer.toLowerCase();
                                  return (
                                    <div
                                      key={`${question.id || index}-opt-${optionIndex}`}
                                      className={cn(
                                        "rounded-md border px-3 py-2 text-sm",
                                        isStudentChoice && isCorrectOption
                                          ? "border-success/40 bg-success/10 text-success"
                                          : isStudentChoice
                                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                                            : isCorrectOption
                                              ? "border-success/30 bg-success/5 text-success"
                                              : "border-border bg-muted/20 text-muted-foreground",
                                      )}
                                    >
                                      <span>{option}</span>
                                      {isStudentChoice && isCorrectOption && (
                                        <span className="ml-2 text-xs font-semibold">
                                          Selected by student (Correct)
                                        </span>
                                      )}
                                      {isStudentChoice && !isCorrectOption && (
                                        <span className="ml-2 text-xs font-semibold">
                                          Selected by student (Incorrect)
                                        </span>
                                      )}
                                      {!isStudentChoice && isCorrectOption && (
                                        <span className="ml-2 text-xs font-semibold">
                                          Correct answer
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="mt-3 text-sm text-foreground">
                              {!hasOptions && (
                                <p
                                  className={cn(
                                    isAnswerCorrect
                                      ? "text-success"
                                      : "text-destructive",
                                  )}
                                >
                                  Student response:{" "}
                                  {studentAnswer || "No answer"}
                                </p>
                              )}
                              {hasOptions &&
                                !String(studentAnswer || "").trim() && (
                                  <p className="text-muted-foreground">
                                    No answer selected.
                                  </p>
                                )}
                              {!hasOptions && (
                                <p className="text-success mt-1">
                                  Correct answer: {correctAnswerText || "-"}
                                </p>
                              )}
                            </div>
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Score for this question (out of {marks})
                              </label>
                              <input
                                type="number"
                                value={questionScore}
                                onChange={(e) =>
                                  handleQuestionScoreChange(
                                    index,
                                    e.target.value,
                                  )
                                }
                                min="0"
                                max={marks}
                                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-lg border border-border p-4 bg-muted/20">
                      <p className="text-sm text-muted-foreground">
                        Total Score (Auto-calculated)
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {quizTotalScore}
                        {selectedSubmission.totalMarks != null
                          ? ` / ${selectedSubmission.totalMarks}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        System auto-check prefilled each question score. You can
                        edit question scores before saving.
                      </p>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedSubmission(null);
                          setScoreInput("");
                          setQuestionScores([]);
                        }}
                      >
                        Close
                      </Button>
                      <Button onClick={handleConfirmQuizEvaluation}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {isEvaluated
                          ? "Update Evaluation"
                          : "Confirm Evaluation"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Score{" "}
                        {selectedSubmission.totalMarks != null
                          ? `(out of ${selectedSubmission.totalMarks})`
                          : ""}
                      </label>
                      <input
                        type="number"
                        value={scoreInput}
                        onChange={(e) => setScoreInput(e.target.value)}
                        min="0"
                        max={selectedSubmission.totalMarks || undefined}
                        className="w-full h-11 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedSubmission(null);
                          setScoreInput("");
                          setQuestionScores([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleEvaluate}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {isEvaluated ? "Update Evaluation" : "Save Evaluation"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
