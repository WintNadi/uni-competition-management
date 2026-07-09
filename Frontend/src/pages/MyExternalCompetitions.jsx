import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, FileText, Calendar, MapPin, Globe, Award, 
  Clock, CheckCircle2, XCircle, AlertCircle, Eye, Edit3, 
  Upload, X, ExternalLink, Building, Users
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache, resolveFileUrl } from "@/lib/api";
import { formatReadableDate, formatReadableDateTime } from "@/lib/date";
import { toast } from "sonner";

const categoryOptions = [
  "Hackathon",
  "Design",
  "Programming Competition",
  "Workshop",
  "Seminar",
  "Webinar",
  "Bootcamp",
  "Conference",
  "Student Exchange",
  "Other"
];

const findKnownCategoryOption = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return (
    categoryOptions.find(
      (option) => option.toLowerCase() === raw.toLowerCase(),
    ) || null
  );
};

const modeOptions = ["Online", "Physical", "Hybrid"];
const scaleOptions = ["Local", "National", "International"];

// Status mappings
const statusIcons = {
  approved: CheckCircle2,
  rejected: XCircle,
  pending: Clock,
  confirmed: Clock,
};

const statusStyles = {
  approved: "border-success bg-success/10 text-success",
  rejected: "border-destructive bg-destructive/10 text-destructive",
  pending: "border-warning bg-warning/10 text-warning",
  confirmed: "border-info bg-info/10 text-info",
};

const eligibilityOptionsList = [
  "Students Only",
  "Open to All",
  "By Invitation",
  "Alumni",
];

const sourceConfirmOptions = [
  "Official Website",
  "Organizer Email",
  "Certificate / Letter",
  "Other",
];

const formatDateTimeLabel = (value) => {
  return formatReadableDateTime(value, { fallback: "-" });
};

const formatDateLabel = (value) => formatReadableDate(value, "-");

const parseDateOnly = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const datePart = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || raw.split("T")[0];
  const parsed = new Date(`${datePart}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isBeforeSubmissionStart = (competition) => {
  const endDate = parseDateOnly(competition?.endDate);
  if (!endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() < endDate.getTime();
};

const getSubmissionStartLabel = (competition) => formatDateLabel(competition?.endDate);

const extractDisplayFileName = (fileRef, fallback = "Proof File") => {
  if (!fileRef || typeof fileRef !== "string") return fallback;
  const trimmed = fileRef.trim();
  if (!trimmed) return fallback;

  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const directSegments = trimmed.split("/").filter(Boolean);
  const directTail = decode(directSegments[directSegments.length - 1] || "");
  if (directTail && !/^[a-f0-9]{24}$/i.test(directTail)) {
    return directTail;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const queryName =
      parsed.searchParams.get("filename") || parsed.searchParams.get("name");
    if (queryName) return decode(queryName);
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    if (
      pathSegments.length >= 4 &&
      pathSegments[0] === "api" &&
      pathSegments[1] === "files"
    ) {
      const withName = decode(pathSegments.slice(3).join("/"));
      if (withName) return withName;
    }
  } catch {
    // fall through
  }

  return fallback;
};

export default function MyExternalCompetitions() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [matchedAdminCompetition, setMatchedAdminCompetition] = useState(null);
  const formTitleRef = useRef(null);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const loadCompetitions = useCallback(async ({ force = false } = {}) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;
    try {
      const data = await fetchJsonCached(`${API_BASE_URL}/api/external/participations`, {
        token,
        ttlMs: 120000,
        force,
        cacheKey: "external:participations:me",
      });
      const toTimestamp = (value) => {
        if (!value) return 0;
        const parsed = new Date(value).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
      };
      const raw = Array.isArray(data) ? data : [];
      const studentCreated = raw.filter((item) => item.source === "student_created" || !item.competitionId);
      const sorted = studentCreated.sort((a, b) => {
        const first = b.updatedAt || b.submittedAt || b.createdAt;
        const second = a.updatedAt || a.submittedAt || a.createdAt;
        return toTimestamp(first) - toTimestamp(second);
      });
      const normalized = sorted.map((item) => ({
        ...item,
        status: (() => {
          const rawStatus = String(item.status || "").toLowerCase();
          if (!rawStatus) return "pending";
          return rawStatus;
        })(),
        submittedAtLabel: formatDateTimeLabel(item.submittedAt || item.updatedAt || item.createdAt),
        proofDeadlineDate: item.proofDeadline ? new Date(item.proofDeadline) : null,
        isDeadlinePassed: item.proofDeadline ? new Date(item.proofDeadline) <= new Date() : false,
      }));
      setCompetitions(normalized);
    } catch {
      setCompetitions([]);
    }
  }, []);

  useEffect(() => {
    loadCompetitions({ force: false });
  }, [loadCompetitions]);

  useEffect(() => {
    const handleNotificationsUpdate = () => {
      loadCompetitions({ force: false });
    };
    const handleSubmissionUpdate = () => loadCompetitions({ force: false });
    const handleCompetitionUpdate = () => loadCompetitions({ force: false });
    const handleSessionChange = () => loadCompetitions({ force: false });
    window.addEventListener("notifications:updated", handleNotificationsUpdate);
    window.addEventListener("submissions:updated", handleSubmissionUpdate);
    window.addEventListener("competitions:updated", handleCompetitionUpdate);
    window.addEventListener("session:changed", handleSessionChange);
    return () => {
      window.removeEventListener("notifications:updated", handleNotificationsUpdate);
      window.removeEventListener("submissions:updated", handleSubmissionUpdate);
      window.removeEventListener("competitions:updated", handleCompetitionUpdate);
      window.removeEventListener("session:changed", handleSessionChange);
    };
  }, [loadCompetitions]);

  useEffect(() => {
    if (
      (showCreateForm || showEditForm) &&
      matchedAdminCompetition?.competitionId &&
      formTitleRef.current
    ) {
      formTitleRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [matchedAdminCompetition?.competitionId, showCreateForm, showEditForm]);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    customCategory: "",
    organizer: "",
    mode: "",
    location: "",
    scale: "",
    description: "",
    eligibility: "",
    participationType: "",
    teamSizeMin: "",
    teamSizeMax: "",
    startDate: "",
    endDate: "",
    websiteLink: "",
    submissionNotes: "",
    sourceConfirmation: "",
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      if (field === "category") {
        return {
          ...prev,
          category: value,
          customCategory: value === "Other" ? prev.customCategory : "",
        };
      }
      return { ...prev, [field]: value };
    });
    if (["title", "location", "category", "customCategory", "organizer"].includes(field)) {
      setMatchedAdminCompetition(null);
    }
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const v = {};
    if (!formData.title) v.title = "Required";
    if (!formData.category) v.category = "Required";
    if (formData.category === "Other" && !String(formData.customCategory || "").trim()) v.customCategory = "Required";
    if (!formData.organizer) v.organizer = "Required";
    if (!formData.mode) v.mode = "Required";
    if (!formData.location) v.location = "Required";
    if (!formData.scale) v.scale = "Required";
    if (!formData.description) v.description = "Required";
    if (!formData.startDate) v.startDate = "Required";
    if (!formData.endDate) v.endDate = "Required";
    if (formData.startDate && formData.startDate < todayStr) v.startDate = "Start date cannot be in the past";
    if (formData.endDate && formData.endDate < todayStr) v.endDate = "End date cannot be in the past";
    if (!formData.eligibility) v.eligibility = "Required";
    if (!formData.websiteLink) v.websiteLink = "Required";
    if (!formData.participationType) v.participationType = "Required";
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) v.endDate = "End date must be on or after start date";
    
    if (formData.participationType === "Team") {
      const min = formData.teamSizeMin !== "" ? Number(formData.teamSizeMin) : null;
      const max = formData.teamSizeMax !== "" ? Number(formData.teamSizeMax) : null;
      
      if (min === null) {
        v.teamSizeMin = "Required";
      } else if (!Number.isInteger(min) || min < 1) {
        v.teamSizeMin = "Must be at least 1";
      }
      
      if (max === null) {
        v.teamSizeMax = "Required";
      } else if (!Number.isInteger(max) || max < 1) {
        v.teamSizeMax = "Must be at least 1";
      } else if (min !== null && max !== null && min > max) {
        v.teamSizeMax = "Max must be >= Min";
      }
    }
    
    if (!formData.submissionNotes) v.submissionNotes = "Required";
    if (!formData.sourceConfirmation) v.sourceConfirmation = "Required";
    if (!declarationChecked) v.declaration = "Please confirm declaration";
    
    return v;
  };

  const uploadProofFiles = async (competitionId, files) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      return false;
    }

    const competition = competitions.find(c => c.id === competitionId);
    if (competition?.status !== "confirmed") {
      toast.error("You can upload proof only after admin confirmation");
      return false;
    }
    if (isBeforeSubmissionStart(competition)) {
      toast.error(`Cannot upload before competition end date (${getSubmissionStartLabel(competition)}).`);
      return false;
    }
    if (competition?.proofDeadline && new Date(competition.proofDeadline) <= new Date()) {
      toast.error("Cannot upload: Proof deadline has passed");
      return false;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("file", file);
      });

      const res = await fetch(`${API_BASE_URL}/api/external/participations/${competitionId}/proof`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const error = await res.text().catch(() => "Upload failed");
        throw new Error(error);
      }

      await res.json();
      
      invalidateApiCache((key) => String(key).includes("/api/external/participations"));
      window.dispatchEvent(new CustomEvent("submissions:updated"));
      await loadCompetitions({ force: true });
      toast.success("Proof uploaded successfully");
      return true;
    } catch (err) {
      toast.error(err?.message || "Upload failed");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeProofFile = async (competitionId, fileUrl) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      return false;
    }

    const competition = competitions.find(c => c.id === competitionId);
    if (competition?.status !== "confirmed") {
      toast.error("You can edit proof only before submitting for admin review");
      return false;
    }
    if (competition?.proofDeadline && new Date(competition.proofDeadline) <= new Date()) {
      toast.error("Cannot remove: Proof deadline has passed");
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/external/participations/${competitionId}/proof?file=${encodeURIComponent(fileUrl)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const error = await res.text().catch(() => "Remove failed");
        throw new Error(error);
      }

      invalidateApiCache((key) => String(key).includes("/api/external/participations"));
      window.dispatchEvent(new CustomEvent("submissions:updated"));
      await loadCompetitions({ force: true });
      toast.success("File removed");
      return true;
    } catch (err) {
      toast.error(err?.message || "Remove failed");
      return false;
    }
  };

  const updateParticipationResult = async (competitionId, result) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      return;
    }
    const competition = competitions.find(c => c.id === competitionId);
    if (competition?.status !== "confirmed") {
      toast.error("You can edit result only after admin confirmation");
      return;
    }
    if (isBeforeSubmissionStart(competition)) {
      toast.error(`Cannot update result before competition end date (${getSubmissionStartLabel(competition)}).`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/external/participations/${competitionId}/result`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ participationResult: result }),
      });

      if (!res.ok) {
        const error = await res.text().catch(() => "Update failed");
        throw new Error(error);
      }

      invalidateApiCache((key) => String(key).includes("/api/external/participations"));
      await loadCompetitions({ force: true });
      toast.success("Level of achievement saved");
    } catch (err) {
      toast.error(err?.message || "Failed to save result");
    }
  };

  const submitForAdminReview = async (competitionId) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      return false;
    }

    const competition = competitions.find(c => c.id === competitionId);
    if (!competition) {
      toast.error("Competition not found");
      return false;
    }
    if (competition.status !== "confirmed") {
      toast.error("This competition is not ready for submission");
      return false;
    }
    if (!competition.proofDeadline) {
      toast.error("Admin has not set proof deadline yet");
      return false;
    }
    if (isBeforeSubmissionStart(competition)) {
      toast.error(`Cannot submit before competition end date (${getSubmissionStartLabel(competition)}).`);
      return false;
    }
    if (new Date(competition.proofDeadline) <= new Date()) {
      toast.error("Cannot submit: Proof deadline has passed");
      return false;
    }
    if (!competition.proofFiles || competition.proofFiles.length === 0) {
      toast.error("Please upload at least one proof file");
      return false;
    }
    if (!competition.participationResult) {
      toast.error("Please select your achievement before submitting");
      return false;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/external/participations/${competitionId}/submit-review`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        let message = "Failed to submit for admin review";
        try {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            message = data?.message || message;
          } else {
            message = await res.text() || message;
          }
        } catch {
          // no-op
        }
        throw new Error(message);
      }

      invalidateApiCache((key) => String(key).includes("/api/external/participations"));
      window.dispatchEvent(new CustomEvent("submissions:updated"));
      window.dispatchEvent(new CustomEvent("notifications:updated"));
      await loadCompetitions({ force: true });
      toast.success("Submitted for admin review");
      return true;
    } catch (err) {
      toast.error(err?.message || "Failed to submit for admin review");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setActionError("Please sign in again");
      return;
    }
    const v = validateForm();
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    const payload = {
      title: formData.title,
      category: formData.category === "Other" ? formData.customCategory : formData.category,
      organizer: formData.organizer,
      mode: formData.mode,
      location: formData.location,
      scale: formData.scale,
      description: formData.description,
      eligibility: formData.eligibility,
      participationType: formData.participationType,
      teamSizeMin: formData.participationType === "Team" ? Number(formData.teamSizeMin || 0) : null,
      teamSizeMax: formData.participationType === "Team" ? Number(formData.teamSizeMax || 0) : null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      websiteLink: formData.websiteLink || "",
      submissionNotes: formData.submissionNotes || "",
      sourceConfirmation: formData.sourceConfirmation || "",
      declarationConfirmed: true
    };
    try {
      setIsSubmitting(true);
      setActionError("");
      setMatchedAdminCompetition(null);
      const res = await fetch(`${API_BASE_URL}/api/external/participations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = "Submit failed";
        let matched = null;
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            msg = data.message || msg;
            if (res.status === 409 && data?.competitionId) {
              matched = {
                competitionId: data.competitionId,
                title: data.title || "",
              };
            }
          } else {
            msg = await res.text() || msg;
          }
        } catch {}
        if (matched) {
          setMatchedAdminCompetition(matched);
          setActionError("");
          return;
        }
        setActionError(msg);
        return;
      }

      await res.json();
      
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/api/external/participations")
          || value.includes("external:participations:");
      });
      window.dispatchEvent(new CustomEvent("submissions:updated"));
      window.dispatchEvent(new CustomEvent("notifications:updated"));
      await loadCompetitions({ force: false });
      toast.success("External competition submitted successfully");
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      setActionError(err?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    const token = localStorage.getItem("userToken");
    if (!token || !selectedCompetition) {
      setActionError("Please sign in again");
      return;
    }
    const v = {};
    if (!formData.title) v.title = "Required";
    if (!formData.category) v.category = "Required";
    if (formData.category === "Other" && !String(formData.customCategory || "").trim()) {
      v.customCategory = "Required";
    }
    if (!formData.organizer) v.organizer = "Required";
    if (!formData.mode) v.mode = "Required";
    if (!formData.location) v.location = "Required";
    if (!formData.scale) v.scale = "Required";
    if (!formData.description) v.description = "Required";
    if (!formData.startDate) v.startDate = "Required";
    if (!formData.endDate) v.endDate = "Required";
    if (!formData.eligibility) v.eligibility = "Required";
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) v.endDate = "End date must be on or after start date";
    if (formData.participationType === "Team") {
      const min = Number(formData.teamSizeMin || 0);
      const max = Number(formData.teamSizeMax || 0);
      if (!min) v.teamSizeMin = "Required";
      if (!max) v.teamSizeMax = "Required";
      if (min && max && min > max) v.teamSizeMax = "Max must be >= Min";
    }
    if (!formData.websiteLink) v.websiteLink = "Required";
    if (!formData.participationType) v.participationType = "Required";
    if (!formData.submissionNotes) v.submissionNotes = "Required";
    if (!formData.sourceConfirmation) v.sourceConfirmation = "Required";
    
    if (!declarationChecked) v.declaration = "Please confirm declaration";
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    const payload = {
      title: formData.title,
      category: formData.category === "Other" ? formData.customCategory : formData.category,
      organizer: formData.organizer,
      mode: formData.mode,
      location: formData.location,
      scale: formData.scale,
      description: formData.description,
      eligibility: formData.eligibility,
      participationType: formData.participationType,
      teamSizeMin: formData.participationType === "Team" ? Number(formData.teamSizeMin || 0) : null,
      teamSizeMax: formData.participationType === "Team" ? Number(formData.teamSizeMax || 0) : null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      websiteLink: formData.websiteLink || "",
      submissionNotes: formData.submissionNotes || "",
      sourceConfirmation: formData.sourceConfirmation || "",
      declarationConfirmed: true
    };
    try {
      setIsSubmitting(true);
      setActionError("");
      setMatchedAdminCompetition(null);
      const res = await fetch(`${API_BASE_URL}/api/external/participations/${selectedCompetition.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = "Resubmit failed";
        let matched = null;
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            msg = data.message || msg;
            if (res.status === 409 && data?.competitionId) {
              matched = {
                competitionId: data.competitionId,
                title: data.title || "",
              };
            }
          } else {
            msg = await res.text() || msg;
          }
        } catch {}
        if (matched) {
          setMatchedAdminCompetition(matched);
          setActionError("");
          return;
        }
        setActionError(msg);
        return;
      }
      invalidateApiCache((key) => {
        const value = String(key);
        return value.includes("/api/external/participations")
          || value.includes("external:participations:");
      });
      window.dispatchEvent(new CustomEvent("submissions:updated"));
      window.dispatchEvent(new CustomEvent("notifications:updated"));
      await loadCompetitions({ force: false });
      toast.success(
        selectedCompetition.status === "confirmed"
          ? "Competition details updated."
          : "Competition resubmitted successfully",
      );
      setShowEditForm(false);
      setSelectedCompetition(null);
      resetForm();
    } catch {
      toast.error("Resubmit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      category: "",
      customCategory: "",
      organizer: "",
      mode: "",
      location: "",
      scale: "",
      description: "",
      eligibility: "",
      participationType: "",
      teamSizeMin: "",
      teamSizeMax: "",
      startDate: "",
      endDate: "",
      websiteLink: "",
      submissionNotes: "",
      sourceConfirmation: "",
    });
    setDeclarationChecked(false);
    setErrors({});
    setActionError("");
    setMatchedAdminCompetition(null);
  };

  const openEditForm = (competition) => {
    const rawCategory = String(competition.category || "").trim();
    const matchedCategoryOption = findKnownCategoryOption(rawCategory);
    const useCustomCategory = Boolean(rawCategory) && !matchedCategoryOption;
    setSelectedCompetition(competition);
    setFormData({
      title: competition.title,
      category: rawCategory ? (matchedCategoryOption || "Other") : "",
      customCategory: useCustomCategory ? rawCategory : "",
      organizer: competition.organizer,
      mode: competition.mode,
      location: competition.location,
      scale: competition.scale,
      description: competition.description,
      eligibility: competition.eligibility,
      participationType: competition.participationType || "",
      teamSizeMin: competition.teamSizeMin || "",
      teamSizeMax: competition.teamSizeMax || "",
      startDate: competition.startDate,
      endDate: competition.endDate,
      websiteLink: competition.websiteLink || "",
      submissionNotes: competition.submissionNotes || "",
      sourceConfirmation: competition.sourceConfirmation || "",
    });
    setDeclarationChecked(competition.declarationConfirmed !== false);
    setMatchedAdminCompetition(null);
    setShowEditForm(true);
  };

  const handleDelete = async (competitionId) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please sign in again");
      return;
    }

    if (!confirm("Are you sure you want to delete this competition? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/external/participations/${competitionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const error = await res.text().catch(() => "Delete failed");
        throw new Error(error);
      }

      invalidateApiCache((key) => String(key).includes("/api/external/participations"));
      await loadCompetitions({ force: true });
      setSelectedCompetition(null);
      toast.success("Competition deleted");
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const legacyHintsEnabled = false;

  return (
    <AppLayout role="student">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              My External Competitions
            </h1>
            <p className="text-muted-foreground mt-1">
              Submit your own external competition participations for verification
            </p>
          </div>
          <Button className="gap-2" onClick={() => { resetForm(); setShowCreateForm(true); }}>
            <Plus className="w-4 h-4" />
            Add External Competition
          </Button>
        </div>

        {/* Info Banner */}
        <div className="bg-info/10 border border-info/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">How it works</p>
            <p className="text-sm text-muted-foreground">
              First submit your announcement. After admin confirms and sets a proof deadline,
              upload your files and achievement, then submit for admin review.
            </p>
          </div>
        </div>

        {/* Competition List */}
        <div className="grid gap-4">
          {competitions.map((competition) => {
            const StatusIcon = statusIcons[competition.status] || Clock;
            const canEdit = competition.status === "rejected";
            const needsResubmission =
              competition.status === "confirmed" && Boolean(competition.adminNote);
            const deadlinePassed = competition.proofDeadline && new Date(competition.proofDeadline) <= new Date();
            const beforeSubmissionStart = isBeforeSubmissionStart(competition);
            const submissionStartLabel = getSubmissionStartLabel(competition);
            
            return (
              <div key={competition.id} className="card-elevated p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={cn("badge-status border flex items-center gap-1", statusStyles[competition.status])}>
                        <StatusIcon className="w-3 h-3" />
                        {competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
                      </span>
                      <span className="badge-status bg-muted text-muted-foreground">
                        {competition.category}
                      </span>
                      <span className="badge-status bg-secondary/10 text-secondary flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {competition.scale}
                      </span>
                    </div>
                    
                    {competition.duplicateWithAdmin || competition.matchedAdminCompetitionId ? (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="p-2 rounded-md bg-info/10 text-info text-sm">
                          Your created external competition is the same as Admin's.
                        </div>
                        {competition.matchedAdminCompetitionId ? (
                          <Link to={`/competitions/${competition.matchedAdminCompetitionId}`} className="text-secondary hover:underline text-sm flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            View Admin Competition
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                    
                    <h3 className="font-display font-semibold text-lg text-foreground mb-1">
                      {competition.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {competition.description}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-4 h-4" />
                        {competition.organizer}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDateLabel(competition.startDate)} - {formatDateLabel(competition.endDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {competition.location}
                      </span>
                    </div>

                    {competition.adminNote &&
                      (competition.status === "rejected" ||
                        competition.status === "approved" ||
                        competition.status === "confirmed") && (
                      <div className={cn(
                        "mt-3 p-3 rounded-lg text-sm",
                        competition.status === "approved"
                          ? "bg-success/10 text-success"
                          : needsResubmission || competition.status === "rejected"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-destructive/10 text-destructive"
                      )}>
                        <strong>{needsResubmission ? "Submission Rejected:" : "Admin Note:"}</strong> {competition.adminNote}
                        {needsResubmission && (
                          <span> Please update your proof and submit again before the deadline.</span>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Submitted: {competition.submittedAtLabel || "-"}</span>
                    </div>

                    {competition.status === "pending" && !competition.proofDeadline && (
                      <div className="mt-3 p-2 bg-warning/5 border border-warning/20 rounded text-xs text-warning">
                        Waiting for admin confirmation.
                      </div>
                    )}

                    {competition.status === "pending" && competition.proofDeadline && (
                      <div className="mt-3 p-2 bg-info/5 border border-info/20 rounded text-xs text-info">
                        Your proof submission is pending admin review.
                      </div>
                    )}
                    
                    {/* Proof Submission Section */}
                    {competition.status === "confirmed" && competition.proofDeadline && (
                      <div className="mt-3 p-4 rounded-lg bg-info/10 border border-info/20 space-y-3">
                        {needsResubmission && (
                          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                            Admin rejected your previous submission. Please resubmit your achievement and proof files.
                          </div>
                        )}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-info" />
                            <span className="text-sm font-medium">
                              Proof Deadline: {formatDateTimeLabel(competition.proofDeadline)}
                            </span>
                          </div>
                          {deadlinePassed ? (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                              Deadline Passed
                            </Badge>
                          ) : beforeSubmissionStart ? (
                            <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                              Opens on {submissionStartLabel}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              Submission Open
                            </Badge>
                          )}
                        </div>

                        {/* Achievement Level Selection */}
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-muted-foreground">Your Achievement:</label>
                          <select
                            value={competition.participationResult || ""}
                            onChange={(e) => updateParticipationResult(competition.id, e.target.value)}
                            disabled={deadlinePassed || beforeSubmissionStart}
                            className="h-8 px-2 rounded border border-border bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Select level</option>
                            {[
                              "Winner",
                              "1st Runner Up",
                              "2nd Runner Up",
                              "3rd Place",
                              "Top 5",
                              "Top 10",
                              "Finalist",
                              "Participant"
                            ].map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {beforeSubmissionStart ? (
                            <span className="text-xs text-info">Available on {submissionStartLabel}</span>
                          ) : deadlinePassed && (
                            <span className="text-xs text-warning">Cannot change after deadline</span>
                          )}
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              id={`proof-upload-${competition.id}`}
                              multiple
                              accept=".png,.jpg,.jpeg,.pdf"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                  await uploadProofFiles(competition.id, files);
                                }
                                e.target.value = "";
                              }}
                              className="hidden"
                              disabled={deadlinePassed || beforeSubmissionStart}
                            />
                            <Button 
                              size="sm"
                              variant={deadlinePassed || beforeSubmissionStart ? "outline" : "default"}
                              onClick={() => {
                                if (!deadlinePassed && !beforeSubmissionStart) {
                                  document.getElementById(`proof-upload-${competition.id}`)?.click();
                                } else if (beforeSubmissionStart) {
                                  toast.error(`Submission opens on ${submissionStartLabel}`);
                                } else {
                                  toast.error("Cannot upload: Proof deadline has passed");
                                }
                              }}
                              className="gap-2"
                              disabled={deadlinePassed || beforeSubmissionStart || isSubmitting}
                            >
                              <Upload className="w-4 h-4" />
                              {beforeSubmissionStart
                                ? `Opens on ${submissionStartLabel}`
                                : deadlinePassed
                                  ? "Deadline Passed"
                                  : "Upload Proof Files"}
                            </Button>
                            {isSubmitting && <span className="text-sm text-muted-foreground">Uploading...</span>}
                          </div>

                          {/* Display uploaded files */}
                          {(competition.proofFiles || []).length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground mb-2">
                                Uploaded Files ({competition.proofFiles.length}):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {competition.proofFiles.map((file, idx) => {
                                  const fullUrl = resolveFileUrl(file || "");
                                  const fileName = extractDisplayFileName(file, `File ${idx + 1}`);
                                  return (
                                    <div key={idx} className="flex items-center gap-1 bg-background rounded border p-1 pr-2">
                                      <a 
                                        href={fullUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs hover:text-secondary"
                                      >
                                        <FileText className="w-3 h-3" />
                                        <span className="max-w-[150px] truncate">{fileName}</span>
                                      </a>
                                      {!deadlinePassed && !beforeSubmissionStart && (
                                        <button
                                          onClick={() => removeProofFile(competition.id, file)}
                                          className="text-muted-foreground hover:text-destructive ml-1"
                                          title="Remove file"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-info/20">
                          <span className="text-xs text-muted-foreground">
                            Submit once all proof files and achievement are complete.
                          </span>
                          <Button
                            size="sm"
                            onClick={() => submitForAdminReview(competition.id)}
                            disabled={
                              isSubmitting ||
                              deadlinePassed ||
                              beforeSubmissionStart ||
                              !competition.participationResult ||
                              !competition.proofFiles?.length
                            }
                          >
                            Submit for Admin Review
                          </Button>
                        </div>

                        {/* Status Message */}
                        {beforeSubmissionStart && (
                          <div className="p-2 bg-info/5 border border-info/20 rounded text-xs text-info">
                            Proof submission opens on the competition end date: {submissionStartLabel}.
                          </div>
                        )}
                        {!beforeSubmissionStart && !deadlinePassed && competition.proofFiles?.length === 0 && (
                          <div className="p-2 bg-info/5 border border-info/20 rounded text-xs text-info">
                            Upload your proof files before the deadline. You can upload multiple files.
                          </div>
                        )}
                        {!beforeSubmissionStart && !deadlinePassed && competition.proofFiles?.length > 0 && !competition.participationResult && (
                          <div className="p-2 bg-warning/5 border border-warning/20 rounded text-xs text-warning">
                            Select your achievement before submitting for review.
                          </div>
                        )}
                        {deadlinePassed && (
                          <div className="p-2 bg-warning/5 border border-warning/20 rounded text-xs text-warning">
                            Deadline passed. Editing is closed.
                          </div>
                        )}
                        {legacyHintsEnabled && deadlinePassed && competition.proofFiles?.length > 0 && (
                          <div className="p-2 bg-warning/5 border border-warning/20 rounded text-xs text-warning">
                            ⏳ Deadline passed. Your proof is now with admin for review.
                          </div>
                        )}
                        {legacyHintsEnabled && !deadlinePassed && competition.proofFiles?.length === 0 && (
                          <div className="p-2 bg-info/5 border border-info/20 rounded text-xs text-info">
                            ℹ️ Upload your proof files before the deadline. You can upload multiple files.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1"
                      onClick={() => setSelectedCompetition(competition)}
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </Button>
                    {canEdit && (
                      <>
                        <Button 
                          size="sm" 
                          className="gap-1"
                          onClick={() => openEditForm(competition)}
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit & Resubmit
                        </Button>
                        {competition.status === "rejected" && (
                          <Button 
                            variant="destructive"
                            size="sm" 
                            className="gap-1"
                            onClick={() => handleDelete(competition.id)}
                          >
                            <X className="w-4 h-4" />
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {competitions.length === 0 && (
            <div className="card-static p-12 text-center">
              <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No external competitions submitted yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click "Add External Competition" to submit your first participation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {(showCreateForm || showEditForm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm overflow-y-auto py-8">
          <div className="card-static w-full max-w-2xl p-6 m-4 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 ref={formTitleRef} className="font-display font-semibold text-xl">
                {showEditForm
                  ? selectedCompetition?.status === "confirmed"
                    ? "Edit Competition Details"
                    : "Edit & Resubmit Competition"
                  : "Add External Competition"}
              </h2>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                onClick={() => {
                  setShowCreateForm(false);
                  setShowEditForm(false);
                  setSelectedCompetition(null);
                  resetForm();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid gap-4">
              {actionError && (
                <div className="p-3 rounded-lg text-sm bg-destructive/10 text-destructive">
                  {actionError}
                </div>
              )}
              {matchedAdminCompetition?.competitionId && (
                <div className="p-3 rounded-lg text-sm bg-info/10 border border-info/20 text-info space-y-2">
                  <p>
                    This competition already exists in Admin competitions. You do not need to create it here, and no admin confirmation is required.
                  </p>
                  <Link
                    to={`/competitions/${matchedAdminCompetition.competitionId}`}
                    className="inline-flex items-center gap-1 text-secondary hover:underline font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Admin Competition
                  </Link>
                </div>
              )}
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Competition Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g., Google Developer Student Clubs Hackathon"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.title && <div className="mt-1 text-xs text-destructive">{errors.title}</div>}
              </div>

              {/* Category & Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {errors.category && <div className="mt-1 text-xs text-destructive">{errors.category}</div>}
                  {formData.category === "Other" && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={formData.customCategory}
                        onChange={(e) => handleInputChange("customCategory", e.target.value)}
                        placeholder="Type your category"
                        className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {errors.customCategory && (
                        <div className="mt-1 text-xs text-destructive">{errors.customCategory}</div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Mode *
                  </label>
                  <select
                    value={formData.mode}
                    onChange={(e) => handleInputChange("mode", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select mode</option>
                    {modeOptions.map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                  {errors.mode && <div className="mt-1 text-xs text-destructive">{errors.mode}</div>}
                </div>
              </div>

              {/* Organizer & Scale */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Organizer *
                  </label>
                  <input
                    type="text"
                    value={formData.organizer}
                    onChange={(e) => handleInputChange("organizer", e.target.value)}
                    placeholder="e.g., Google, AWS, IEEE"
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                {errors.organizer && <div className="mt-1 text-xs text-destructive">{errors.organizer}</div>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Scale *
                  </label>
                  <select
                    value={formData.scale}
                    onChange={(e) => handleInputChange("scale", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select scale</option>
                    {scaleOptions.map(scale => (
                      <option key={scale} value={scale}>{scale}</option>
                    ))}
                  </select>
                  {errors.scale && <div className="mt-1 text-xs text-destructive">{errors.scale}</div>}
                </div>
              </div>
              
              {/* Location */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                  placeholder="e.g., City Convention Center, Virtual"
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.location && <div className="mt-1 text-xs text-destructive">{errors.location}</div>}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange("startDate", e.target.value)}
                    min={showEditForm ? undefined : todayStr}
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors.startDate && <div className="mt-1 text-xs text-destructive">{errors.startDate}</div>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange("endDate", e.target.value)}
                    min={
                      showEditForm
                        ? (formData.startDate || undefined)
                        : (formData.startDate || todayStr)
                    }
                    className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors.endDate && <div className="mt-1 text-xs text-destructive">{errors.endDate}</div>}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Describe your participation and what you achieved..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                {errors.description && <div className="mt-1 text-xs text-destructive">{errors.description}</div>}
              </div>

              {/* Eligibility */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Eligibility Criteria *
                </label>
                <select
                  value={formData.eligibility}
                  onChange={(e) => handleInputChange("eligibility", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select</option>
                  {eligibilityOptionsList.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.eligibility && <div className="mt-1 text-xs text-destructive">{errors.eligibility}</div>}
              </div>

              {/* Website Link */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Website Link *
                </label>
                <input
                  type="url"
                  value={formData.websiteLink}
                  onChange={(e) => handleInputChange("websiteLink", e.target.value)}
                  placeholder="https://..."
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors.websiteLink && <div className="mt-1 text-xs text-destructive">{errors.websiteLink}</div>}
              </div>
              
              {/* Individual or Team */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Individual or Team-based? *
                </label>
                <select
                  value={formData.participationType}
                  onChange={(e) => handleInputChange("participationType", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select</option>
                  <option value="Individual">Individual</option>
                  <option value="Team">Team</option>
                </select>
                {errors.participationType && <div className="mt-1 text-xs text-destructive">{errors.participationType}</div>}
              </div>
              {formData.participationType === "Team" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      Team Size (Min) *
                    </label>
                    <input
                      type="number"
                      value={formData.teamSizeMin}
                      onChange={(e) => handleInputChange("teamSizeMin", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {errors.teamSizeMin && <div className="mt-1 text-xs text-destructive">{errors.teamSizeMin}</div>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">
                      Team Size (Max) *
                    </label>
                    <input
                      type="number"
                      value={formData.teamSizeMax}
                      onChange={(e) => handleInputChange("teamSizeMax", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {errors.teamSizeMax && <div className="mt-1 text-xs text-destructive">{errors.teamSizeMax}</div>}
                  </div>
                </div>
              )}
              
              {/* Submission Notes */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Submission Notes *
                </label>
                <textarea
                  value={formData.submissionNotes}
                  onChange={(e) => handleInputChange("submissionNotes", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                {errors.submissionNotes && <div className="mt-1 text-xs text-destructive">{errors.submissionNotes}</div>}
              </div>
              
              {/* Source Confirmation */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Source Confirmation *
                </label>
                <select
                  value={formData.sourceConfirmation}
                  onChange={(e) => handleInputChange("sourceConfirmation", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select</option>
                  {sourceConfirmOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.sourceConfirmation && <div className="mt-1 text-xs text-destructive">{errors.sourceConfirmation}</div>}
              </div>
              
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              {/* Declaration */}
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={declarationChecked}
                  onChange={(e) => { setDeclarationChecked(e.target.checked); setErrors(prev => ({ ...prev, declaration: undefined })); }}
                />
                <span>I confirm that the information provided is accurate and sourced from an official competition. *</span>
              </label>
              {errors.declaration && <div className="mt-1 text-xs text-destructive">{errors.declaration}</div>}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateForm(false);
                  setShowEditForm(false);
                  setSelectedCompetition(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={showEditForm ? handleResubmit : handleSubmit}
                disabled={isSubmitting}
              >
                {showEditForm
                  ? selectedCompetition?.status === "confirmed"
                    ? "Save Details"
                    : "Resubmit for Approval"
                  : "Submit for Approval"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedCompetition && !showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="card-static w-full max-w-lg p-6 m-4 animate-fade-in max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-xl">Competition Details</h2>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                onClick={() => setSelectedCompetition(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedCompetition.title}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={cn("badge-status border", statusStyles[selectedCompetition.status])}>
                    {selectedCompetition.status}
                  </span>
                  <span className="badge-status bg-muted text-muted-foreground">
                    {selectedCompetition.category}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organizer</span>
                  <span className="font-medium">{selectedCompetition.organizer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="font-medium">{selectedCompetition.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{selectedCompetition.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scale</span>
                  <span className="font-medium">{selectedCompetition.scale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dates</span>
                  <span className="font-medium">
                    {formatDateLabel(selectedCompetition.startDate)} - {formatDateLabel(selectedCompetition.endDate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Eligibility</span>
                  <span className="font-medium">{selectedCompetition.eligibility || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Participation Type</span>
                  <span className="font-medium">{selectedCompetition.participationType || "-"}</span>
                </div>
                {selectedCompetition.participationType === "Team" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Team Size Min</span>
                      <span className="font-medium">{selectedCompetition.teamSizeMin ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Team Size Max</span>
                      <span className="font-medium">{selectedCompetition.teamSizeMax ?? "-"}</span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source Confirmation</span>
                  <span className="font-medium">{selectedCompetition.sourceConfirmation || "-"}</span>
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="mt-1 text-sm">{selectedCompetition.description}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Submission Notes</span>
                <p className="mt-1 text-sm">{selectedCompetition.submissionNotes || "-"}</p>
              </div>

              {selectedCompetition.websiteLink && (
                <a 
                  href={selectedCompetition.websiteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-secondary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Website
                </a>
              )}

              {/* Proof Deadline Display */}
              {selectedCompetition.proofDeadline && (
                <div className="p-3 rounded-lg bg-info/10 border border-info/20">
                  <p className="text-sm font-medium">Proof Deadline</p>
                  <p className="text-sm">{formatDateTimeLabel(selectedCompetition.proofDeadline)}</p>
                  {selectedCompetition.isDeadlinePassed ? (
                    <Badge variant="outline" className="mt-2 bg-warning/10 text-warning border-warning/20">
                      Deadline Passed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-2 bg-success/10 text-success border-success/20">
                      Submission Open
                    </Badge>
                  )}
                </div>
              )}

              {/* Proof Files Display */}
              {selectedCompetition.proofFiles?.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Proof Files</span>
                  <div className="mt-2 space-y-2">
                    {selectedCompetition.proofFiles.map((file, idx) => {
                      const fullUrl = resolveFileUrl(file || "");
                      const fileName = extractDisplayFileName(file, `File ${idx + 1}`);
                      return (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                          <FileText className="w-4 h-4 text-secondary" />
                          <a 
                            href={fullUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm hover:text-secondary truncate flex-1"
                          >
                            {fileName}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedCompetition.adminNote &&
                (selectedCompetition.status === "rejected" ||
                  selectedCompetition.status === "approved" ||
                  selectedCompetition.status === "confirmed") && (
                (() => {
                  const needsResubmission =
                    selectedCompetition.status === "confirmed" &&
                    Boolean(selectedCompetition.adminNote);
                  return (
                <div className={cn(
                  "p-3 rounded-lg text-sm",
                  selectedCompetition.status === "approved"
                    ? "bg-success/10 text-success"
                    : needsResubmission || selectedCompetition.status === "rejected"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-info/10 text-info"
                )}>
                  <strong>{needsResubmission ? "Submission Rejected:" : "Admin Note:"}</strong> {selectedCompetition.adminNote}
                  {needsResubmission && (
                    <span> Please update your proof and submit again before the deadline.</span>
                  )}
                </div>
                  );
                })()
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setSelectedCompetition(null)}>
                Close
              </Button>
              {selectedCompetition.status === "rejected" && (
                <div className="flex gap-2">
                  <Button onClick={() => openEditForm(selectedCompetition)}>
                    Edit & Resubmit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selectedCompetition.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
