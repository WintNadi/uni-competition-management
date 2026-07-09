import { useEffect, useRef, useState } from "react";
import { Search, Filter, Calendar, Users, Clock, ExternalLink, Building, User, UsersRound, Eye } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";

// Competitions are loaded from the backend API; no local mock list is used here.

const statusStyles = {
  open: "bg-success/10 text-success border-success/20",
  upcoming: "bg-info/10 text-info border-info/20",
  closed: "bg-muted text-muted-foreground border-border",
};

const statusLabels = {
  open: "Open for Registration",
  upcoming: "Coming Soon",
  closed: "Registration Closed",
};

const filters = [
  { label: "All", value: "all" },
  { label: "Internal", value: "internal" },
  { label: "External", value: "external" },
];

const statusFilters = [
  { label: "All Status", value: "all" },
  { label: "Open", value: "open" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Closed", value: "closed" },
];

// Map backend competition status (PUBLISHED/CLOSED/DRAFT) and dates to student-facing status
const mapInternalStatus = (backendStatus, registrationOpen, registrationClose, submissionDeadline) => {
  const now = new Date();
  const regOpen = registrationOpen ? new Date(registrationOpen) : null;
  const regClose = registrationClose ? new Date(registrationClose) : null;
  const submit = submissionDeadline ? new Date(submissionDeadline) : null;

  const upperStatus = backendStatus ? String(backendStatus).toUpperCase() : "DRAFT";

  if (upperStatus === "CLOSED") return "closed";
  if (upperStatus === "DRAFT") return "upcoming";

  if (regOpen && !Number.isNaN(regOpen.getTime()) && now < regOpen) return "upcoming";
  if (regClose && !Number.isNaN(regClose.getTime()) && now > regClose) return "closed";
  if (submit && !Number.isNaN(submit.getTime()) && now > submit) return "closed";

  return "open";
};

const mapFormatToCategory = (format) => {
  if (!format) return "Internal Competition";
  const lower = String(format).toLowerCase();
  if (lower === "quiz") return "Quiz";
  if (lower === "assignment") return "Assignment";
  if (lower === "project") return "Project";
  return "Internal Competition";
};

export default function Competitions() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const isLoadingDataRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const pendingReloadForceRef = useRef(false);

  const toSortTimestamp = (value) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) {
      // No token: don't populate with local mocks. Leave list empty.
      setCompetitions([]);
      hasLoadedRef.current = false;
      setLoading(false);
      return;
    }

    const mapExternalStatus = (registrationOpen, registrationClose, startDate, endDate) => {
      const now = new Date();

      const regOpen = registrationOpen ? new Date(registrationOpen) : null;
      const regClose = registrationClose ? new Date(registrationClose) : null;
      const hasWindow = regOpen && !Number.isNaN(regOpen.getTime())
        && regClose && !Number.isNaN(regClose.getTime());

      if (hasWindow) {
        if (now < regOpen) return "upcoming";
        if (now > regClose) return "closed";
        return "open";
      }

      const end = endDate ? new Date(endDate) : null;
      if (end && now > end) return "closed";

      const start = startDate ? new Date(startDate) : null;
      if (start && now < start) return "upcoming";

      return "upcoming";
    };

    const load = async (force = false) => {
      if (isLoadingDataRef.current) {
        pendingReloadRef.current = true;
        pendingReloadForceRef.current = pendingReloadForceRef.current || force;
        return;
      }

      isLoadingDataRef.current = true;
      const shouldShowLoading = !hasLoadedRef.current;
      if (shouldShowLoading) {
        setLoading(true);
      }
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/competitions`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "competitions:list",
        });
        const mappedCompetitions = (Array.isArray(data) ? data : [])
          .filter((c) => {
            const s = c.status ? String(c.status).toUpperCase() : "DRAFT";
            return s !== "DRAFT";
          })
          .map((c) => {
            const id = c.competitionId || c.id;
            if (!id) return null;

            const typeRaw = String(c.competitionType || c.type || "INTERNAL").toUpperCase();
            const type = typeRaw.includes("EXTERNAL") ? "external" : "internal";
            const participation = String(c.participationType || c.participation || "INDIVIDUAL").toUpperCase() === "TEAM"
              ? "team"
              : "individual";

            if (type === "internal") {
              const status = mapInternalStatus(
                c.status,
                c.registrationOpen,
                c.registrationClose || c.registrationDeadline,
                c.submissionDeadline
              );

              const deadlineDate = c.submissionDeadline
                ? new Date(c.submissionDeadline)
                : (c.registrationClose || c.registrationDeadline ? new Date(c.registrationClose || c.registrationDeadline) : null);

              return {
                id,
                title: c.title,
                description: c.description,
                category: mapFormatToCategory(c.format),
                deadline: deadlineDate ? deadlineDate.toLocaleDateString() : "-",
                participants: c.participants || 0,
                status,
                type: "internal",
                participation,
                createdBy: c.createdByName || null,
                sortDate: c.createdAt || c.publishDate || c.registrationOpen || c.submissionDeadline || null,
              };
            }

            const start = c.startDate || c.start;
            const end = c.endDate || c.end;
            const registrationOpen = c.registrationOpen || null;
            const registrationClose = c.registrationClose || c.registrationDeadline || null;
            return {
              id,
              title: c.title,
              description: c.description,
              category: c.category || c.format || "External Competition",
              customCategory: c.customCategory || null,
              startDate: start || "-",
              endDate: end || "-",
              participants: c.participants || 0,
              status: mapExternalStatus(registrationOpen, registrationClose, start, end),
              type: "external",
              participation,
              organizer: c.organizer,
              mode: c.mode,
              location: c.location,
              scale: c.scale,
              websiteLink: c.websiteLink || c.website,
              createdBy: c.createdByName || null,
              sortDate: c.createdAt || start || end || null,
            };
          })
          .filter(Boolean)
          .sort((a, b) => toSortTimestamp(b.sortDate) - toSortTimestamp(a.sortDate));

        setCompetitions(mappedCompetitions);
      } catch (error) {
        toast.error("An error occurred while loading competitions");
        setCompetitions([]);
      } finally {
        hasLoadedRef.current = true;
        if (shouldShowLoading) {
          setLoading(false);
        }
        isLoadingDataRef.current = false;
        if (pendingReloadRef.current) {
          const queuedForce = pendingReloadForceRef.current;
          pendingReloadRef.current = false;
          pendingReloadForceRef.current = false;
          void load(queuedForce);
        }
      }
    };

    load();
    const handleCompetitionUpdate = () => load(false);
    window.addEventListener("competitions:updated", handleCompetitionUpdate);

    return () => {
      window.removeEventListener("competitions:updated", handleCompetitionUpdate);
    };
  }, []);

    const filteredCompetitions = competitions.filter((comp) => {
    const matchesType = typeFilter === "all" || comp.type === typeFilter;
    const matchesStatus = statusFilter === "all" || comp.status === statusFilter;
    const matchesSearch = comp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const getCategoryDisplay = (comp) => {
    if (!comp?.category) return "Other";

    if (
      comp.category.toLowerCase() === "other" &&
      comp.customCategory
    ) {
      return comp.customCategory;
    }

    return (
      comp.category.charAt(0).toUpperCase() +
      comp.category.slice(1)
    );
  };


  return (
    <AppLayout role="student">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Competitions
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover and participate in exciting academic competitions
          </p>
        </div>

        {/* Filters */}
        <div className="card-static p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search competitions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex gap-2">
              {/* Type Filter */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setTypeFilter(filter.value)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium transition-colors",
                      typeFilter === filter.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Competition List */}
        <div className="grid gap-4">
          {loading && (
            <div className="card-static p-6 text-center text-muted-foreground">
              Loading competitions...
            </div>
          )}
          {!loading && filteredCompetitions.map((competition) => (
            <div 
              key={competition.id} 
              className="card-elevated p-6 group"
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {competition.status && (
                      <span className={cn("badge-status border", statusStyles[competition.status])}>
                        {statusLabels[competition.status]}
                      </span>
                    )}

                    <span className="badge-status bg-muted text-muted-foreground flex items-center gap-1">
                      {competition.type === "external" ? (
                        <ExternalLink className="w-3 h-3" />
                      ) : (
                        <Building className="w-3 h-3" />
                      )}
                      {competition.type}
                    </span>
                    <span className="badge-status bg-secondary/10 text-secondary">
                      {getCategoryDisplay(competition)}
                    </span>

                    <span className={cn(
                      "badge-status flex items-center gap-1",
                      competition.participation === "team" 
                        ? "bg-accent text-accent-foreground" 
                        : "bg-secondary/10 text-secondary"
                    )}>
                      {competition.participation === "team" ? (
                        <>
                          <UsersRound className="w-3 h-3" />
                          Team
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3" />
                          Individual
                        </>
                      )}
                    </span>
                  </div>
                  
                  <h3 className="font-display font-semibold text-lg text-foreground group-hover:text-secondary transition-colors">
                    {competition.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    {competition.description}
                  </p>
                  
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {competition.type === "internal" ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          Deadline: {competition.deadline}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {competition.startDate
                            ? new Date(competition.startDate).toLocaleDateString()
                            : "-"}
                          {" - "}
                          {competition.endDate
                            ? new Date(competition.endDate).toLocaleDateString()
                            : "-"}
                        </span>

                      )}
                      {competition.type === "internal" && (
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {competition.participants} participants
                        </span>
                      )}
                      {competition.type === "external" && competition.organizer && (
                        <span className="flex items-center gap-1.5">
                          <Building className="w-4 h-4" />
                          {competition.organizer}
                        </span>
                      )}
                      {competition.createdBy && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          Created by: {competition.createdBy}
                        </span>
                      )}

                    </div>
                </div>

                {/* For external competitions - show Visit Website button */}
                {competition.type === "external" ? (
                  <div className="flex flex-col gap-2">
                    <Link 
                      to={`/competitions/${competition.id}`}
                      state={{ competition }}
                    >
                      <Button variant="outline" className="w-full gap-2">
                        <Eye className="w-4 h-4" />
                        View Details
                      </Button>
                    </Link>
                    {competition.websiteLink && (
                      <a 
                        href={competition.websiteLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button className="w-full gap-2">
                          <ExternalLink className="w-4 h-4" />
                          Visit Website
                        </Button>
                      </a>
                    )}
                  </div>
                ) : (
                  <Link 
                    to={`/competitions/${competition.id}`}
                    state={{ competition }}
                  >
                    <Button 
                      className={cn(
                        "flex-shrink-0 gap-2",
                        competition.status === "closed" && "opacity-50 pointer-events-none"
                      )}
                      disabled={competition.status === "closed"}
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredCompetitions.length === 0 && (
          <div className="card-static p-12 text-center">
            <p className="text-muted-foreground">No competitions found matching your criteria.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
