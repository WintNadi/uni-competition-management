import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Users,
  Crown,
  Shield,
  Trophy,
  ChevronRight,
  Mail,
  Check,
  AlertCircle,
  Search,
  UserPlus,
  UserMinus,
  Phone,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache } from "@/lib/api";
import { toast } from "sonner";

const readErrorMessage = async (res) => {
  try {
    const data = await res.json();
    return data?.message || data?.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveCompetitionId = (competition) => competition?.competitionId || competition?.id;

const resolveRegistrationWindow = (competition) => {
  const now = new Date();
  const openAt = parseDate(competition?.registrationOpen || competition?.registration_open);
  const closeAt = parseDate(
    competition?.registrationClose
      || competition?.registration_close
      || competition?.registrationDeadline
      || competition?.registration_deadline
  );

  const isOpenByStart = !openAt || now >= openAt;
  const isBeforeClose = !closeAt || now <= closeAt;
  const isOpen = isOpenByStart && isBeforeClose;
  const isClosed = !!closeAt && now > closeAt;

  return {
    isOpen,
    isClosed,
    closeAt,
  };
};

const toMemberRow = (id, username, leaderId) => ({
  id,
  username: username || id,
  avatar: (username || id || "U").charAt(0).toUpperCase(),
  leader: id === leaderId,
});

const mapTeam = (rawTeam, competitionMap, currentUserId) => {
  const competition = competitionMap.get(rawTeam.competitionId);
  const windowState = resolveRegistrationWindow(competition);

  const invitedIds = Array.isArray(rawTeam.memberIds) ? rawTeam.memberIds.filter(Boolean) : [];
  const invitedNames = Array.isArray(rawTeam.memberUsernames) ? rawTeam.memberUsernames : [];
  const acceptedIds = Array.isArray(rawTeam.acceptedMemberIds)
    ? rawTeam.acceptedMemberIds.filter(Boolean)
    : [];
  const acceptedNames = Array.isArray(rawTeam.acceptedMemberUsernames) ? rawTeam.acceptedMemberUsernames : [];
  const pendingIds = Array.isArray(rawTeam.pendingJoinRequestIds)
    ? rawTeam.pendingJoinRequestIds.filter(Boolean)
    : [];
  const pendingNames = Array.isArray(rawTeam.pendingJoinRequestUsernames)
    ? rawTeam.pendingJoinRequestUsernames
    : [];

  const acceptedNameMap = new Map(acceptedIds.map((id, idx) => [id, acceptedNames[idx] || id]));
  const invitedNameMap = new Map(invitedIds.map((id, idx) => [id, invitedNames[idx] || id]));
  const pendingNameMap = new Map(pendingIds.map((id, idx) => [id, pendingNames[idx] || id]));

  const leaderName = rawTeam.leaderUsername || acceptedNameMap.get(rawTeam.leaderId) || rawTeam.leaderId;

  const memberIds = [...new Set(acceptedIds)];
  const minSize = competition?.minTeamSize;
  const maxSize = competition?.maxTeamSize;
  const openSpots = typeof maxSize === "number" ? Math.max(maxSize - memberIds.length, 0) : null;

  return {
    id: rawTeam.teamId,
    name: rawTeam.teamName,
    competitionId: rawTeam.competitionId,
    competitionTitle: competition?.title || rawTeam.competitionId,
    leaderId: rawTeam.leaderId,
    leaderName,
    isLeader: !!currentUserId && rawTeam.leaderId === currentUserId,
    status: (rawTeam.status || "").toUpperCase(),
    invitedIds,
    invitedNameMap,
    memberIds,
    members: memberIds.map((memberId) =>
      toMemberRow(memberId, acceptedNameMap.get(memberId), rawTeam.leaderId)
    ),
    pendingJoinRequestIds: pendingIds,
    pendingJoinRequestNameMap: pendingNameMap,
    minSize,
    maxSize,
    openSpots,
    canManageMembers: windowState.isOpen,
    registrationClosed: windowState.isClosed,
  };
};

const buildInvitations = (mappedTeams, currentUserId) => {
  if (!currentUserId) return [];

  const invitationMap = new Map();

  mappedTeams.forEach((team) => {
    const isInvited = team.invitedIds.includes(currentUserId);
    const alreadyAccepted = team.memberIds.includes(currentUserId);
    const isLeader = team.leaderId === currentUserId;

    if (!isInvited || alreadyAccepted || isLeader) {
      return;
    }

    if (!invitationMap.has(team.id)) {
      invitationMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        leaderId: team.leaderId,
        leaderName: team.leaderName,
        competitionId: team.competitionId,
        competitionTitle: team.competitionTitle,
        canAccept: team.canManageMembers,
      });
    }
  });

  return Array.from(invitationMap.values());
};

const buildRequests = (allTeams, myTeams, currentUserId) => {
  if (!currentUserId) {
    return { incoming: [], outgoing: [] };
  }

  const incoming = [];
  myTeams
    .filter((team) => team.isLeader)
    .forEach((team) => {
      team.pendingJoinRequestIds.forEach((requesterId) => {
        incoming.push({
          teamId: team.id,
          teamName: team.name,
          competitionId: team.competitionId,
          competitionTitle: team.competitionTitle,
          requesterId,
          requesterName: team.pendingJoinRequestNameMap.get(requesterId) || requesterId,
          canReview: team.canManageMembers,
        });
      });
    });

  const outgoingMap = new Map();
  allTeams.forEach((team) => {
    const hasRequested = team.pendingJoinRequestIds.includes(currentUserId);
    const alreadyMember = team.memberIds.includes(currentUserId);
    const isLeader = team.leaderId === currentUserId;
    if (!hasRequested || alreadyMember || isLeader) {
      return;
    }
    if (!outgoingMap.has(team.id)) {
      outgoingMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        leaderName: team.leaderName,
        competitionId: team.competitionId,
        competitionTitle: team.competitionTitle,
        canReview: team.canManageMembers,
      });
    }
  });

  return {
    incoming,
    outgoing: Array.from(outgoingMap.values()),
  };
};

export default function Teams() {
  const location = useLocation();

  const userRole = (localStorage.getItem("userRole") || "student").toLowerCase();
  const [activeTab, setActiveTab] = useState("my-teams");
  const [currentUserId, setCurrentUserId] = useState(localStorage.getItem("userId") || "");
  const [teams, setTeams] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionBusyKey, setActionBusyKey] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteCandidates, setInviteCandidates] = useState([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const hasLoadedDataRef = useRef(false);
  const skipOwnRefreshEventsRef = useRef(0);
  const isLoadingDataRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const pendingReloadForceRef = useRef(false);

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.id) === String(selectedTeamId)) || null,
    [teams, selectedTeamId]
  );

  const selectedTeamMemberIds = useMemo(() => {
    if (!selectedTeam) return [];
    const ids = new Set([
      selectedTeam.leaderId,
      ...selectedTeam.memberIds,
      ...selectedTeam.invitedIds,
      ...selectedTeam.pendingJoinRequestIds,
    ]);
    return Array.from(ids);
  }, [selectedTeam]);

  const applyNavigationState = () => {
    const tab = location.state?.tab;
    if (tab === "my-teams" || tab === "invitations" || tab === "requests") {
      setActiveTab(tab);
    }

    const navTeamId = location.state?.selectedTeamId;
    if (navTeamId != null) {
      setSelectedTeamId(String(navTeamId));
    }
  };

  const emitRefreshEvents = (...eventNames) => {
    if (!eventNames.length) return;
    skipOwnRefreshEventsRef.current += eventNames.length;
    eventNames.forEach((eventName) => {
      window.dispatchEvent(new CustomEvent(eventName));
    });
  };

  const invalidateTeamCaches = ({ teamId, competitionId } = {}) => {
    invalidateApiCache((key) => {
      const value = String(key);

      if (value.includes("teams:my")) return true;
      if (teamId && value.includes(`teams:members:${teamId}`)) return true;
      if (competitionId && value.includes(`teams:competition:${competitionId}`)) return true;

      if (value.includes("registrations:me")) return true;
      if (value.includes("submissions:me")) return true;
      if (value.includes("competitions:list")) return true;

      if (value.includes("/competitions/registrations/me")) return true;
      if (value.includes("/submissions")) return true;
      if (value.includes("/competitions")) return true;

      return false;
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
      setTeams([]);
      setInvitations([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoadError("Please log in to view teams.");
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
      const cachedUserId = localStorage.getItem("userId") || currentUserId;
      if (cachedUserId) {
        setCurrentUserId(cachedUserId);
      }
      const [profile, competitions, myTeamsRaw] = await Promise.all([
        cachedUserId
          ? Promise.resolve(null)
          : fetchJsonCached(`${API_BASE_URL}/api/users/me`, {
              token,
              ttlMs: 300000,
              force,
              cacheKey: "users:me",
            }).catch(() => null),
        fetchJsonCached(`${API_BASE_URL}/competitions`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "competitions:list",
        }),
        fetchJsonCached(`${API_BASE_URL}/teams/my`, {
          token,
          ttlMs: 300000,
          force,
          cacheKey: "teams:my",
        }),
      ]);

      let resolvedUserId = localStorage.getItem("userId") || currentUserId;
      if (profile?.id) {
        resolvedUserId = profile.id;
        localStorage.setItem("userId", profile.id);
        setCurrentUserId(profile.id);
      }

      const competitionList = Array.isArray(competitions) ? competitions : [];
      const competitionMap = new Map(
        competitionList.map((competition) => [resolveCompetitionId(competition), competition])
      );

      const teamCompetitions = competitionList.filter(
        (competition) =>
          (competition?.competitionType || "").toUpperCase() === "INTERNAL"
          && (competition?.participationType || "").toUpperCase() === "TEAM"
      );

      const teamResponses = await Promise.all(
        teamCompetitions.map(async (competition) => {
          const competitionId = resolveCompetitionId(competition);
          try {
            const data = await fetchJsonCached(`${API_BASE_URL}/teams?competitionId=${competitionId}`, {
              token,
              ttlMs: 300000,
              force,
              cacheKey: `teams:competition:${competitionId}`,
            });
            return Array.isArray(data) ? data : [];
          } catch {
            return [];
          }
        })
      );

      const allTeamsRaw = teamResponses.flat();
      const dedupedAllTeamsRaw = Array.from(
        new Map(allTeamsRaw.map((team) => [team.teamId, team])).values()
      );

      const mappedAllTeams = dedupedAllTeamsRaw.map((team) =>
        mapTeam(team, competitionMap, resolvedUserId)
      );
      const mappedMyTeams = (Array.isArray(myTeamsRaw) ? myTeamsRaw : []).map((team) =>
        mapTeam(team, competitionMap, resolvedUserId)
      );

      setTeams(mappedMyTeams);
      setInvitations(buildInvitations(mappedAllTeams, resolvedUserId));
      const requests = buildRequests(mappedAllTeams, mappedMyTeams, resolvedUserId);
      setIncomingRequests(requests.incoming);
      setOutgoingRequests(requests.outgoing);

      setSelectedTeamId((prev) => {
        if (prev && mappedMyTeams.some((team) => String(team.id) === String(prev))) {
          return prev;
        }
        return mappedMyTeams[0]?.id || null;
      });
    } catch (error) {
      setTeams([]);
      setInvitations([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoadError(error?.message || "Failed to load teams.");
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
    applyNavigationState();
  }, [location.state]);

  useEffect(() => {
    if (userRole !== "student") {
      setLoading(false);
      setLoadError("Teams are available for student role only.");
      return;
    }

    loadData({ force: false });
    const handleTeamRefresh = () => {
      if (skipOwnRefreshEventsRef.current > 0) {
        skipOwnRefreshEventsRef.current -= 1;
        return;
      }
      loadData({ force: false });
    };
    window.addEventListener("notifications:updated", handleTeamRefresh);
    window.addEventListener("competitions:updated", handleTeamRefresh);
    window.addEventListener("teams:updated", handleTeamRefresh);
    window.addEventListener("session:changed", handleTeamRefresh);
    return () => {
      window.removeEventListener("notifications:updated", handleTeamRefresh);
      window.removeEventListener("competitions:updated", handleTeamRefresh);
      window.removeEventListener("teams:updated", handleTeamRefresh);
      window.removeEventListener("session:changed", handleTeamRefresh);
    };
  }, [userRole]);

  useEffect(() => {
    const loadSelectedTeamMembers = async () => {
      if (!selectedTeamId) {
        setSelectedTeamMembers([]);
        return;
      }
      const token = localStorage.getItem("userToken");
      if (!token) {
        setSelectedTeamMembers([]);
        return;
      }

      setSelectedTeamMembers([]);
      const shouldShowMembersLoading = !selectedTeam || (selectedTeam.members?.length || 0) === 0;
      if (shouldShowMembersLoading) {
        setMembersLoading(true);
      } else {
        setMembersLoading(false);
      }
      try {
        const data = await fetchJsonCached(`${API_BASE_URL}/teams/${selectedTeamId}/members`, {
          token,
          ttlMs: 300000,
          force: false,
          cacheKey: `teams:members:${selectedTeamId}`,
        });
        setSelectedTeamMembers(Array.isArray(data) ? data : []);
      } catch {
        setSelectedTeamMembers([]);
      } finally {
        setMembersLoading(false);
      }
    };

    loadSelectedTeamMembers();
  }, [
    selectedTeamId,
    selectedTeam?.memberIds.join(","),
    selectedTeam?.invitedIds.join(","),
    selectedTeam?.pendingJoinRequestIds.join(","),
  ]);

  useEffect(() => {
    if (!selectedTeam || !selectedTeam.isLeader) {
      setInviteCandidates([]);
      setInviteSearchLoading(false);
      return undefined;
    }

    const query = inviteQuery.trim();
    if (!query) {
      setInviteCandidates([]);
      setInviteSearchLoading(false);
      return undefined;
    }

    const token = localStorage.getItem("userToken");
    if (!token) {
      setInviteCandidates([]);
      return undefined;
    }

    const controller = new AbortController();
    const searchStudentsForInvite = async () => {
      setInviteSearchLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/users/students?query=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error(await readErrorMessage(res));
        }
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];
        const normalized = list
          .map((user) => ({
            id: user.id,
            username: user.username || user.email || user.id,
            email: user.email || "",
          }))
          .filter((candidate) => !selectedTeamMemberIds.includes(candidate.id))
          .slice(0, 30);
        setInviteCandidates(normalized);
      } catch (error) {
        if (error.name !== "AbortError") {
          setInviteCandidates([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setInviteSearchLoading(false);
        }
      }
    };

    searchStudentsForInvite();
    return () => controller.abort();
  }, [inviteQuery, selectedTeam, selectedTeamMemberIds.join(",")]);

  const handleAcceptInvitation = async (teamId) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please log in first.");
      return;
    }

    const busyKey = `accept-invite-${teamId}`;
    setActionBusyKey(busyKey);
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/accept-invitation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const updatedTeam = await res.json().catch(() => null);

      toast.success("Invitation accepted.");
      invalidateTeamCaches({ teamId, competitionId: updatedTeam?.competitionId });
      void loadData({ force: false });
      emitRefreshEvents("teams:updated", "competitions:updated");
      setActiveTab("my-teams");
    } catch (error) {
      toast.error(error?.message || "Failed to accept invitation.");
    } finally {
      setActionBusyKey("");
    }
  };

  const handleDeclineInvitation = async (teamId) => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      toast.error("Please log in first.");
      return;
    }

    const busyKey = `decline-invite-${teamId}`;
    setActionBusyKey(busyKey);
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/decline-invitation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const updatedTeam = await res.json().catch(() => null);

      toast.success("Invitation declined.");
      invalidateTeamCaches({ teamId, competitionId: updatedTeam?.competitionId });
      void loadData({ force: false });
      emitRefreshEvents("teams:updated", "competitions:updated");
    } catch (error) {
      toast.error(error?.message || "Failed to decline invitation.");
    } finally {
      setActionBusyKey("");
    }
  };

  const handleAcceptJoinRequest = async (teamId, requesterId) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    const busyKey = `accept-request-${teamId}-${requesterId}`;
    setActionBusyKey(busyKey);
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/requests/${requesterId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const updatedTeam = await res.json().catch(() => null);
      toast.success("Join request accepted.");
      invalidateTeamCaches({ teamId, competitionId: updatedTeam?.competitionId });
      void loadData({ force: false });
      emitRefreshEvents("teams:updated", "competitions:updated");
    } catch (error) {
      toast.error(error?.message || "Failed to accept request.");
    } finally {
      setActionBusyKey("");
    }
  };

  const handleRejectJoinRequest = async (teamId, requesterId) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    const busyKey = `reject-request-${teamId}-${requesterId}`;
    setActionBusyKey(busyKey);
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/requests/${requesterId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const updatedTeam = await res.json().catch(() => null);
      toast.success("Join request rejected.");
      invalidateTeamCaches({ teamId, competitionId: updatedTeam?.competitionId });
      void loadData({ force: false });
      emitRefreshEvents("teams:updated", "competitions:updated");
    } catch (error) {
      toast.error(error?.message || "Failed to reject request.");
    } finally {
      setActionBusyKey("");
    }
  };

  const handleInviteMember = async (teamId, studentId) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    const busyKey = `invite-${teamId}-${studentId}`;
    setActionBusyKey(busyKey);
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const updatedTeam = await res.json().catch(() => null);
      toast.success("Invitation sent.");
      setInviteQuery("");
      invalidateTeamCaches({ teamId, competitionId: updatedTeam?.competitionId });
      void loadData({ force: false });
      emitRefreshEvents("teams:updated", "competitions:updated");
    } catch (error) {
      toast.error(error?.message || "Failed to send invitation.");
    } finally {
      setActionBusyKey("");
    }
  };

  const handleRemoveMember = async (teamId, memberId) => {
    const token = localStorage.getItem("userToken");
    if (!token) return;

    const busyKey = `remove-${teamId}-${memberId}`;
    setActionBusyKey(busyKey);
    try {
      const res = await fetch(`${API_BASE_URL}/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const updatedTeam = await res.json().catch(() => null);
      toast.success("Member removed.");
      invalidateTeamCaches({ teamId, competitionId: updatedTeam?.competitionId });
      setSelectedTeamMembers((prev) => prev.filter((member) => String(member.id) !== String(memberId)));
      void loadData({ force: false });
      emitRefreshEvents("teams:updated", "competitions:updated");
    } catch (error) {
      toast.error(error?.message || "Failed to remove member.");
    } finally {
      setActionBusyKey("");
    }
  };

  const handleCancelPendingInvite = async (teamId, studentId) => {
  const token = localStorage.getItem("userToken");
  if (!token) return;

  const busyKey = `cancel-invite-${teamId}-${studentId}`;
  setActionBusyKey(busyKey);

  try {
    // Existing backend endpoint (already in your controller):
    // DELETE /teams/{teamId}/invites/{studentId}
    const res = await fetch(`${API_BASE_URL}/teams/${teamId}/invites/${studentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
    const updatedTeam = await res.json().catch(() => null);

    toast.success("Invitation canceled.");
    invalidateTeamCaches({ teamId, competitionId: updatedTeam?.competitionId });
    void loadData({ force: false });
    emitRefreshEvents("teams:updated", "competitions:updated");
  } catch (error) {
    toast.error(error?.message || "Failed to cancel invitation.");
  } finally {
    setActionBusyKey("");
  }
};

  if (userRole !== "student") {
    return (
      <AppLayout role={userRole}>
        <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-foreground">Teams</h1>
          <div className="card-static p-6 text-center text-muted-foreground">
            Teams are available for student role only.
          </div>
        </div>
      </AppLayout>
    );
  }

  const memberProfiles = selectedTeamMembers.length > 0
    ? selectedTeamMembers.map((member) => ({
      id: member.id,
      username: member.username || member.id,
      email: member.email || "",
      phone: member.phone || "",
      avatar: (member.username || member.id || "U").charAt(0).toUpperCase(),
      leader: !!member.leader,
    }))
    : selectedTeam?.members.map((member) => ({
      id: member.id,
      username: member.username || member.id,
      email: "",
      phone: "",
      avatar: member.avatar,
      leader: member.leader,
    })) || [];

  return (
    <AppLayout role="student">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">My Teams</h1>
          <p className="text-muted-foreground mt-1">Manage your team memberships, invites, and join requests.</p>
        </div>

        <div className="bg-info/10 border border-info/20 rounded-lg p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Team Management</p>
            <p className="text-sm text-muted-foreground">
              Team creation and team-join requests start from the{" "}
              <Link to="/competitions" className="text-secondary hover:underline">Competition page</Link>.
              Leaders can invite/remove members here while registration is open.
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab("my-teams")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === "my-teams"
                ? "border-secondary text-secondary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            My Teams ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab("invitations")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === "invitations"
                ? "border-secondary text-secondary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Invitations ({invitations.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === "requests"
                ? "border-secondary text-secondary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Requests ({incomingRequests.length + outgoingRequests.length})
          </button>
        </div>

        {loading && (
          <div className="card-static p-6 text-center text-muted-foreground">Loading teams...</div>
        )}

        {!loading && loadError && (
          <div className="card-static p-6 text-center space-y-3">
            <p className="text-destructive">{loadError}</p>
            <Button variant="outline" className="gap-2" onClick={() => loadData({ force: false })}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !loadError && activeTab === "my-teams" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {teams.length === 0 && (
                <div className="card-static p-6 text-center text-muted-foreground">
                  You are not in any team yet.
                </div>
              )}
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    "w-full text-left card-static p-4 transition-all",
                    selectedTeam?.id === team.id ? "ring-2 ring-secondary" : "hover:shadow-card-hover"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-secondary" />
                      {team.isLeader && <Crown className="w-4 h-4 text-achievement" />}
                    </div>
                    <span className={cn(
                      "badge-status text-xs",
                      team.status === "ACTIVE"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    )}>
                      {team.status || "UNKNOWN"}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{team.name}</p>
                  <p className="text-sm text-muted-foreground">{team.competitionTitle}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {team.maxSize == null
                      ? `${team.members.length} members`
                      : `${team.members.length}/${team.maxSize} members`}
                  </p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2">
              {!selectedTeam ? (
                <div className="card-static p-8 text-center text-muted-foreground">Select a team to view details.</div>
              ) : (
                <div className="card-static p-6 space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-display font-semibold text-xl text-foreground">{selectedTeam.name}</h2>
                        {selectedTeam.isLeader && (
                          <span className="badge-status bg-achievement/10 text-achievement text-xs">Leader</span>
                        )}
                      </div>
                      <Link
                        to={`/competitions/${selectedTeam.competitionId}`}
                        className="text-sm text-muted-foreground hover:text-secondary transition-colors inline-flex items-center gap-1"
                      >
                        <Trophy className="w-4 h-4" />
                        {selectedTeam.competitionTitle}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <Button variant="outline" onClick={() => setActiveTab("requests")}>View Requests</Button>
                  </div>

                  {selectedTeam.status === "PENDING" && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                      <p className="text-sm text-warning">
                        Team is pending activation.
                        {typeof selectedTeam.minSize === "number" && ` Minimum size: ${selectedTeam.minSize}.`}
                      </p>
                    </div>
                  )}

                  {!selectedTeam.canManageMembers && (
                    <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
                      Registration window is closed. You cannot invite, remove, or accept team requests now.
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-foreground">Leader</h3>
                    <div className="p-3 rounded-lg bg-muted/30 text-sm text-foreground break-all">
                      {selectedTeam.leaderName}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm text-foreground">
                      Members
                      {selectedTeam.maxSize == null
                        ? ` (${memberProfiles.length})`
                        : ` (${memberProfiles.length}/${selectedTeam.maxSize})`}
                    </h3>
                    {membersLoading && (
                      <div className="text-xs text-muted-foreground">Loading team member profiles...</div>
                    )}
                    <div className="space-y-2">
                      {memberProfiles.map((member) => (
                        <div key={member.id} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center font-medium text-sm">
                              {member.avatar}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{member.username}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email || "No email"}</p>
                              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {member.phone || "No phone number"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.leader && (
                              <span className="badge-status bg-achievement/10 text-achievement text-xs">Leader</span>
                            )}
                            {selectedTeam.isLeader && !member.leader && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={
                                  actionBusyKey === `remove-${selectedTeam.id}-${member.id}`
                                  || !selectedTeam.canManageMembers
                                }
                                onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                              >
                                <UserMinus className="w-3 h-3" />
                                {actionBusyKey === `remove-${selectedTeam.id}-${member.id}` ? "Removing..." : "Remove"}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTeam.invitedIds.length > 0 && (
  <div className="space-y-2">
    <h3 className="font-semibold text-sm text-foreground">Pending Invites</h3>
    <div className="space-y-2">
      {selectedTeam.invitedIds
        .filter((id) => !selectedTeam.memberIds.includes(id))
        .map((inviteeId) => (
          <div
            key={inviteeId}
            className="p-3 rounded-lg bg-warning/5 border border-warning/20 text-sm text-warning flex items-center justify-between gap-3"
          >
            <span className="break-all">
              {selectedTeam.invitedNameMap.get(inviteeId) || inviteeId}
            </span>

            {selectedTeam.isLeader && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={actionBusyKey === `cancel-invite-${selectedTeam.id}-${inviteeId}`}
                onClick={() => handleCancelPendingInvite(selectedTeam.id, inviteeId)}
              >
                <X className="w-3 h-3" />
                {actionBusyKey === `cancel-invite-${selectedTeam.id}-${inviteeId}`
                  ? "Canceling..."
                  : "Cancel"}
              </Button>
            )}
          </div>
        ))}
    </div>
  </div>
)}

                  {selectedTeam.isLeader && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-foreground">Invite Members</h3>
                      {selectedTeam.openSpots === 0 && (
                        <div className="text-xs text-warning">Team is full. You cannot invite more members.</div>
                      )}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={inviteQuery}
                          onChange={(event) => setInviteQuery(event.target.value)}
                          placeholder="Search student by username or email..."
                          disabled={!selectedTeam.canManageMembers || selectedTeam.openSpots === 0}
                          className="w-full h-10 pl-10 pr-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        />
                      </div>
                      {inviteSearchLoading && (
                        <div className="text-xs text-muted-foreground">Searching students...</div>
                      )}
                      {!inviteSearchLoading && inviteQuery.trim() && inviteCandidates.length === 0 && (
                        <div className="text-xs text-muted-foreground">No available students found.</div>
                      )}
                      {!inviteSearchLoading && inviteCandidates.length > 0 && (
                        <div className="border border-border rounded-lg divide-y divide-border max-h-52 overflow-y-auto">
                          {inviteCandidates.map((candidate) => (
                            <div
                              key={candidate.id}
                              className="p-3 flex items-center justify-between gap-3 bg-card"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{candidate.username}</p>
                                <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>
                              </div>
                              <Button
                                size="sm"
                                className="gap-1"
                                disabled={
                                  actionBusyKey === `invite-${selectedTeam.id}-${candidate.id}`
                                  || !selectedTeam.canManageMembers
                                  || selectedTeam.openSpots === 0
                                }
                                onClick={() => handleInviteMember(selectedTeam.id, candidate.id)}
                              >
                                <UserPlus className="w-3 h-3" />
                                {actionBusyKey === `invite-${selectedTeam.id}-${candidate.id}` ? "Inviting..." : "Invite"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !loadError && activeTab === "invitations" && (
          <div className="space-y-4">
            {invitations.length === 0 ? (
              <div className="card-static p-10 text-center">
                <Mail className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No pending invitations.</p>
              </div>
            ) : (
              invitations.map((invitation) => (
                <div key={invitation.teamId} className="card-static p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{invitation.teamName}</p>
                    <Link
                      to={`/competitions/${invitation.competitionId}`}
                      className="text-sm text-muted-foreground hover:text-secondary transition-colors"
                    >
                      {invitation.competitionTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1 break-all">Leader: {invitation.leaderName}</p>
                    {!invitation.canAccept && (
                      <p className="text-xs text-warning mt-1">Registration window is closed for accepting invitations.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="gap-2"
                      disabled={
                        actionBusyKey === `accept-invite-${invitation.teamId}`
                        || actionBusyKey === `decline-invite-${invitation.teamId}`
                        || !invitation.canAccept
                      }
                      onClick={() => handleAcceptInvitation(invitation.teamId)}
                    >
                      <Check className="w-4 h-4" />
                      {actionBusyKey === `accept-invite-${invitation.teamId}` ? "Accepting..." : "Accept"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={
                        actionBusyKey === `decline-invite-${invitation.teamId}`
                        || actionBusyKey === `accept-invite-${invitation.teamId}`
                      }
                      onClick={() => handleDeclineInvitation(invitation.teamId)}
                    >
                      {actionBusyKey === `decline-invite-${invitation.teamId}` ? "Declining..." : "Decline"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!loading && !loadError && activeTab === "requests" && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="font-display font-semibold text-lg text-foreground">Incoming Requests (Leader)</h2>
              {incomingRequests.length === 0 ? (
                <div className="card-static p-6 text-muted-foreground text-sm">
                  No incoming join requests for your teams.
                </div>
              ) : (
                incomingRequests.map((request) => (
                  <div key={`${request.teamId}-${request.requesterId}`} className="card-static p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{request.requesterName}</p>
                      <p className="text-sm text-muted-foreground">
                        requested to join <span className="font-medium text-foreground">{request.teamName}</span>
                      </p>
                      <Link
                        to={`/competitions/${request.competitionId}`}
                        className="text-xs text-muted-foreground hover:text-secondary"
                      >
                        {request.competitionTitle}
                      </Link>
                      {!request.canReview && (
                        <p className="text-xs text-warning mt-1">Registration window is closed for this team.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={
                          actionBusyKey === `accept-request-${request.teamId}-${request.requesterId}`
                          || !request.canReview
                        }
                        onClick={() => handleAcceptJoinRequest(request.teamId, request.requesterId)}
                      >
                        <Check className="w-3 h-3" />
                        {actionBusyKey === `accept-request-${request.teamId}-${request.requesterId}` ? "Accepting..." : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={
                          actionBusyKey === `reject-request-${request.teamId}-${request.requesterId}`
                          || !request.canReview
                        }
                        onClick={() => handleRejectJoinRequest(request.teamId, request.requesterId)}
                      >
                        {actionBusyKey === `reject-request-${request.teamId}-${request.requesterId}` ? "Rejecting..." : "Reject"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-display font-semibold text-lg text-foreground">Outgoing Requests</h2>
              {outgoingRequests.length === 0 ? (
                <div className="card-static p-6 text-muted-foreground text-sm">
                  You have not requested to join any team.
                </div>
              ) : (
                outgoingRequests.map((request) => (
                  <div key={request.teamId} className="card-static p-4">
                    <p className="font-medium text-foreground">{request.teamName}</p>
                    <p className="text-sm text-muted-foreground">
                      Waiting for leader <span className="font-medium text-foreground">{request.leaderName}</span> to review.
                    </p>
                    <Link
                      to={`/competitions/${request.competitionId}`}
                      className="text-xs text-muted-foreground hover:text-secondary"
                    >
                      {request.competitionTitle}
                    </Link>
                    {!request.canReview && (
                      <p className="text-xs text-warning mt-1">Registration window is closed for this team.</p>
                    )}
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
