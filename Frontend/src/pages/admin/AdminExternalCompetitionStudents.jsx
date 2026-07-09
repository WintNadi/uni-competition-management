import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";

const formatDateOnly = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const normalizeScale = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "local") return "Local";
  if (normalized === "national") return "National";
  if (normalized === "international") return "International";
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "-";
};

export default function AdminExternalCompetitionStudents() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [competitionInfo, setCompetitionInfo] = useState({
    title: location.state?.title || "",
    startDate: location.state?.startDate || "",
    endDate: location.state?.endDate || "",
    location: location.state?.location || "",
    scale: location.state?.scale || "",
  });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token || !competitionId) {
      setStudents([]);
      setLoading(false);
      return;
    }

    let active = true;
    const loadStudents = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchJsonCached(
          `${API_BASE_URL}/competitions/admin/${competitionId}/registrations`,
          {
            token,
            ttlMs: 60000,
            cacheKey: `admin:external:registrations:${competitionId}`,
          }
        );
        if (!active) return;
        setStudents(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load registered students.");
        setStudents([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadStudents();
    return () => {
      active = false;
    };
  }, [competitionId]);

  useEffect(() => {
    if (!competitionId) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;
    if (!token) return;
    let active = true;
    const loadCompetitionInfo = async () => {
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/competitions/${competitionId}`, {
          token,
          ttlMs: 120000,
          cacheKey: `admin:competition:${competitionId}`,
        });
        if (!active) return;
        setCompetitionInfo((prev) => ({
          title: data?.title || prev.title || "",
          startDate: data?.startDate || prev.startDate || "",
          endDate: data?.endDate || prev.endDate || "",
          location: data?.location || prev.location || "",
          scale: data?.scale || prev.scale || "",
        }));
      } catch {
        // ignore competition detail errors
      }
    };
    loadCompetitionInfo();
    return () => {
      active = false;
    };
  }, [competitionId]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const query = searchQuery.toLowerCase();
    return (Array.isArray(students) ? students : []).filter((student) => {
      const name = String(student?.username || "").toLowerCase();
      const email = String(student?.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [students, searchQuery]);

  return (
    <AppLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/admin/external-competitions")}>
            <ArrowLeft className="w-4 h-4" />
            Back to External Competitions
          </Button>
        </div>

        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Registered Students
          </h1>
          <p className="text-muted-foreground mt-1">
            {competitionInfo.title ? `Competition: ${competitionInfo.title}` : "External competition registrations"}
          </p>
        </div>

        <div className="card-static p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="card-static p-6 space-y-4">
          {loading && (
            <div className="text-center text-muted-foreground">Loading students...</div>
          )}
          {!loading && error && (
            <div className="text-center text-destructive">{error}</div>
          )}
          {!loading && !error && filteredStudents.length === 0 && (
            <div className="text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              No registered students found.
            </div>
          )}
          {!loading && !error && filteredStudents.length > 0 && (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">No.</th>
                    <th className="px-4 py-3 text-left font-medium">Student Name</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Competition Name</th>
                    <th className="px-4 py-3 text-left font-medium">Start Date</th>
                    <th className="px-4 py-3 text-left font-medium">End Date</th>
                    <th className="px-4 py-3 text-left font-medium">Location</th>
                    <th className="px-4 py-3 text-left font-medium">Scale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr key={student.id || index} className="border-t border-border">
                      <td className="px-4 py-3">{index + 1}</td>
                      <td className="px-4 py-3">{student.username || "Student"}</td>
                      <td className="px-4 py-3">{student.email || "-"}</td>
                      <td className="px-4 py-3">{competitionInfo.title || "-"}</td>
                      <td className="px-4 py-3">{formatDateOnly(competitionInfo.startDate)}</td>
                      <td className="px-4 py-3">{formatDateOnly(competitionInfo.endDate)}</td>
                      <td className="px-4 py-3">{competitionInfo.location || "-"}</td>
                      <td className="px-4 py-3">{normalizeScale(competitionInfo.scale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
