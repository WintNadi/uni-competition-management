import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Trophy, FileText } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";

export default function QuestionCompetitions() {
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  useEffect(() => {
    const controller = new AbortController();

    async function load(force = false) {
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/api/competitions`, {
          token,
          force,
          ttlMs: 120000,
          cacheKey: "teacher:question:competitions",
          signal: controller.signal,
        });

        const mapped = (data || [])
          .map((c) => ({
            id: c.competitionId || c.id,
            title: c.title || c.name || "Untitled",
            format: String(c.format || c.type || "").toLowerCase(),
            questionCount:
              c.questionCount ??
              (Array.isArray(c.questions) ? c.questions.length : 0),
          }))
          .filter((c) => c.id && c.format === "quiz");

        const withCounts = await Promise.all(
          mapped.map(async (comp) => {
            try {
              const qdata = await fetchJsonCached(
                `${API_BASE_URL}/api/teacher/competitions/${comp.id}/questions`,
                {
                  token,
                  force,
                  ttlMs: 60000,
                  cacheKey: `teacher:questions:${comp.id}`,
                  signal: controller.signal,
                },
              );
              const cnt = Array.isArray(qdata)
                ? qdata.length
                : qdata?.questions
                  ? qdata.questions.length
                  : comp.questionCount || 0;
              return { ...comp, questionCount: cnt };
            } catch (err) {
              if (err?.name === "AbortError") {
                return comp;
              }
              return comp;
            }
          }),
        );
        if (!controller.signal.aborted) {
          setCompetitions(withCounts);
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        setCompetitions([]);
        toast.error(e?.message || "Unable to load quiz competitions");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load(false);
    const handleCompetitionUpdate = () => load(false);
    window.addEventListener("competitions:updated", handleCompetitionUpdate);
    return () => {
      controller.abort();
      window.removeEventListener("competitions:updated", handleCompetitionUpdate);
    };
  }, [token]);

  if (loading) {
    return (
      <AppLayout role="teacher">
        <div className="max-w-7xl mx-auto p-6">Loading competitions...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Quiz Competitions</h2>
            <p className="text-muted-foreground">
              Manage questions for quiz-style competitions
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {competitions.length === 0 && (
            <div className="card-static p-6 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No quiz competitions found
              </p>
            </div>
          )}

          {competitions.map((c) => (
            <div
              key={c.id}
              className="card-static p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-secondary" />
                  <div>
                    <div className="font-medium text-foreground">{c.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {c.questionCount ?? 0} question
                      {(c.questionCount ?? 0) !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <Button
                  onClick={() =>
                    navigate(`/teacher/competitions/${c.id}/questions`, {
                      state: { competitionName: c.title },
                    })
                  }
                >
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
