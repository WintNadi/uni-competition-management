import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Trophy, Upload, Calendar, Users,
  FileText, Save, Eye, AlertCircle, CheckCircle,
  Info, X, Trash2
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache, resolveFileUrl } from "@/lib/api";

const formatOptions = [
  { value: "quiz", label: "Quiz", description: "Multiple choice, true/false, fill-in-the-blank questions", icon: FileText },
  { value: "assignment", label: "Assignment", description: "Document upload (PDF, Word, Excel)", icon: Upload },
  { value: "project", label: "Project", description: "Repository link or file submission", icon: Trophy },
];

const participationOptions = [
  { value: "individual", label: "Individual", description: "Each student participates alone" },
  { value: "team", label: "Team", description: "Students form teams to participate" },
];

export default function CreateCompetition() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    format: "quiz",
    participationType: "individual",
    registrationOpen: "",
    registrationClose: "",
    submissionDeadline: "",
    totalMarks: "",
    maxTeamSize: "5",
    minTeamSize: "2",
    rules: "",
    materials: [],
    existingMaterials: [],
    removeMaterials: false,
    allowedFileTypes: ".pdf,.docx,.zip",
    quizTimeAllowed: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const minDateTimeLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const getAuthToken = () => localStorage.getItem("userToken");

  const mapFormatFromBackend = (format) => {
    if (!format) return "project";
    switch (String(format).toLowerCase()) {
      case "quiz":
        return "quiz";
      case "assignment":
        return "assignment";
      case "project":
        return "project";
      default:
        return "project";
    }
  };

  const mapParticipationFromBackend = (type) => {
    if (!type) return "individual";
    switch (type) {
      case "INDIVIDUAL":
        return "individual";
      case "TEAM":
        return "team";
      default:
        return "individual";
    }
  };

  const formatDateForInput = (isoString) => {
    if (!isoString) return "";
    const [datePart, timePart] = isoString.split("T");
    if (!datePart || !timePart) return "";
    const [hours, minutes] = timePart.split(":");
    return `${datePart}T${hours}:${minutes}`;
  };

  const extractMaterialsFromApi = (data) => {
    const names = Array.isArray(data?.materialsFileNames)
      ? data.materialsFileNames
      : data?.materialsFileName
        ? [data.materialsFileName]
        : [];
    const paths = Array.isArray(data?.materialsFilePaths)
      ? data.materialsFilePaths
      : data?.materialsFilePath
        ? [data.materialsFilePath]
        : [];
    return names.map((name, idx) => ({ name, path: paths[idx] || null }));
  };

  useEffect(() => {
    if (!isEdit) return;

    const token = getAuthToken();
    if (!token) {
      toast.error("Please sign in again");
      navigate("/login");
      return;
    }

    const load = async () => {
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/competitions/${id}`, {
          token,
          ttlMs: 120000,
          force: false,
          cacheKey: `teacher:competition:edit:${id}`,
        });
        const closeAt = data.registrationClose || data.registrationDeadline;
        if (closeAt) {
          const closeDate = new Date(closeAt);
          if (!Number.isNaN(closeDate.getTime()) && new Date() >= closeDate) {
            toast.error("Competition cannot be edited after registration closes.");
            navigate(`/teacher/competitions/${id}`);
            return;
          }
        }

        setFormData((prev) => ({
          ...prev,
          title: data.title || "",
          description: data.description || "",
          format: mapFormatFromBackend(data.format),
          participationType: mapParticipationFromBackend(data.participationType),
          registrationOpen: formatDateForInput(data.registrationOpen),
          registrationClose: formatDateForInput(data.registrationClose),
          submissionDeadline: formatDateForInput(data.submissionDeadline),
          totalMarks: data.totalMarks != null ? String(data.totalMarks) : "",
          maxTeamSize: data.maxTeamSize != null ? String(data.maxTeamSize) : prev.maxTeamSize,
          minTeamSize: data.minTeamSize != null ? String(data.minTeamSize) : prev.minTeamSize,
          rules: typeof data.rules === "string" ? data.rules : (Array.isArray(data.rules) ? data.rules.join("\n") : ""),

          materials: [],
          existingMaterials: extractMaterialsFromApi(data),
          removeMaterials: false,
          allowedFileTypes: data.allowedFileTypes || prev.allowedFileTypes,
          quizTimeAllowed: data.quizTimeAllowed != null ? String(data.quizTimeAllowed) : "",
        }));
      } catch (e) {
        toast.error("Unable to load competition");
        navigate("/teacher/competitions");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isEdit]);

  const mapFormatToBackend = (format) => {
    // Backend CompetitionFormat uses @JsonProperty with lowercase values: quiz, assignment, project
    // so we send the lowercase string for Jackson to map correctly.
    return format || null;
  };

  const mapParticipationToBackend = (type) => {
    switch (type) {
      case "individual":
        return "INDIVIDUAL";
      case "team":
        return "TEAM";
      default:
        return null;
    }
  };

  const toBackendDateTime = (value) => {
    if (!value) return null;
    if (String(value).includes("T")) return value;
    return `${value}T00:00:00`;
  };

  const buildRequestPayload = () => {
    const {
      title,
      description,
      format,
      participationType,
      registrationOpen,
      registrationClose,
      submissionDeadline,
      totalMarks,
      minTeamSize,
      maxTeamSize,
      rules,
      allowedFileTypes,
      quizTimeAllowed,
    } = formData;

    const retainedMaterialPaths = formData.existingMaterials
      .map((material) => material?.path)
      .filter((path) => typeof path === "string" && path.trim().length > 0);
    const deleteAllExisting = isEdit && formData.removeMaterials && formData.existingMaterials.length === 0;

    return {
      title,
      description,
      format: mapFormatToBackend(format),
      participationType: mapParticipationToBackend(participationType),
      registrationOpen: toBackendDateTime(registrationOpen),
      registrationClose: toBackendDateTime(registrationClose),
      submissionDeadline: toBackendDateTime(submissionDeadline),
      totalMarks: format === "quiz" ? null : (totalMarks ? Number(totalMarks) : null),
      minTeamSize: participationType === "team" ? Number(minTeamSize || 0) : null,
      maxTeamSize: participationType === "team" ? Number(maxTeamSize || 0) : null,
      rules: rules || null,
      allowedFileTypes: formData.format !== "quiz" ? (allowedFileTypes || null) : null,
      quizTimeAllowed: format === "quiz" && quizTimeAllowed ? Number(quizTimeAllowed) : null,
      deleteMaterials: deleteAllExisting,
      retainedMaterialPaths: isEdit ? retainedMaterialPaths : null,
    };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setFormData(prev => ({
          ...prev,
          materials: [...prev.materials, ...files],
          removeMaterials: prev.existingMaterials.length === 0 ? true : prev.removeMaterials,
        }));
      }
      e.target.value = "";
    };

  const removeNewMaterial = (index) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, idx) => idx !== index),
    }));
  };

  const removeExistingMaterial = (index) => {
    setFormData((prev) => {
      const nextExisting = prev.existingMaterials.filter((_, idx) => idx !== index);
      return {
        ...prev,
        existingMaterials: nextExisting,
        removeMaterials: nextExisting.length === 0,
      };
    });
  };

  const clearExistingMaterials = () => {
    setFormData((prev) => ({
      ...prev,
      existingMaterials: [],
      removeMaterials: true,
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.registrationOpen) newErrors.registrationOpen = "Registration open date is required";
    if (!formData.registrationClose) newErrors.registrationClose = "Registration close date is required";
    if (!formData.submissionDeadline) newErrors.submissionDeadline = "Submission deadline is required";
    if (formData.format !== "quiz" && (!formData.totalMarks || parseInt(formData.totalMarks) <= 0)) {
      newErrors.totalMarks = "Total marks must be greater than 0";
    }

    // Date validations
    if (formData.registrationOpen && formData.registrationClose) {
      if (new Date(formData.registrationClose) <= new Date(formData.registrationOpen)) {
        newErrors.registrationClose = "Must be after registration open date";
      }
    }
    if (formData.registrationOpen && new Date(formData.registrationOpen) < today) {
      newErrors.registrationOpen = "Registration open date cannot be in the past";
    }
    if (formData.registrationClose && new Date(formData.registrationClose) < today) {
      newErrors.registrationClose = "Registration close date cannot be in the past";
    }
    if (formData.registrationClose && formData.submissionDeadline) {
      if (new Date(formData.submissionDeadline) <= new Date(formData.registrationClose)) {
        newErrors.submissionDeadline = "Must be after registration close date";
      }
    }
    if (formData.submissionDeadline && new Date(formData.submissionDeadline) < today) {
      newErrors.submissionDeadline = "Submission deadline cannot be in the past";
    }

    if (formData.format === "quiz") {
      if (!formData.quizTimeAllowed || parseInt(formData.quizTimeAllowed) <= 0) {
        newErrors.quizTimeAllowed = "Time allowed must be greater than 0 minutes";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const canDeleteCompetitionNow = () => {
    if (!isEdit || !formData.submissionDeadline) return false;
    const submissionDeadlineAt = new Date(formData.submissionDeadline);
    if (Number.isNaN(submissionDeadlineAt.getTime())) return false;
    return new Date() >= submissionDeadlineAt;
  };

  // ------------------- SAVE DRAFT -------------------
  const handleSaveDraft = async () => {
  if (!validateForm()) {
    toast.error("Please fix the errors before saving draft");
    return;
  }

  const token = getAuthToken();
  if (!token) {
    toast.error("Please sign in again");
    navigate("/login");
    return;
  }

  try {
    setSaving(true);

    let body;
    const headers = { Authorization: `Bearer ${token}` };

    if (true) {
      // Use FormData for file upload or edit
      body = new FormData();
      const payload = buildRequestPayload();
      const jsonBlob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      body.append("data", jsonBlob);
      if (formData.materials && formData.materials.length > 0) {
        formData.materials.forEach((file) => body.append("materials", file));
      }
    } else {
      // No file → just JSON
      body = JSON.stringify(buildRequestPayload());
      headers["Content-Type"] = "application/json";
    }

    const url = isEdit
      ? `${API_BASE_URL}/api/competitions/${id}`
      : `${API_BASE_URL}/api/competitions`;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers,
      body,
    });

    if (!res.ok) {
      let msg = isEdit ? "Failed to update competition" : "Failed to save competition";
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

    toast.success(isEdit ? "Competition updated" : "Competition saved as draft");
    invalidateApiCache((key) => {
      const value = String(key);
      return value.includes("/api/competitions")
        || value.includes("competitions:")
        || value.includes("teacher:competition:")
        || value.includes("competition:");
    });
    window.dispatchEvent(new CustomEvent("competitions:updated"));
    navigate("/teacher/competitions");
  } catch (e) {
    toast.error("Unable to save competition");
  } finally {
    setSaving(false);
  }
};

  const handlePublish = async () => {
  if (!validateForm()) {
    toast.error("Please fix the errors before publishing");
    return;
  }

  const token = getAuthToken();
  if (!token) {
    toast.error("Please sign in again");
    navigate("/login");
    return;
  }

  try {
    setSaving(true);

    let body;
    const headers = { Authorization: `Bearer ${token}` };

    if (true) {
      // Use FormData for file upload or edit
      body = new FormData();
      const payload = buildRequestPayload();
      const jsonBlob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      body.append("data", jsonBlob);
      if (formData.materials && formData.materials.length > 0) {
        formData.materials.forEach((file) => body.append("materials", file));
      }
    } else {
      // No file → just JSON
      body = JSON.stringify(buildRequestPayload());
      headers["Content-Type"] = "application/json";
    }

    // Save or update the competition
    const url = isEdit
      ? `${API_BASE_URL}/api/competitions/${id}`
      : `${API_BASE_URL}/api/competitions`;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, { method, headers, body });

    if (!res.ok) {
      let msg = isEdit ? "Failed to update competition" : "Failed to create competition";
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

    const created = await res.json();
    const createdId = created?.competitionId || created?.id;
    const alreadyPublished = String(created?.status || "").toUpperCase() === "PUBLISHED";

    if (!createdId) {
      toast.error("Competition saved but ID was not returned.");
      navigate("/teacher/competitions");
      return;
    }

    // For quizzes, redirect to add questions
    if (String(created.format || "").toLowerCase() === "quiz") {
      toast.success(
        isEdit
          ? "Quiz competition saved as draft. Add questions, then publish."
          : "Quiz competition saved as draft. Add questions before publishing."
      );
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/api/competitions")
          || value.includes("competitions:")
          || value.includes("teacher:competition:")
          || value.includes("competition:");
      });
      window.dispatchEvent(new CustomEvent("competitions:updated"));
      navigate(`/teacher/competitions/${createdId}/questions`);
      return;
    }

    if (isEdit && alreadyPublished) {
      toast.success("Competition updated successfully!");
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/api/competitions")
          || value.includes("competitions:")
          || value.includes("teacher:competition:")
          || value.includes("competition:");
      });
      window.dispatchEvent(new CustomEvent("competitions:updated"));
      navigate("/teacher/competitions");
      return;
    }

    // Auto-publish non-quiz competitions
    const publishRes = await fetch(`${API_BASE_URL}/api/competitions/${createdId}/publish`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!publishRes.ok) {
      let msg = "Competition created but failed to publish";
      try {
        const ct = publishRes.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await publishRes.json();
          msg = data.message || msg;
        } else {
          msg = await publishRes.text() || msg;
        }
      } catch {}
      toast.error(msg);
      navigate("/teacher/competitions");
      return;
    }

    toast.success("Competition published successfully!");
    invalidateApiCache((key) => {
      const value = String(key);
      return value.includes("/api/competitions")
        || value.includes("competitions:")
        || value.includes("teacher:competition:")
        || value.includes("competition:");
    });
    window.dispatchEvent(new CustomEvent("competitions:updated"));
    navigate("/teacher/competitions");
  } catch (e) {
    toast.error("Unable to publish competition");
  } finally {
    setSaving(false);
  }
};

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!canDeleteCompetitionNow()) {
      toast.error("Competition can only be deleted after submission deadline.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      toast.error("Please sign in again");
      navigate("/login");
      return;
    }
    if (!confirm("Are you sure you want to delete this competition? This action cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/competitions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast.error("Failed to delete competition");
        return;
      }
      toast.success("Competition deleted");
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/api/competitions")
          || value.includes("competitions:")
          || value.includes("teacher:competition:")
          || value.includes("competition:");
      });
      window.dispatchEvent(new CustomEvent("competitions:updated"));
      navigate("/teacher/competitions");
    } catch (e) {
      toast.error("Unable to delete competition");
    }
  };

  return (
    <AppLayout role="teacher">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              {isEdit ? "Edit Competition" : "Create Competition"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isEdit
                ? "Update your competition details"
                : "Set up a new internal competition for students"}
            </p>
          </div>
        </div>

        {/* Loading state for edit */}
        {loading ? (
          <div className="card-static p-6">
            <p className="text-muted-foreground">Loading competition...</p>
          </div>
        ) : (
        /* Form */
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="card-static p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Competition Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., AI Innovation Challenge 2024"
                  className={cn(
                    "w-full h-11 px-4 rounded-lg bg-muted/50 border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    errors.title ? "border-destructive" : "border-border"
                  )}
                />
                {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Description <span className="text-destructive">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the competition objectives, requirements, and expectations..."
                  rows={4}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg bg-muted/50 border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none",
                    errors.description ? "border-destructive" : "border-border"
                  )}
                />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description}</p>}
              </div>
            </div>
          </div>

          {/* Format & Participation */}
          <div className="card-static p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Format & Participation</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Competition Format <span className="text-destructive">*</span>
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {formatOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          format: option.value,
                          participationType: option.value === "quiz" ? "individual" : prev.participationType,
                          totalMarks: option.value === "quiz" ? "" : prev.totalMarks,
                        }));
                      }}

                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center",
                        formData.format === option.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <option.icon className="w-6 h-6" />
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs opacity-80">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Participation Type <span className="text-destructive">*</span>
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {participationOptions.map((option) => {
                    // Hide "Team" for Quiz
                    if (formData.format === "quiz" && option.value === "team") return null;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, participationType: option.value }))}
                        className={cn(
                          "flex flex-col items-start gap-1 p-4 rounded-lg border transition-all",
                          formData.participationType === option.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs opacity-80">{option.description}</span>
                      </button>
                    );
                  })}
                </div>

              </div>

              {formData.participationType === "team" && (
                <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Minimum Team Size
                    </label>
                    <input
                      type="number"
                      name="minTeamSize"
                      value={formData.minTeamSize}
                      onChange={handleChange}
                      min="2"
                      className="w-full h-10 px-4 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Maximum Team Size
                    </label>
                    <input
                      type="number"
                      name="maxTeamSize"
                      value={formData.maxTeamSize}
                      onChange={handleChange}
                      min="2"
                      className="w-full h-10 px-4 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Deadlines */}
          <div className="card-static p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Deadlines</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Registration Opens <span className="text-destructive">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="registrationOpen"
                  value={formData.registrationOpen}
                  min={minDateTimeLocal}
                  onChange={handleChange}
                  className={cn(
                    "w-full h-11 px-4 rounded-lg bg-muted/50 border text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    errors.registrationOpen ? "border-destructive" : "border-border"
                  )}
                />
                {errors.registrationOpen && <p className="text-sm text-destructive mt-1">{errors.registrationOpen}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Registration Closes <span className="text-destructive">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="registrationClose"
                  value={formData.registrationClose}
                  min={minDateTimeLocal}
                  onChange={handleChange}
                  className={cn(
                    "w-full h-11 px-4 rounded-lg bg-muted/50 border text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    errors.registrationClose ? "border-destructive" : "border-border"
                  )}
                />
                {errors.registrationClose && <p className="text-sm text-destructive mt-1">{errors.registrationClose}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Submission Deadline <span className="text-destructive">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="submissionDeadline"
                  value={formData.submissionDeadline}
                  min={minDateTimeLocal}
                  onChange={handleChange}
                  className={cn(
                    "w-full h-11 px-4 rounded-lg bg-muted/50 border text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    errors.submissionDeadline ? "border-destructive" : "border-border"
                  )}
                />
                {errors.submissionDeadline && <p className="text-sm text-destructive mt-1">{errors.submissionDeadline}</p>}
              </div>

              {formData.format !== "quiz" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Total Marks <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    name="totalMarks"
                    value={formData.totalMarks}
                    onChange={handleChange}
                    placeholder="100"
                    min="1"
                    className={cn(
                      "w-full h-11 px-4 rounded-lg bg-muted/50 border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                      errors.totalMarks ? "border-destructive" : "border-border"
                    )}
                  />
                  {errors.totalMarks && <p className="text-sm text-destructive mt-1">{errors.totalMarks}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Rules & Materials */}
          <div className="card-static p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Rules & Materials</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Competition Rules
                </label>
                <textarea
                  name="rules"
                  value={formData.rules}
                  onChange={handleChange}
                  placeholder="Enter competition rules, guidelines, and important information..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Upload Materials (Optional)
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">

                  {formData.existingMaterials.length > 0 && !formData.removeMaterials && (
                    <div className="mb-3 space-y-2">
                      {formData.existingMaterials.map((material, idx) => (
                        <div key={`${material.path || material.name}-${idx}`} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2 min-w-0">
                            <a
                              href={material.path ? resolveFileUrl(material.path) : "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline truncate"
                            >
                              {material.name || `Material ${idx + 1}`}
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExistingMaterial(idx)}
                            className="text-destructive hover:text-destructive/80"
                            aria-label={`Remove ${material.name || `Material ${idx + 1}`}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={clearExistingMaterials}
                        className="text-destructive text-sm"
                      >
                        Remove all existing materials
                      </button>
                    </div>
                  )}

                  {formData.materials.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {formData.materials.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded">
                          <span className="truncate text-sm text-foreground">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeNewMaterial(idx)}
                            className="text-destructive hover:text-destructive/80"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    type="file"
                    id="materials"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.zip"
                    multiple
                    onChange={handleFileChange}
                  />
                  <label htmlFor="materials" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">
                      {formData.materials.length > 0
                        ? `${formData.materials.length} file(s) selected`
                        : (formData.existingMaterials.length === 0 || formData.removeMaterials)
                          ? "Click to upload one or more files"
                          : "Add more files (optional)"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, DOC, DOCX, or ZIP files (Max 10MB each)
                    </p>
                  </label>
                </div>
              </div>

              {formData.format !== "quiz" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Allowed Submission File Types
                  </label>
                  <input
                    type="text"
                    name="allowedFileTypes"
                    value={formData.allowedFileTypes}
                    onChange={handleChange}
                    placeholder=".pdf,.docx,.zip"
                    className="w-full h-11 px-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Comma-separated file extensions</p>
                </div>
              )}
            </div>
          </div>

          {/* Quiz Info */}
          {formData.format === "quiz" && (
            <div className="card-static p-6 border-l-4 border-l-info space-y-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground">Quiz Questions</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    After creating the competition, you can add questions via Excel upload or manual creation
                    from the competition details page. Total marks are auto-calculated from question marks.
                  </p>
                </div>
              </div>

              {/* Timer Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Time Allowed (minutes) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quizTimeAllowed}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, quizTimeAllowed: e.target.value }))
                  }
                  placeholder="Enter total time allowed for the quiz"
                  className="w-full h-11 px-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.quizTimeAllowed && <p className="text-sm text-destructive mt-1">{errors.quizTimeAllowed}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            {isEdit && canDeleteCompetitionNow() && (
              <Button variant="destructive" onClick={handleDelete} disabled={saving} className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {isEdit ? "Save Changes" : "Save as Draft"}
            </Button>
            <Button onClick={handlePublish} disabled={saving} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              {saving
                ? (isEdit ? "Saving..." : "Publishing...")
                : formData.format === "quiz"
                  ? (isEdit ? "Save Draft & Manage Questions" : "Save Draft & Add Questions")
                  : (isEdit ? "Save & Publish" : "Publish Competition")}
            </Button>
          </div>
        </div>
        )}
      </div>
    </AppLayout>
  );
}
