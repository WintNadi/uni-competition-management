import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Medal,
  Award,
  Heart,
  MessageSquare,
  Star,
  CheckCircle2,
  Target,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached } from "@/lib/api";
import { toast } from "sonner";

const milestoneRules = [
  {
    key: "points-100",
    title: "100 Points Club",
    description: "Earned 100+ points from competitions",
    requirement: 100,
    metric: "points",
    icon: Star,
    color: "bg-achievement text-achievement-foreground",
  },
  {
    key: "competitions-5",
    title: "5 Competitions Completed",
    description: "Successfully participated in 5 competitions",
    requirement: 5,
    metric: "competitions",
    icon: Target,
    color: "bg-secondary text-secondary-foreground",
  },
  {
    key: "first-win",
    title: "First Win",
    description: "Won your first competition",
    requirement: 1,
    metric: "wins",
    icon: Trophy,
    color: "bg-success text-success-foreground",
  },
  {
    key: "top-performer",
    title: "Top Performer of Semester",
    description: "Ranked in top 10 for an entire semester",
    requirement: 4,
    metric: "topPerformerMonths",
    icon: Medal,
    color: "bg-info text-info-foreground",
  },
  {
    key: "points-500",
    title: "500 Points Club",
    description: "Earned 500+ points from competitions",
    requirement: 500,
    metric: "points",
    icon: Star,
    color: "bg-achievement text-achievement-foreground",
  },
  {
    key: "competitions-10",
    title: "10 Competitions Completed",
    description: "Successfully participated in 10 competitions",
    requirement: 10,
    metric: "competitions",
    icon: Target,
    color: "bg-secondary text-secondary-foreground",
  },
  {
    key: "team-champion",
    title: "Team Champion",
    description: "Won 3 team competitions",
    requirement: 3,
    metric: "teamWins",
    icon: Award,
    color: "bg-warning text-warning-foreground",
  },
  {
    key: "points-1000",
    title: "1000 Points Club",
    description: "Earned 1000+ points from competitions",
    requirement: 1000,
    metric: "points",
    icon: Star,
    color: "bg-achievement text-achievement-foreground",
  },
];

const normalize = (value) => String(value || "").trim().toLowerCase();
const toDate = (value) => {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export default function Leaderboard() {
  const [tab, setTab] = useState("merit");
  const [loading, setLoading] = useState(true);
  const [meritRows, setMeritRows] = useState([]);
  const [socialRows, setSocialRows] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [milestonesFromApi, setMilestonesFromApi] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const me = localStorage.getItem("userId");

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadData = ({ force = false } = {}) => {
      setLoading(true);
      Promise.all([
        fetchJsonCached(`${API_BASE_URL}/api/leaderboard/merit`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "student:lb:merit",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/leaderboard/social`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "student:lb:social",
        }),
        fetchJsonCached(`${API_BASE_URL}/api/achievements/me`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "student:achievements",
        }),
        fetchJsonCached(`${API_BASE_URL}/milestones`, {
          token,
          ttlMs: 60000,
          force,
          cacheKey: "student:milestones",
        }),
      ])
        .then(([meritRes, socialRes, achievementsRes, milestonesRes]) => {
          if (!mounted) return;
          setMeritRows(Array.isArray(meritRes) ? meritRes : []);
          setSocialRows(Array.isArray(socialRes) ? socialRes : []);
          setAchievements(Array.isArray(achievementsRes) ? achievementsRes : []);
          setMilestonesFromApi(Array.isArray(milestonesRes) ? milestonesRes : []);
        })
        .catch((error) => toast.error(error?.message || "Failed to load leaderboard."))
        .finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
    };

    loadData({ force: false });
    const refresh = () => loadData({ force: false });
    window.addEventListener("social:updated", refresh);
    window.addEventListener("submissions:updated", refresh);
    window.addEventListener("notifications:updated", refresh);
    window.addEventListener("session:changed", refresh);

    return () => {
      mounted = false;
      window.removeEventListener("social:updated", refresh);
      window.removeEventListener("submissions:updated", refresh);
      window.removeEventListener("notifications:updated", refresh);
      window.removeEventListener("session:changed", refresh);
    };
  }, []);

  const sortedMeritRows = useMemo(
    () =>
      [...meritRows].sort((a, b) => {
        const pointDiff = Number(b.points || 0) - Number(a.points || 0);
        if (pointDiff !== 0) return pointDiff;
        return Number(b.achievements || 0) - Number(a.achievements || 0);
      }),
    [meritRows]
  );

  const sortedSocialRows = useMemo(
    () =>
      [...socialRows].sort((a, b) => {
        const scoreDiff = Number(b.socialScore || 0) - Number(a.socialScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        const likesDiff = Number(b.likes || 0) - Number(a.likes || 0);
        if (likesDiff !== 0) return likesDiff;
        return Number(b.comments || 0) - Number(a.comments || 0);
      }),
    [socialRows]
  );

  const myMerit = sortedMeritRows.find((row) => row.studentId === me);
  const mySocial = sortedSocialRows.find((row) => row.studentId === me);

  const totalPoints = achievements.reduce(
    (sum, item) => sum + Number(item?.score || 0),
    0
  );

  const totalCompetitions = new Set(
    achievements
      .map((item) => item?.competitionId || item?.competitionTitle)
      .filter(Boolean)
  ).size;

  const totalWins = achievements.filter((item) => {
    const result = normalize(item?.resultLabel);
    return result && !result.includes("participant");
  }).length;

  const totalTeamWins = achievements.filter((item) => {
    const result = normalize(item?.resultLabel);
    return item?.teamAchievement === true && result && !result.includes("participant");
  }).length;

  const topPerformerMonths = myMerit?.rank && myMerit.rank <= 10 ? 1 : 0;

  const computedMilestones = useMemo(() => {
    const milestoneMap = new Map(
      milestonesFromApi.map((item) => [normalize(item?.title), item])
    );

    const metricValues = {
      points: totalPoints,
      competitions: totalCompetitions,
      wins: totalWins,
      teamWins: totalTeamWins,
      topPerformerMonths,
    };

    const buildRequirementLabel = (rule) => {
      if (rule.metric === "points") return `${rule.requirement} points`;
      if (rule.metric === "competitions") return `${rule.requirement} competitions`;
      if (rule.metric === "wins") return `${rule.requirement} win`;
      if (rule.metric === "teamWins") return `${rule.requirement} team wins`;
      if (rule.metric === "topPerformerMonths") return `${rule.requirement} months in top 10`;
      return `${rule.requirement}`;
    };

    return milestoneRules.map((rule) => {
      const matched = milestoneMap.get(normalize(rule.title));
      const metricValue = Number(metricValues[rule.metric] || 0);
      const unlocked = !!matched || metricValue >= rule.requirement;
      return {
        ...rule,
        unlocked,
        progress: Math.min(metricValue, rule.requirement),
        currentValue: metricValue,
        requirementLabel: buildRequirementLabel(rule),
        earnedDate: toDate(matched?.achievedAt),
      };
    });
  }, [
    milestonesFromApi,
    totalPoints,
    totalCompetitions,
    totalWins,
    totalTeamWins,
    topPerformerMonths,
  ]);

  const unlockedMilestones = computedMilestones.filter((item) => item.unlocked);
  const progressMilestones = computedMilestones.filter((item) => !item.unlocked);

  const rankBadge = (rank) =>
    cn(
      "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
      rank === 1
        ? "bg-achievement text-achievement-foreground"
        : rank === 2
          ? "bg-slate-300 text-slate-700"
          : rank === 3
            ? "bg-amber-700 text-white"
            : "bg-muted text-muted-foreground"
    );

  return (
    <AppLayout role="student">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Leaderboards & Milestones
          </h1>
          <p className="text-muted-foreground mt-1">
            Track merit points, social engagement, and milestone progress
          </p>
        </div>

        <div className="flex gap-2 border-b border-border">
          {[
            ["merit", "Merit Leaderboard", Trophy],
            ["social", "Social Leaderboard", Heart],
            ["milestones", "Milestones", Star],
          ].map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                tab === value
                  ? "border-secondary text-secondary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 rounded-lg bg-info/5 border border-info/20 text-sm text-muted-foreground space-y-1">
          {tab === "merit" && (
            <>
              {!showDetails ? (
                <>
                  <p>
                    <strong>Merit points</strong> are the sum of points from your verified achievements in internal and
                    approved external competitions.
                  </p>
                  <p className="mt-2">
                    <em>Summary:</em> Top placements, competition difficulty, and team wins influence merit points.
                    <button
                      onClick={() => setShowDetails(true)}
                      className="ml-3 text-sm text-secondary underline"
                    >
                      View details
                    </button>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowDetails(false)}
                      className="text-sm text-muted-foreground underline"
                    >
                      Hide details
                    </button>
                  </div>

                  <p>
                    <strong>Merit points</strong> are the sum of points from your verified achievements in internal and
                    approved external competitions.
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      <strong>Higher results earn more</strong>: Top positions receive larger point awards than participation.
                    </li>
                    <li>
                      <strong>Competition difficulty</strong> (quiz, assignment, project) and team wins can affect points.
                    </li>
                    <li>
                      <strong>Merit milestones</strong> (Bronze / Silver / Gold / Platinum Merit) unlock automatically as
                      your total points cross set thresholds.
                    </li>
                  </ul>

                  <h3 className="mt-3 font-semibold">How merit points are awarded</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    The system maps competition results to merit points according to the result label. Typical mappings
                    used across the platform are (example):
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li><strong>Top 1 / 1st Place:</strong> 100 points</li>
                    <li><strong>Top 2 / 2nd Place:</strong> 60 points</li>
                    <li><strong>Top 3 / 3rd Place:</strong> 40 points</li>
                    <li><strong>Runner-up / Top N:</strong> 20 points</li>
                    <li><strong>Participation:</strong> 5 points</li>
                  </ul>

                  <h4 className="mt-3 font-medium">Internal competitions (evaluated score)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    For internal competitions organizers usually provide an evaluated numeric score (for example, 0–100).
                    The platform uses either the resulting placement (Top 1/2/3/Participation) to award the base points
                    above, and may also include any organizer‑assigned "score" as additional merit points where configured
                    by the competition owner. In short:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Placement (1st/2nd/3rd/Participation) maps to the base point values above.</li>
                    <li>If the competition provides an evaluated score, that score can be added as bonus points or used to
                    break ties depending on the competition settings (see competition details).</li>
                  </ul>

                  <h4 className="mt-3 font-medium">External competitions (student submissions)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    For external participations the admin verifies and records a result label when approving the
                    submission (e.g. "1st Place", "Runner-up", "Participation"). The platform maps that label to the
                    same base point values above once the participation is approved by an admin.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If you have questions about a specific competition's scoring (bonus points, difficulty multipliers,
                    or organizer‑provided evaluation), check the competition details page or contact your admin.
                  </p>
                </>
              )}
            </>
          )}
          {tab === "social" && (
            <>
              <p>
                <strong>Social score</strong> measures how visible and appreciated your achievements are on the social
                feed. It does <strong>not</strong> affect academic merit.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Each achievement post you appear in: <strong>+10</strong> social points.
                </li>
                <li>
                  Each like on those posts: <strong>+1</strong> social point.
                </li>
                <li>
                  Each comment on those posts: <strong>+2</strong> social points.
                </li>
              </ul>
            </>
          )}
          {tab === "milestones" && (
            <p>
              <strong>Milestones</strong> summarize your long‑term progress using the same merit points and competition
              history shown in the other tabs.
            </p>
          )}
        </div>

        {loading && (
          <div className="card-static p-10 text-center text-muted-foreground">
            Loading...
          </div>
        )}

        {!loading && tab === "merit" && (
          <div className="space-y-4">
            {myMerit && (
              <div className="card-static p-4 bg-secondary/5 border-secondary/20">
                Your Merit Rank: <strong>#{myMerit.rank}</strong> | {myMerit.points} points | {myMerit.competitions} competitions
              </div>
            )}
            <div className="card-static overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase">Student</th>
                    <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase">Points</th>
                    <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase hidden md:table-cell">
                      Achievements
                    </th><th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase hidden md:table-cell">
                      Participations
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedMeritRows.map((row) => (
                    <tr
                      key={row.studentId || `${row.rank}-${row.name}`}
                      className={cn("hover:bg-muted/30", row.studentId === me && "bg-secondary/5")}
                    >
                      <td className="px-4 py-4">
                        <div className={rankBadge(row.rank)}>{row.rank}</div>
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {row.name}
                        {row.studentId === me ? " (You)" : ""}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">{row.points}</td>
                      <td className="px-4 py-4 text-right hidden md:table-cell">{row.achievements}</td>
                      <td className="px-4 py-4 text-right hidden md:table-cell">
                        {row.participations ?? 0}
                      </td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && tab === "social" && (
          <div className="space-y-4">
            {mySocial && (
              <div className="card-static p-4 bg-secondary/5 border-secondary/20">
                Your Social Rank: <strong>#{mySocial.rank}</strong> | {mySocial.socialScore} score | {mySocial.likes} likes
              </div>
            )}
            <div className="card-static overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase">Student</th>
                    <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase">Score</th>
                    <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase hidden md:table-cell">Likes</th>
                    <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase hidden md:table-cell">Comments</th>
                    <th className="px-4 py-3 text-right text-xs text-muted-foreground uppercase hidden md:table-cell">Posts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedSocialRows.map((row) => (
                    <tr
                      key={row.studentId || `${row.rank}-${row.name}`}
                      className={cn("hover:bg-muted/30", row.studentId === me && "bg-secondary/5")}
                    >
                      <td className="px-4 py-4">
                        <div className={rankBadge(row.rank)}>{row.rank}</div>
                      </td>
                      <td className="px-4 py-4 font-medium">
                        {row.name}
                        {row.studentId === me ? " (You)" : ""}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">{row.socialScore}</td>
                      <td className="px-4 py-4 text-right hidden md:table-cell">
                        <Heart className="w-3 h-3 inline mr-1" />
                        {row.likes}
                      </td>
                      <td className="px-4 py-4 text-right hidden md:table-cell">
                        <MessageSquare className="w-3 h-3 inline mr-1" />
                        {row.comments}
                      </td>
                      <td className="px-4 py-4 text-right hidden md:table-cell">
                        {row.posts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && tab === "milestones" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="card-static p-4 text-center">
                <p className="text-2xl font-bold">{unlockedMilestones.length}</p>
                <p className="text-sm text-muted-foreground">Unlocked</p>
              </div>
              <div className="card-static p-4 text-center">
                <p className="text-2xl font-bold">{progressMilestones.length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
              <div className="card-static p-4 text-center">
                <p className="text-2xl font-bold text-secondary">{totalPoints}</p>
                <p className="text-sm text-muted-foreground">Total Points</p>
              </div>
              <div className="card-static p-4 text-center">
                <p className="text-2xl font-bold text-achievement">{totalCompetitions}</p>
                <p className="text-sm text-muted-foreground">Competitions</p>
              </div>
            </div>

            <section>
              <h2 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Unlocked Milestones
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {unlockedMilestones.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="card-static p-4 border-l-4 border-success flex gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", item.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                        <p className="text-xs text-success mt-1">
                          {item.earnedDate ? `Earned on ${item.earnedDate}` : "Completed"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-warning" />
                In Progress
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {progressMilestones.map((item) => {
                  const percent = Math.min((item.progress / item.requirement) * 100, 100);
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="card-static p-4 border-l-4 border-warning/50 flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          {item.currentValue} / {item.requirement} ({item.requirementLabel})
                        </p>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-warning" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
