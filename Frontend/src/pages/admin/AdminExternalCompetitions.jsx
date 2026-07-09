import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, Edit2, Eye, Trash2, Globe, MapPin, Calendar,
  Upload, ExternalLink, Search, Filter, MoreVertical, Clock, FileText, X
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache } from "@/lib/api";
import { formatReadableDate, formatReadableDateTime } from "@/lib/date";

// External competitions list replaced by backend fetch.
// Removed hard-coded `mockExternalCompetitions` to ensure admin-created competitions
// are fetched from the API and appear in the list.

const categoryColors = {
  hackathon: "bg-secondary/10 text-secondary",
  workshop: "bg-info/10 text-info",
  seminar: "bg-achievement/10 text-achievement",
  other: "bg-muted text-muted-foreground",
};

const modeIcons = {
  online: Globe,
  offline: MapPin,
  hybrid: Globe,
};

// Derive competition status based on dates
// upcoming: startDate in future
// active: today between startDate and endDate (inclusive)
// completed: endDate in past
const getCompetitionStatus = (startDate, endDate) => {
  if (!startDate || !endDate) return "upcoming";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "upcoming";
  }
  if (today < start) return "upcoming";
  if (today > end) return "completed";
  return "active";
};

const formatDateTimeLabel = (value) => {
  return formatReadableDateTime(value);
};

export default function AdminExternalCompetitions() {
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDeadline, setFilterDeadline] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingCompetition, setViewingCompetition] = useState(null);
  const [isDeadlineDialogOpen, setIsDeadlineDialogOpen] = useState(false);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);
  const [newDeadline, setNewDeadline] = useState("");
  const [materialFiles, setMaterialFiles] = useState([]);
  const [existingMaterials, setExistingMaterials] = useState([]);
  const [registeredStudentsMap, setRegisteredStudentsMap] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "hackathon",
    customCategory: "",
    organizer: "",
    mode: "online",
    location: "",
    scale: "local",
    description: "",
    eligibility: "",
    registrationOpen: "",
    registrationClose: "",
    startDate: "",
    endDate: "",
    website: "",
    proofDeadline: "",
  });

  const isoToDateOnly = (val) => {
    if (!val) return "";
    if (typeof val === "string" && val.includes("T")) {
      return val.split("T")[0];
    }
    return val;
  };

  const isoToDateTimeLocal = (val) => {
    if (!val) return "";
    const raw = String(val).trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
      return raw.slice(0, 16);
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const dateTimeLocalToIso = (val) => {
    if (!val) return null;
    const raw = String(val).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
      return `${raw}:00`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
      return raw;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    const seconds = String(parsed.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const resolveEndDateStart = (endDateValue) => {
    if (!endDateValue) return null;
    const raw = String(endDateValue);
    const date = raw.includes("T")
      ? new Date(raw)
      : new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const hasReachedEndDate = (endDateValue) => {
    const endStart = resolveEndDateStart(endDateValue);
    if (!endStart) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= endStart;
  };

  const todayDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const nowDateTimeLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const todayDateTimeFloor = `${todayDate}T00:00`;

  const toDateOnly = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isFullDateTimeLocal = (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(value || ""));

  const buildViewStudentsState = (competition) => ({
    title: competition?.title || "",
    startDate: competition?.startDate || "",
    endDate: competition?.endDate || "",
    location: competition?.location || "",
    scale: competition?.scale || "",
  });

  const registrationOpenMin = (() => {
    const openDate = toDateOnly(formData.registrationOpen);
    if (
      editingCompetition
      && formData.registrationOpen
      && openDate
      && openDate < todayDate
    ) {
      return formData.registrationOpen;
    }
    return todayDateTimeFloor;
  })();

  const registrationCloseFloorDate = (() => {
    const openDate = toDateOnly(formData.registrationOpen);
    if (openDate && openDate > todayDate) {
      return openDate;
    }
    return todayDate;
  })();
  const registrationCloseFloor = `${registrationCloseFloorDate}T00:00`;

  const registrationCloseMin = (() => {
    const closeDate = toDateOnly(formData.registrationClose);
    if (
      editingCompetition
      && formData.registrationClose
      && closeDate
      && closeDate < registrationCloseFloorDate
    ) {
      return formData.registrationClose;
    }
    return registrationCloseFloor;
  })();

  const handleRegistrationOpenChange = (nextValue) => {
    const nextDate = toDateOnly(nextValue);
    if (isFullDateTimeLocal(nextValue) && nextDate && nextDate < todayDate) {
      toast.error("Registration open cannot be in the past.");
      return;
    }
    setFormData((prev) => {
      const next = { ...prev, registrationOpen: nextValue };
      const closeDate = toDateOnly(next.registrationClose);
      if (
        isFullDateTimeLocal(next.registrationClose)
        && isFullDateTimeLocal(nextValue)
        && closeDate
        && nextDate
        && closeDate < nextDate
      ) {
        next.registrationClose = nextValue;
      }
      return next;
    });
  };

  const handleRegistrationCloseChange = (nextValue) => {
    const nextDate = toDateOnly(nextValue);
    if (isFullDateTimeLocal(nextValue) && nextDate && nextDate < registrationCloseFloorDate) {
      toast.error("Registration close cannot be before registration open date or today.");
      return;
    }
    setFormData((prev) => ({ ...prev, registrationClose: nextValue }));
  };

  const mapCategoryToEnum = (cat) => {
    if (!cat) return "OTHER";
    const s = String(cat).trim().toLowerCase();
    if (s === "hackathon") return "HACKATHON";
    if (s === "workshop") return "WORKSHOP";
    if (s === "seminar") return "SEMINAR";
    return "OTHER";
  };

  const mapModeToEnum = (m) => {
    if (!m) return null;
    const s = String(m).trim().toLowerCase();
    if (s === "online") return "ONLINE";
    if (s === "hybrid") return "HYBRID";
    if (s === "physical" || s === "onsite" || s === "offline") return "OFFLINE";
    return String(m).toUpperCase();
  };

  const mapScaleToEnum = (sc) => {
    if (!sc) return null;
    const s = String(sc).trim().toLowerCase();
    if (s === "local") return "LOCAL";
    if (s === "national") return "NATIONAL";
    if (s === "international") return "INTERNATIONAL";
    return String(sc).toUpperCase();
  };

  const buildExternalPayload = (source) => ({
    title: source.title,
    description: source.description,
    competitionType: "EXTERNAL",
    format: "PROJECT",
    participationType: "INDIVIDUAL",
    category: source.category === "other" ? "OTHER" : mapCategoryToEnum(source.category),
    customCategory: source.category === "other" ? source.customCategory || null : null,
    organizer: source.organizer,
    mode: mapModeToEnum(source.mode),
    location: source.location,
    scale: mapScaleToEnum(source.scale),
    eligibility: source.eligibility,
    website: source.website || null,
    registrationOpen: dateTimeLocalToIso(source.registrationOpen),
    registrationClose: dateTimeLocalToIso(source.registrationClose),
    startDate: source.startDate ? `${source.startDate}T00:00:00` : null,
    endDate: source.endDate ? `${source.endDate}T00:00:00` : null,
    proofDeadline: dateTimeLocalToIso(source.proofDeadline),
  });

  const normalizeExternalCompetition = (c) => {
    const typeRaw = String(c?.competitionType || c?.type || "").toUpperCase();
    if (!typeRaw.includes("EXTERNAL")) return null;

    const id = c?.competitionId || c?.id;
    if (!id) return null;

    const modeRaw = String(c?.mode || "").toUpperCase();
    const mode = modeRaw === "ONLINE"
      ? "online"
      : modeRaw === "HYBRID"
        ? "hybrid"
        : "offline";

    const categoryUpper = String(c?.category || "").toUpperCase();

    return {
      id,
      title: c?.title || c?.name || "Untitled",
      category: categoryUpper === "OTHER" ? "other" : (c?.category || "other").toLowerCase(),
      customCategory: categoryUpper === "OTHER" ? (c?.customCategory || "") : "",
      organizer: c?.organizer || "",
      mode,
      location: c?.location || "",
      scale: (c?.scale || "local").toString().toLowerCase(),
      description: c?.description || "",
      eligibility: c?.eligibility || "",
      registrationOpen: isoToDateTimeLocal(c?.registrationOpen || null),
      registrationClose: isoToDateTimeLocal(c?.registrationClose || c?.registrationDeadline || null),
      startDate: isoToDateOnly(c?.startDate || c?.start || null),
      endDate: isoToDateOnly(c?.endDate || c?.end || null),
      website: c?.website || c?.websiteLink || "",
      proofDeadline: isoToDateTimeLocal(c?.proofDeadline || null),
      materials: Array.isArray(c?.materialsFilePaths)
        ? c.materialsFilePaths.map((path, index) => ({
            path,
            name: Array.isArray(c?.materialsFileNames) ? (c.materialsFileNames[index] || `Material ${index + 1}`) : `Material ${index + 1}`,
          }))
        : [],
      status: c?.status || getCompetitionStatus(c?.startDate || c?.start, c?.endDate || c?.end),
      submissions: Array.isArray(c?.registrations) ? c.registrations.length : c?.submissions || c?.participants || 0,
      createdAt: c?.createdAt || c?.publishDate || c?.startDate || c?.endDate || null,
    };
  };

  const validateExternalDates = (source) => {
    if (!source.startDate || !source.endDate) {
      return "Start date and end date are required.";
    }
    if (!source.registrationOpen) {
      return "Registration open date is required.";
    }
    if (!source.registrationClose) {
      return "Registration close date is required.";
    }
    const regOpenDate = toDateOnly(source.registrationOpen);
    const regCloseDate = toDateOnly(source.registrationClose);
    if (!regOpenDate || !regCloseDate) {
      return "Registration open and close dates are invalid.";
    }
    if (source.startDate < todayDate) {
      return "Start date cannot be in the past.";
    }
    if (source.endDate < todayDate) {
      return "End date cannot be in the past.";
    }
    if (source.endDate < source.startDate) {
      return "End date must be on or after start date.";
    }
    if (regOpenDate > regCloseDate) {
      return "Registration open must be before registration close.";
    }

    const unchangedRegistrationWindow = editingCompetition
      && editingCompetition.registrationOpen === source.registrationOpen
      && editingCompetition.registrationClose === source.registrationClose;
    if (!unchangedRegistrationWindow) {
      if (regOpenDate < todayDate) {
        return "Registration open cannot be in the past.";
      }
      if (regCloseDate < todayDate) {
        return "Registration close cannot be in the past.";
      }
    }

    if (regOpenDate > source.startDate) {
      return "Registration open must be on or before start date.";
    }
    if (regCloseDate > source.startDate) {
      return "Registration close must be on or before start date.";
    }
    return null;
  };

  const saveCompetition = async (token, competitionId, payload, materials = []) => {
    const formBody = new FormData();
    formBody.append("data", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    (Array.isArray(materials) ? materials : []).forEach((file) => {
      if (file) {
        formBody.append("materials", file);
      }
    });

    const method = competitionId ? "PUT" : "POST";
    const endpoint = competitionId
      ? `${API_BASE_URL}/api/competitions/${competitionId}`
      : `${API_BASE_URL}/api/competitions`;

    const res = await fetch(endpoint, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: formBody,
    });

    if (!res.ok) {
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text().catch(() => null);
      throw new Error((body && (body.message || JSON.stringify(body))) || `Request failed (${res.status})`);
    }

    return res.json();
  };

  const loadCompetitions = async ({ force = false } = {}) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      setCompetitions([]);
      return;
    }

    try {
      const data = await fetchJsonCached(`${API_BASE_URL}/api/competitions`, {
        token,
        ttlMs: 120000,
        force,
        cacheKey: "admin:competitions:list",
      });
      const mapped = (Array.isArray(data) ? data : [])
        .map(normalizeExternalCompetition)
        .filter(Boolean)
        .sort((a, b) => {
          const first = new Date(b.createdAt || b.startDate || b.endDate || 0).getTime();
          const second = new Date(a.createdAt || a.startDate || a.endDate || 0).getTime();
          const safeFirst = Number.isNaN(first) ? 0 : first;
          const safeSecond = Number.isNaN(second) ? 0 : second;
          return safeFirst - safeSecond;
        });
      setCompetitions(mapped);
    } catch {
      setCompetitions([]);
    }
  };

  const filteredCompetitions = competitions.filter((comp) => {
    const title = (comp?.title || "").toLowerCase();
    const organizer = (comp?.organizer || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = title.includes(query) || organizer.includes(query);
    const matchesCategory = filterCategory === "all" || comp.category === filterCategory;
    const matchesDeadline = filterDeadline === "all" || 
      (filterDeadline === "set" && comp.proofDeadline) ||
      (filterDeadline === "not_set" && !comp.proofDeadline);
    return matchesSearch && matchesCategory && matchesDeadline;
  });

  const handleOpenForm = (competition = null) => {
    setFormError("");
    setIsSaving(false);
    if (competition) {
      if (hasReachedEndDate(competition.endDate)) {
        toast.error("Competition cannot be edited on or after end date. Set proof deadline instead.");
        return;
      }
      // normalize mode to match select values
      const rawMode = String(competition.mode || "").toLowerCase();
      const modeValue = rawMode === "online"
        ? "online"
        : rawMode === "offline" || rawMode === "physical" || rawMode === "onsite"
          ? "offline"
          : "hybrid";

      // normalize scale to select values
      const rawScale = String(competition.scale || "").toLowerCase();
      const scaleValue = rawScale === "local" ? "local" : rawScale === "national" ? "national" : rawScale === "international" ? "international" : "local";

      const mapCategoryFromApi = (cat) => {
        if (!cat) return "other";
        if (["HACKATHON", "WORKSHOP", "SEMINAR"].includes(cat.toUpperCase())) {
          return cat.toLowerCase();
        }
        return "other";
      };
      const mapCustomCategoryFromApi = (cat, custom) => {
        return String(cat || "").toUpperCase() === "OTHER" ? custom || "" : "";
      };
      setFormData({
        title: competition.title || "",
        category: mapCategoryFromApi(competition.category),
        customCategory: mapCustomCategoryFromApi(competition.category, competition.customCategory),
        organizer: competition.organizer || "",
        mode: modeValue,
        location: competition.location || "",
        scale: scaleValue,
        description: competition.description || "",
        eligibility: competition.eligibility || "",
        registrationOpen: competition.registrationOpen || "",
        registrationClose: competition.registrationClose || "",
        startDate: competition.startDate || "",
        endDate: competition.endDate || "",
        website: competition.website || competition.websiteLink || "",
        proofDeadline: competition.proofDeadline || "",
      });
      setExistingMaterials(Array.isArray(competition.materials) ? competition.materials : []);
      setMaterialFiles([]);
    } else {
      setEditingCompetition(null);
      setFormData({
        title: "",
        category: "hackathon",
        customCategory: "",
        organizer: "",
        mode: "online",
        location: "",
        scale: "local",
        description: "",
        eligibility: "",
        registrationOpen: "",
        registrationClose: "",
        startDate: "",
        endDate: "",
        website: "",
        proofDeadline: "",
      });
      setExistingMaterials([]);
      setMaterialFiles([]);
    }
    setEditingCompetition(competition);
    setIsFormOpen(true);
  };

  const handleOpenView = (competition = null) => {
    setViewingCompetition(competition);
    setIsViewDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError("");

    // Validate custom category
    if (formData.category === "other" && !formData.customCategory.trim()) {
      const message = "Please specify both category and custom category name";
      setFormError(message);
      toast.error(message);
      return;
    }

    const competitionData = {
      ...formData,
      proofDeadline: editingCompetition?.proofDeadline || "",
    };

    const dateError = validateExternalDates(competitionData);
    if (dateError) {
      setFormError(dateError);
      toast.error(dateError);
      return;
    }

    const payload = buildExternalPayload(competitionData);
    if (editingCompetition) {
      payload.keepMaterialPaths = existingMaterials.map((item) => item.path).filter(Boolean);
    }
    if (!payload.proofDeadline) {
      delete payload.proofDeadline;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      const message = "Please sign in again.";
      setFormError(message);
      toast.error(message);
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveCompetition(token, editingCompetition?.id, payload, materialFiles);
      const normalized = normalizeExternalCompetition(saved);
      if (normalized) {
        setCompetitions((prev) => {
          if (editingCompetition) {
            return prev.map((comp) => (comp.id === editingCompetition.id ? normalized : comp));
          }
          return [normalized, ...prev];
        });
      } else {
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes("/api/competitions")
            || value.includes("admin:competitions:list")
            || value.includes("competitions:")
            || value.includes("competition:");
        });
        await loadCompetitions({ force: false });
      }
      if (editingCompetition) {
        toast.success("Competition updated");
      } else {
        toast.success("Competition created");
        navigate("/admin/external-competitions");
      }
      setMaterialFiles([]);
      setExistingMaterials([]);
      setFormError("");
      setIsFormOpen(false);
    } catch (err) {
      const message = err?.message || "Unable to save competition";
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id) => {
    const targetCompetition = competitions.find((comp) => comp.id === id);
    const title = targetCompetition?.title || "this competition";
    const confirmed = window.confirm(`Are you sure you want to delete ${title}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }
    // call backend to delete if possible
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      setCompetitions(prev => prev.filter(comp => comp.id !== id));
      toast.success("Competition removed locally");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/competitions/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast.error("Failed to delete competition");
          return;
        }
        setCompetitions(prev => prev.filter(comp => comp.id !== id));
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes("/api/competitions")
            || value.includes("/api/external/participations")
            || value.includes("/api/notifications")
            || value.includes("admin:competitions:list")
            || value.includes("competitions:")
            || value.includes("competition:")
            || value.includes("external:participations:")
            || value.includes("notifications");
        });
        window.dispatchEvent(new CustomEvent("competitions:updated"));
        window.dispatchEvent(new CustomEvent("submissions:updated"));
        window.dispatchEvent(new CustomEvent("notifications:updated"));
        toast.success("Competition deleted");
      } catch (e) {
        toast.error("Unable to delete competition");
      }
    })();
  };

  // Load external competitions from backend
  useEffect(() => {
    loadCompetitions({ force: false });
    const handleCompetitionUpdate = () => loadCompetitions({ force: false });
    window.addEventListener("competitions:updated", handleCompetitionUpdate);
    return () => {
      window.removeEventListener("competitions:updated", handleCompetitionUpdate);
    };
  }, []);

  useEffect(() => {
    competitions.forEach((comp) => {
      if (!registeredStudentsMap[comp.id]) {
        fetchRegisteredStudents(comp.id);
      }
    });
  }, [competitions]);

  const openDeadlineDialog = (id) => {
    const comp = competitions.find(c => c.id === id);
    if (!comp) return;
    if (!hasReachedEndDate(comp.endDate)) {
      toast.error("Proof deadline can only be set on or after competition end date.");
      return;
    }

    setSelectedCompetitionId(id);
    setNewDeadline(comp?.proofDeadline || "");
    setIsDeadlineDialogOpen(true);
  };

  const handleMaterialFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setMaterialFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeNewMaterial = (index) => {
    setMaterialFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingMaterial = (path) => {
    setExistingMaterials((prev) => prev.filter((item) => item.path !== path));
  };

  const handleSetProofDeadline = () => {
    if (!newDeadline) {
      toast.error("Please select a deadline date and time");
      return;
    }
    const comp = competitions.find((item) => item.id === selectedCompetitionId);
    if (!comp) {
      toast.error("Competition not found");
      return;
    }
    const deadlineDate = new Date(newDeadline);
    const endDateStart = resolveEndDateStart(comp.endDate);
    if (Number.isNaN(deadlineDate.getTime())) {
      toast.error("Invalid proof deadline date and time.");
      return;
    }
    if (deadlineDate < new Date()) {
      toast.error("Proof deadline cannot be in the past.");
      return;
    }
    if (!hasReachedEndDate(comp.endDate)) {
      toast.error("Proof deadline can only be set on or after competition end date.");
      return;
    }
    if (endDateStart && deadlineDate < endDateStart) {
      toast.error("Proof deadline must be on or after competition end date.");
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      toast.error("Please sign in again.");
      return;
    }

    (async () => {
      try {
        const payload = buildExternalPayload({ ...comp, proofDeadline: newDeadline });
        const updated = await saveCompetition(token, comp.id, payload);
        const normalized = normalizeExternalCompetition(updated);
        if (normalized) {
          setCompetitions((prev) => prev.map((item) => (item.id === comp.id ? normalized : item)));
        } else {
          invalidateApiCache((key) => {
            const value = String(key);
            return value.includes("/api/competitions")
              || value.includes("admin:competitions:list")
              || value.includes("competitions:")
              || value.includes("competition:");
          });
          await loadCompetitions({ force: false });
        }
        invalidateApiCache((key) => {
          const value = String(key);
          return value.includes("/api/competitions")
            || value.includes("/api/external/participations")
            || value.includes("/api/notifications")
            || value.includes("competitions:")
            || value.includes("competition:")
            || value.includes("external:participations:")
            || value.includes("notifications");
        });
        window.dispatchEvent(new CustomEvent("competitions:updated"));
        window.dispatchEvent(new CustomEvent("submissions:updated"));
        window.dispatchEvent(new CustomEvent("notifications:updated"));
        toast.success("Proof deadline set successfully");
        setIsDeadlineDialogOpen(false);
        setNewDeadline("");
        setSelectedCompetitionId(null);
      } catch (err) {
        toast.error(err?.message || "Failed to set proof deadline");
      }
    })();
  };

  const getCategoryDisplay = (comp) => {
    if (comp.category.toLowerCase() === "other" && comp.customCategory) return comp.customCategory;
    if (!comp.category) return "Other";
    // Otherwise capitalize first letter for standard categories
    return comp.category.charAt(0).toUpperCase() + comp.category.slice(1);
  };

  const fetchRegisteredStudents = async (competitionId) => {
    try {
      setLoadingStudents(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
      const data = await fetchJsonCached(
        `${API_BASE_URL}/competitions/admin/${competitionId}/registrations`,
        {
          token,
          ttlMs: 60000,
          force: false,
          cacheKey: `admin:external:registrations:${competitionId}`,
        }
      );

      setRegisteredStudentsMap((prev) => ({
        ...prev,
        [competitionId]: data || [],
      }));
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  return (
    <AppLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              External Competitions
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage external competition listings
            </p>
          </div>
          <Button onClick={() => handleOpenForm()} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Competition
          </Button>
        </div>

        {/* Info Banner */}
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <p className="text-sm text-info">
            <strong>Note:</strong> Before end date you can edit. On or after end date, editing is locked and admin should set proof submission deadline. Delete is always available.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search competitions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {[...new Set(competitions.map(c => c.category))].map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDeadline} onValueChange={setFilterDeadline}>
            <SelectTrigger className="w-full sm:w-48">
              <Clock className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Deadline Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Deadlines</SelectItem>
              <SelectItem value="set">Deadline Set</SelectItem>
              <SelectItem value="not_set">No Deadline</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Competitions List */}
        <div className="grid gap-4">
          {filteredCompetitions.map((competition) => {
            const ModeIcon = modeIcons[competition.mode];
            const status = getCompetitionStatus(competition.startDate, competition.endDate);
            const hasReachedEnd = hasReachedEndDate(competition.endDate);
            const canSetProofDeadline = hasReachedEnd;
            const canManageCompetition = !hasReachedEnd;
             
            return (
              <div key={competition.id} className="card-static p-5">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{competition.title}</h3>
                      <span className={cn("badge-status", categoryColors[competition.category] || categoryColors.other)}>
                        {getCategoryDisplay(competition)}
                      </span>
                      <span className={cn(
                        "badge-status",
                        status === "active" && "bg-success/10 text-success",
                        status === "upcoming" && "bg-info/10 text-info",
                        status === "completed" && "bg-muted text-muted-foreground"
                      )}>
                        {status}
                      </span>
                    </div>
                    
                    <p className="text-sm text-foreground/90 mb-3">
                      {competition.description}
                    </p>

                    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Organizer</p>
                        <p className="mt-0.5 font-medium text-foreground break-words">
                          {competition.organizer || "-"}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mode / Location</p>
                        <p className="mt-0.5 font-medium text-foreground flex items-center gap-1.5 capitalize break-words">
                          {ModeIcon && <ModeIcon className="w-4 h-4 text-secondary flex-shrink-0" />}
                          {competition.mode === "offline" ? "physical" : competition.mode || "-"}
                          {competition.location ? ` - ${competition.location}` : ""}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Duration</p>
                        <p className="mt-0.5 font-medium text-foreground flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-secondary flex-shrink-0" />
                          {formatReadableDate(competition.startDate)} - {formatReadableDate(competition.endDate)}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Scale</p>
                        <p className="mt-0.5 font-medium text-foreground capitalize">
                          {competition.scale || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      {competition.proofDeadline ? (
                        <div className="p-2 rounded bg-secondary/5 border border-secondary/20 inline-flex items-center gap-2 text-sm">
                          <Upload className="w-4 h-4 text-secondary" />
                          <span>Proof Deadline: <strong>{formatDateTimeLabel(competition.proofDeadline)}</strong></span>
                        </div>
                      ) : (
                        <div className="p-2 rounded bg-muted/50 border border-border inline-flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">No proof deadline set yet</span>
                        </div>
                      )}
                      {hasReachedEnd && !competition.proofDeadline && (
                        <div className="p-2 rounded bg-warning/10 border border-warning/30 inline-flex items-center gap-2 text-sm text-warning">
                          <Clock className="w-4 h-4" />
                          End date reached. Set proof submission deadline now.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {competition.website && (
                      <Button variant="outline" size="sm" className="gap-1" asChild>
                        <a href={competition.website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                          Website
                        </a>
                      </Button>
                      
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => fetchRegisteredStudents(competition.id)}
                        >
                          <Eye className="w-4 h-4" />
                          View Students ({registeredStudentsMap[competition.id]?.length ?? 0})
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent className="w-72 max-h-64 overflow-y-auto mt-1">
                        {loadingStudents && !registeredStudentsMap[competition.id] ? (
                          <p className="text-sm text-muted-foreground p-2">Loading students...</p>
                        ) : (registeredStudentsMap[competition.id]?.length || 0) === 0 ? (
                          <p className="text-sm text-muted-foreground p-2">No students have registered yet.</p>
                        ) : (
                          (() => {
                            const students = registeredStudentsMap[competition.id] || [];
                            const preview = students.slice(0, 5);
                            const hasMore = students.length > 5;
                            return (
                              <>
                                {preview.map((reg, index) => (
                                  <DropdownMenuItem key={reg.id || index} className="flex flex-col gap-0.5">
                                    <span>{reg.username || "Student"}</span>
                                    <span className="text-xs text-muted-foreground">{reg.email || ""}</span>
                                  </DropdownMenuItem>
                                ))}
                                {hasMore && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => navigate(
                                        `/admin/external-competitions/${competition.id}/students`,
                                        { state: buildViewStudentsState(competition) }
                                      )}
                                    >
                                      See more ({students.length})
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            );
                          })()
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => navigate(
                            `/admin/external-competitions/${competition.id}/students`,
                            { state: buildViewStudentsState(competition) }
                          )}
                        >
                          Open full list
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleOpenView(competition)}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    {canManageCompetition && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleOpenForm(competition)}
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={!canSetProofDeadline}
                          onClick={() => openDeadlineDialog(competition.id)}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {competition.proofDeadline ? "Update Proof Deadline" : "Set Proof Deadline"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(competition.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {competition.submissions > 0 && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {competition.submissions} proof submissions received
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/admin/approvals?search=${encodeURIComponent(competition.title)}`)}
                    >
                      View Submissions
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {filteredCompetitions.length === 0 && (
          <div className="card-static p-12 text-center">
            <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No competitions found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Set Proof Deadline Dialog */}
        <Dialog open={isDeadlineDialogOpen} onOpenChange={setIsDeadlineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Proof Submission Deadline</DialogTitle>
              <DialogDescription>
                Set the deadline for students to submit their participation proof. 
                This can only be set on or after the competition end date, and the deadline must be on or after end date.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="deadline">Proof Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={newDeadline}
                  min={(() => {
                    const competition = competitions.find((item) => item.id === selectedCompetitionId);
                    if (!competition) return nowDateTimeLocal;
                    const endDateMin = competition.endDate ? `${competition.endDate}T00:00` : nowDateTimeLocal;
                    return endDateMin > nowDateTimeLocal ? endDateMin : nowDateTimeLocal;
                  })()}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="mt-1"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Students can submit proofs until this deadline. You can update it later, but cannot remove it once set.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeadlineDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSetProofDeadline} className="gap-1">
                <Upload className="w-4 h-4" />
                Set Deadline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Competition Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>View External Competition</DialogTitle>
              <DialogDescription>
                Competition details (read-only)
              </DialogDescription>
            </DialogHeader>

            {viewingCompetition ? (
              <div className="space-y-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Title</p>
                  <p className="font-medium text-foreground">{viewingCompetition.title || "-"}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Category</p>
                    <p className="font-medium text-foreground capitalize">{viewingCompetition.category || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Scale</p>
                    <p className="font-medium text-foreground capitalize">{viewingCompetition.scale || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Mode</p>
                    <p className="font-medium text-foreground capitalize">{viewingCompetition.mode || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Organizer</p>
                    <p className="font-medium text-foreground">{viewingCompetition.organizer || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Start Date</p>
                    <p className="font-medium text-foreground">{formatReadableDate(viewingCompetition.startDate) || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">End Date</p>
                    <p className="font-medium text-foreground">{formatReadableDate(viewingCompetition.endDate) || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Registration Open</p>
                    <p className="font-medium text-foreground">{formatDateTimeLabel(viewingCompetition.registrationOpen) || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase">Registration Close</p>
                    <p className="font-medium text-foreground">{formatDateTimeLabel(viewingCompetition.registrationClose) || "-"}</p>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase">Proof Deadline</p>
                    <p className="font-medium text-foreground">{formatDateTimeLabel(viewingCompetition.proofDeadline) || "-"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Location</p>
                  <p className="font-medium text-foreground">{viewingCompetition.location || "-"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Eligibility</p>
                  <p className="font-medium text-foreground">{viewingCompetition.eligibility || "-"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Website</p>
                  {viewingCompetition.website ? (
                    <a
                      href={viewingCompetition.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-secondary hover:underline break-all"
                    >
                      {viewingCompetition.website}
                    </a>
                  ) : (
                    <p className="font-medium text-foreground">-</p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Description</p>
                  <p className="font-medium text-foreground whitespace-pre-wrap">
                    {viewingCompetition.description || "-"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No competition selected.</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Competition Form Dialog */}
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) {
              setFormError("");
              setIsSaving(false);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCompetition ? "Edit Competition" : "Create External Competition"}
              </DialogTitle>
              <DialogDescription>
                {editingCompetition 
                  ? "Update the competition details below."
                  : "Fill in the details to create a new external competition listing."
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="title">Competition Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value, customCategory: value === "other" ? prev.customCategory : "" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hackathon">Hackathon</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="seminar">Seminar</SelectItem>
                      <SelectItem value="other">Other (specify)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.category === "other" && (
                  <div>
                    <Label htmlFor="customCategory">Custom Category</Label>
                    <Input
                      id="customCategory"
                      value={formData.customCategory}
                      onChange={(e) => setFormData(prev => ({ ...prev, customCategory: e.target.value }))}
                      placeholder="e.g., Robotics, Debate, Case Study"
                      required
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="organizer">Organizer</Label>
                  <Input
                    id="organizer"
                    value={formData.organizer}
                    onChange={(e) => setFormData(prev => ({ ...prev, organizer: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="mode">Mode</Label>
                  <Select 
                    value={formData.mode} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, mode: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Physical</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Venue or 'Virtual'"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="scale">Scale</Label>
                  <Select 
                    value={formData.scale} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, scale: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="international">International</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="registrationOpen">Registration Opens</Label>
                  <Input
                    id="registrationOpen"
                    type="datetime-local"
                    value={formData.registrationOpen}
                    min={registrationOpenMin}
                    onChange={(e) => handleRegistrationOpenChange(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="registrationClose">Registration Closes</Label>
                  <Input
                    id="registrationClose"
                    type="datetime-local"
                    value={formData.registrationClose}
                    min={registrationCloseMin}
                    onChange={(e) => handleRegistrationCloseChange(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    min={todayDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || todayDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="website">Website URL</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://..."
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="eligibility">Eligibility</Label>
                  <Input
                    id="eligibility"
                    value={formData.eligibility}
                    onChange={(e) => setFormData(prev => ({ ...prev, eligibility: e.target.value }))}
                    placeholder="Who can participate?"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="materials">Materials (Files)</Label>
                  <Input
                    id="materials"
                    type="file"
                    multiple
                    onChange={handleMaterialFileSelect}
                  />
                  {(existingMaterials.length > 0 || materialFiles.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {existingMaterials.map((material) => (
                        <span
                          key={`existing-${material.path}`}
                          className="badge-status bg-muted text-muted-foreground flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {material.name}
                          <button
                            type="button"
                            onClick={() => removeExistingMaterial(material.path)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {materialFiles.map((file, index) => (
                        <span
                          key={`new-${file.name}-${index}`}
                          className="badge-status bg-secondary/10 text-secondary flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {file.name}
                          <button
                            type="button"
                            onClick={() => removeNewMaterial(index)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!editingCompetition && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 inline mr-1" />
                    <strong>Note:</strong> Proof submission deadline is not set during creation. Set it later on or after end date.
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => {
                    setIsFormOpen(false);
                    setFormError("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving
                    ? (editingCompetition ? "Updating..." : "Creating...")
                    : (editingCompetition ? "Update Competition" : "Create Competition")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
