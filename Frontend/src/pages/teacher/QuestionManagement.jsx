import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { 
  ArrowLeft, Upload, Plus, Edit, Trash2, Search,
  FileText, CheckCircle, AlertCircle, Download, X,
  ChevronDown, MoreVertical, Copy, Eye
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache } from "@/lib/api";

const mapTypeFromBackend = (t) => {
  switch (t) {
    case "MULTIPLE_CHOICE":
      return "mcq";
    case "TRUE_FALSE":
      return "true_false";
    case "FILL_IN_BLANK":
      return "fill_blank";
    default:
      return "mcq";
  }
};

const mapTypeToBackend = (t) => {
  switch (t) {
    case "mcq":
      return "MULTIPLE_CHOICE";
    case "true_false":
      return "TRUE_FALSE";
    case "fill_blank":
      return "FILL_IN_BLANK";
    default:
      return "MULTIPLE_CHOICE";
  }
};

const mapDifficultyFromBackend = (d) => {
  if (!d) return "medium";
  return d.toLowerCase();
};

const mapDifficultyToBackend = (d) => {
  if (!d) return "MEDIUM";
  return d.toUpperCase();
};

const normalizeOptions = (options) =>
  (Array.isArray(options) ? options : [])
    .map((option) => String(option ?? "").trim())
    .filter((option) => option.length > 0);

const optionLabel = (index) => String.fromCharCode(65 + index);

const parseMcqCorrectAnswer = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const typeStyles = {
  mcq: { label: "Multiple Choice", bg: "bg-info/10", text: "text-info" },
  true_false: { label: "True/False", bg: "bg-secondary/10", text: "text-secondary" },
  fill_blank: { label: "Fill in Blank", bg: "bg-achievement/10", text: "text-achievement" },
};

const difficultyStyles = {
  easy: { label: "Easy", bg: "bg-success/10", text: "text-success" },
  medium: { label: "Medium", bg: "bg-warning/10", text: "text-warning" },
  hard: { label: "Hard", bg: "bg-destructive/10", text: "text-destructive" },
};

export default function QuestionManagement() {
  const navigate = useNavigate();
  const { id } = useParams();
  const competitionId = id;
  const location = useLocation();
  const [competitionName, setCompetitionName] = useState(location.state?.competitionName || "");
  const [questions, setQuestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoading(false);
      return;
    }
    if (!competitionId) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/teacher/competitions/${competitionId}/questions`, {
          token,
          ttlMs: 60000,
          force: false,
          cacheKey: `teacher:questions:${competitionId}`,
        });
        const mapped = (Array.isArray(data) ? data : []).map((q) => {
          const type = mapTypeFromBackend(q.questionType);
          const options = type === "mcq" ? normalizeOptions(q.options) : [];
          return {
            id: q.id,
            type,
            question: q.question,
            options,
            correctAnswer: type === "mcq" ? parseMcqCorrectAnswer(q.correctAnswer) : q.correctAnswer,
            marks: q.marks ?? 1,
            difficulty: mapDifficultyFromBackend(q.difficulty),
          };
        });
        setQuestions(mapped);
        // if competition name not provided via state and we have id, try to extract from payload
        if (competitionId && !competitionName && mapped.length > 0 && data.competitionTitle) {
          setCompetitionName(data.competitionTitle || "");
        }
      } catch (e) {
        toast.error("Unable to load questions");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [competitionId]);

  // If competitionId is present but we still don't have a name, fetch the competition minimal info
  useEffect(() => {
    if (!competitionId || competitionName) return;
    const token = localStorage.getItem("userToken");
    if (!token) return;
    (async () => {
      try {
        const c = await fetchJsonCached(`${API_BASE_URL}/api/competitions/${competitionId}`, {
          token,
          ttlMs: 120000,
          force: false,
          cacheKey: `teacher:competition:${competitionId}`,
        });
        setCompetitionName(c.title || c.name || "");
      } catch (e) {
        // ignore
      }
    })();
  }, [competitionId, competitionName]);

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || q.type === typeFilter;
    const matchesDifficulty = difficultyFilter === "all" || q.difficulty === difficultyFilter;
    return matchesSearch && matchesType && matchesDifficulty;
  });

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  const handleSelectAll = () => {
    if (selectedQuestions.length === filteredQuestions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(filteredQuestions.map(q => q.id));
    }
  };

  const handleSelectQuestion = (id) => {
    setSelectedQuestions(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (!competitionId) {
      toast.error("Please open Question Management from a specific competition.");
      return;
    }
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      navigate("/login");
      return;
    }
    const ids = selectedQuestions;
    if (ids.length === 0) return;
    fetch(`${API_BASE_URL}/api/teacher/competitions/${competitionId}/questions`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(ids),
    })
      .then((res) => {
        if (!res.ok) {
          toast.error("Failed to delete questions");
          return;
        }
        setQuestions(prev => prev.filter(q => !ids.includes(q.id)));
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes(`/api/teacher/competitions/${competitionId}/questions`)
            || value.includes("teacher:questions:");
        });
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes("/api/competitions")
            || value.includes("competitions:")
            || value.includes("teacher:question:competitions");
        });
        window.dispatchEvent(new CustomEvent("competitions:updated"));
        toast.success(`${ids.length} questions deleted`);
        setSelectedQuestions([]);
      })
      .catch(() => {
        toast.error("Failed to delete questions");
      });
  };

  const handleDeleteQuestion = (id) => {
    if (!competitionId) {
      toast.error("Please open Question Management from a specific competition.");
      return;
    }
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      navigate("/login");
      return;
    }
    fetch(`${API_BASE_URL}/api/teacher/competitions/${competitionId}/questions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          toast.error("Failed to delete question");
          return;
        }
        setQuestions(prev => prev.filter(q => q.id !== id));
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes(`/api/teacher/competitions/${competitionId}/questions`)
            || value.includes("teacher:questions:");
        });
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes("/api/competitions")
            || value.includes("competitions:")
            || value.includes("teacher:question:competitions");
        });
        window.dispatchEvent(new CustomEvent("competitions:updated"));
        toast.success("Question deleted");
      })
      .catch(() => {
        toast.error("Failed to delete question");
      });
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Simulate validation
      setTimeout(() => {
        setValidationErrors([
          { row: 3, error: "Missing correct answer" },
          { row: 7, error: "Invalid question type" },
        ]);
        toast.info("File processed with 2 validation errors");
      }, 1000);
    }
  };

  const handleDownloadTemplate = () => {
    toast.success("Template downloaded");
  };

  return (
    <AppLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                competitionId
                  ? navigate(`/teacher/competitions/${competitionId}`)
                  : navigate("/teacher/competitions")
              }
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                Question Management
              </h1>
              {competitionName ? (
                <>
                  <p className="text-sm text-muted-foreground">{competitionName}</p>
                  <p className="text-muted-foreground mt-1">
                    {questions.length} questions • {totalMarks} total marks
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground mt-1">
                  {questions.length} questions • {totalMarks} total marks
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setShowUploadModal(true)}>
              <Upload className="w-4 h-4" />
              Upload Excel
            </Button>
            <Button className="gap-2" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Add Question
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-static p-4">
            <p className="text-sm text-muted-foreground">Total Questions</p>
            <p className="text-2xl font-bold text-foreground">{questions.length}</p>
          </div>
          <div className="card-static p-4">
            <p className="text-sm text-muted-foreground">Total Marks</p>
            <p className="text-2xl font-bold text-foreground">{totalMarks}</p>
          </div>
          <div className="card-static p-4">
            <p className="text-sm text-muted-foreground">MCQ Questions</p>
            <p className="text-2xl font-bold text-foreground">{questions.filter(q => q.type === "mcq").length}</p>
          </div>
          <div className="card-static p-4">
            <p className="text-sm text-muted-foreground">Other Types</p>
            <p className="text-2xl font-bold text-foreground">{questions.filter(q => q.type !== "mcq").length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card-static p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Types</option>
                <option value="mcq">Multiple Choice</option>
                <option value="true_false">True/False</option>
                <option value="fill_blank">Fill in Blank</option>
              </select>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedQuestions.length > 0 && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {selectedQuestions.length} selected
              </span>
              <Button variant="outline" size="sm" onClick={() => setSelectedQuestions([])}>
                Clear Selection
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}
        </div>

        {/* Questions List */}
        <div className="card-static divide-y divide-border">
          {/* Header */}
          <div className="p-4 flex items-center gap-4 bg-muted/30">
            <input
              type="checkbox"
              checked={selectedQuestions.length === filteredQuestions.length && filteredQuestions.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-border"
            />
            <span className="text-sm font-medium text-muted-foreground flex-1">Question</span>
            <span className="text-sm font-medium text-muted-foreground w-24 text-center hidden md:block">Type</span>
            <span className="text-sm font-medium text-muted-foreground w-24 text-center hidden md:block">Difficulty</span>
            <span className="text-sm font-medium text-muted-foreground w-16 text-center hidden md:block">Marks</span>
            <span className="text-sm font-medium text-muted-foreground w-24 text-center">Actions</span>
          </div>

          {/* Questions */}
          {loading && (
            <div className="p-6 text-center text-muted-foreground">
              Loading questions...
            </div>
          )}
          {!loading && filteredQuestions.map((question, index) => (
            <div key={question.id} className="p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={selectedQuestions.includes(question.id)}
                onChange={() => handleSelectQuestion(question.id)}
                className="w-4 h-4 rounded border-border mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground font-medium">{index + 1}.</span>
                  <p className="text-foreground">{question.question}</p>
                </div>
                {question.type === "mcq" && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {question.options.map((opt, optIndex) => (
                      <div 
                        key={optIndex}
                        className={cn(
                          "px-3 py-1.5 rounded-md",
                          optIndex === question.correctAnswer 
                            ? "bg-success/10 text-success border border-success/20" 
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {String.fromCharCode(65 + optIndex)}. {opt}
                      </div>
                    ))}
                  </div>
                )}
                {question.type === "true_false" && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Correct Answer: </span>
                    <span className={cn(
                      "font-medium",
                      question.correctAnswer ? "text-success" : "text-destructive"
                    )}>
                      {question.correctAnswer ? "True" : "False"}
                    </span>
                  </p>
                )}
                {question.type === "fill_blank" && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Answer: </span>
                    <span className="font-medium text-success">{question.correctAnswer}</span>
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 md:hidden">
                  <span className={cn("badge-status text-xs", typeStyles[question.type].bg, typeStyles[question.type].text)}>
                    {typeStyles[question.type].label}
                  </span>
                  <span className={cn("badge-status text-xs", difficultyStyles[question.difficulty].bg, difficultyStyles[question.difficulty].text)}>
                    {difficultyStyles[question.difficulty].label}
                  </span>
                  <span className="text-xs text-muted-foreground">{question.marks} marks</span>
                </div>
              </div>
              <span className={cn("badge-status text-xs w-24 justify-center hidden md:flex", typeStyles[question.type].bg, typeStyles[question.type].text)}>
                {typeStyles[question.type].label}
              </span>
              <span className={cn("badge-status text-xs w-24 justify-center hidden md:flex", difficultyStyles[question.difficulty].bg, difficultyStyles[question.difficulty].text)}>
                {difficultyStyles[question.difficulty].label}
              </span>
              <span className="text-sm font-medium text-foreground w-16 text-center hidden md:block">{question.marks}</span>
              <div className="flex items-center gap-1 w-24 justify-center">
                <Button variant="ghost" size="icon-sm" onClick={() => setEditingQuestion(question)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon-sm">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon-sm" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteQuestion(question.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {!loading && filteredQuestions.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No questions found</h3>
              <p className="text-muted-foreground mb-4">Add questions manually or upload from Excel</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setShowUploadModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Excel
                </Button>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-xl p-6 w-full max-w-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Upload Questions from Excel</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => { setShowUploadModal(false); setValidationErrors([]); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <input
                    type="file"
                    id="excelUpload"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                  />
                  <label htmlFor="excelUpload" className="cursor-pointer">
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-foreground font-medium">Click to upload Excel file</p>
                    <p className="text-sm text-muted-foreground mt-1">XLSX or XLS format</p>
                  </label>
                </div>

                <Button variant="outline" className="w-full gap-2" onClick={handleDownloadTemplate}>
                  <Download className="w-4 h-4" />
                  Download Template
                </Button>

                {validationErrors.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="font-medium text-destructive">Validation Errors</span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {validationErrors.map((err, index) => (
                        <li key={index} className="text-destructive">
                          Row {err.row}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => { setShowUploadModal(false); setValidationErrors([]); }}>
                    Cancel
                  </Button>
                  <Button disabled={validationErrors.length > 0}>
                    Import Questions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Question Modal */}
        {(showAddModal || editingQuestion) && (
          <QuestionFormModal 
            question={editingQuestion}
            onClose={() => { setShowAddModal(false); setEditingQuestion(null); }}
            onSave={async (question) => {
              if (!competitionId) {
                toast.error("Please open Question Management from a specific competition.");
                return;
              }
              const token = localStorage.getItem("userToken");
              if (!token) {
                toast.error("Please sign in again");
                navigate("/login");
                return;
              }

                const payload = {
                question: question.question,
                questionType: mapTypeToBackend(question.type),
                options: null,
                marks: Number(question.marks || 1),
                correctAnswer: question.correctAnswer,
                difficulty: mapDifficultyToBackend(question.difficulty),
              };

              if (question.type === "mcq") {
                const indexedOptions = (Array.isArray(question.options) ? question.options : [])
                  .map((option, index) => ({ option: String(option ?? "").trim(), index }))
                  .filter((item) => item.option.length > 0);
                if (indexedOptions.length < 2) {
                  toast.error("Multiple choice questions require at least two filled options.");
                  return;
                }
                const originalCorrectIndex = parseMcqCorrectAnswer(question.correctAnswer);
                const selectedOption = indexedOptions.find((item) => item.index === originalCorrectIndex);
                if (!selectedOption) {
                  toast.error("Please select a valid correct option.");
                  return;
                }
                payload.options = indexedOptions.map((item) => item.option);
                payload.correctAnswer = indexedOptions.findIndex((item) => item.index === selectedOption.index);
              }

              const isEdit = !!question.id;
              const url = isEdit
                ? `${API_BASE_URL}/api/teacher/competitions/${competitionId}/questions/${question.id}`
                : `${API_BASE_URL}/api/teacher/competitions/${competitionId}/questions`;

              try {
                const res = await fetch(url, {
                  method: isEdit ? "PUT" : "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) {
                  let msg = isEdit ? "Failed to update question" : "Failed to add question";
                  try {
                    const ct = res.headers.get("content-type") || "";
                    if (ct.includes("application/json")) {
                      const data = await res.json();
                      msg = data.message || msg;
                    } else {
                      msg = await res.text() || msg;
                    }
                  } catch {}
                  toast.error(msg);
                  return;
                }
                const saved = await res.json();
                const mapped = {
                  id: saved.id,
                  type: mapTypeFromBackend(saved.questionType),
                  question: saved.question,
                  options: mapTypeFromBackend(saved.questionType) === "mcq" ? normalizeOptions(saved.options) : [],
                  correctAnswer: mapTypeFromBackend(saved.questionType) === "mcq"
                    ? parseMcqCorrectAnswer(saved.correctAnswer)
                    : saved.correctAnswer,
                  marks: saved.marks ?? 1,
                  difficulty: mapDifficultyFromBackend(saved.difficulty),
                };

                if (isEdit) {
                  setQuestions(prev => prev.map(q => q.id === mapped.id ? mapped : q));
                  toast.success("Question updated");
                } else {
                  setQuestions(prev => [...prev, mapped]);
                  toast.success("Question added");
                }
                invalidateApiCache((key) => {
                  const value = String(key);
                  return value.includes(`/api/teacher/competitions/${competitionId}/questions`)
                    || value.includes("teacher:questions:");
                });
                invalidateApiCache((key) => {
                  const value = String(key);
                  return value.includes("/api/competitions")
                    || value.includes("competitions:")
                    || value.includes("teacher:question:competitions");
                });
                window.dispatchEvent(new CustomEvent("competitions:updated"));
                setShowAddModal(false);
                setEditingQuestion(null);
              } catch (e) {
                toast.error("Unable to save question");
              }
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

function QuestionFormModal({ question, onClose, onSave }) {
  const [formData, setFormData] = useState(() => {
    if (question) {
      return {
        ...question,
        options: Array.isArray(question.options) && question.options.length > 0
          ? [...question.options]
          : ["", "", "", ""],
        correctAnswer: question.type === "mcq"
          ? parseMcqCorrectAnswer(question.correctAnswer)
          : question.correctAnswer,
      };
    }
    return {
      type: "mcq",
      question: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      marks: 2,
      difficulty: "medium",
    };
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOptionChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt),
    }));
  };

  const addOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...(Array.isArray(prev.options) ? prev.options : []), ""],
    }));
  };

  const removeOption = (index) => {
    setFormData((prev) => {
      const options = Array.isArray(prev.options) ? prev.options : [];
      if (options.length <= 2) {
        return prev;
      }
      const nextOptions = options.filter((_, i) => i !== index);
      let nextCorrect = parseMcqCorrectAnswer(prev.correctAnswer);
      if (nextCorrect === index) {
        nextCorrect = 0;
      } else if (nextCorrect > index) {
        nextCorrect -= 1;
      }
      return {
        ...prev,
        options: nextOptions,
        correctAnswer: nextCorrect,
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {question ? "Edit Question" : "Add New Question"}
          </h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="mcq">Multiple Choice</option>
                <option value="true_false">True/False</option>
                <option value="fill_blank">Fill in Blank</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Difficulty</label>
              <select
                name="difficulty"
                value={formData.difficulty}
                onChange={handleChange}
                className="w-full h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Marks</label>
              <input
                type="number"
                name="marks"
                value={formData.marks}
                onChange={handleChange}
                min="1"
                className="w-full h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Question</label>
            <textarea
              name="question"
              value={formData.question}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Enter your question..."
            />
          </div>

          {formData.type === "mcq" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Options</label>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={formData.correctAnswer === index}
                      onChange={() => setFormData(prev => ({ ...prev, correctAnswer: index }))}
                      className="w-4 h-4"
                    />
                    <span className="w-6 text-muted-foreground">{optionLabel(index)}.</span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${optionLabel(index)}`}
                      className="flex-1 h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {formData.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => removeOption(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Option
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Select the correct answer</p>
            </div>
          )}

          {formData.type === "true_false" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Correct Answer</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={formData.correctAnswer === true}
                    onChange={() => setFormData(prev => ({ ...prev, correctAnswer: true }))}
                    className="w-4 h-4"
                  />
                  <span>True</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={formData.correctAnswer === false}
                    onChange={() => setFormData(prev => ({ ...prev, correctAnswer: false }))}
                    className="w-4 h-4"
                  />
                  <span>False</span>
                </label>
              </div>
            </div>
          )}

          {formData.type === "fill_blank" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Correct Answer</label>
              <input
                type="text"
                name="correctAnswer"
                value={typeof formData.correctAnswer === 'string' ? formData.correctAnswer : ''}
                onChange={handleChange}
                placeholder="Enter the correct answer"
                className="w-full h-10 px-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {question ? "Update Question" : "Add Question"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
