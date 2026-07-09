import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, fetchJsonCached, invalidateApiCache } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MessageCircle, Send, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminChat() {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  const loadConversations = async (force = false) => {
    if (!token) {
      setConversations([]);
      setActive(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const list = await fetchJsonCached(`${API_BASE_URL}/api/support/conversations/admin`, {
        token,
        ttlMs: 60000,
        force,
        cacheKey: "support:conversations:admin",
      });
      const arr = Array.isArray(list) ? list : [];
      setConversations(arr);
      if (!active && arr.length > 0) {
        openConversation(arr[0].id, false);
      }
    } catch (e) {
      toast.error(e?.message || "Failed to load conversations.");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (id, force = true) => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const conv = await res.json();
      setActive(conv);
      setConversations((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const others = list.filter((c) => c.id !== conv.id);
        return [toSummaryView(conv), ...others];
      });
    } catch {
      // ignore
    }
  };

  const toSummaryView = (conv) => ({
    id: conv.id,
    subject: conv.subject,
    status: conv.status,
    lastMessageAt: conv.lastMessageAt,
    unreadForAdmin: conv.unreadForAdmin || 0,
    studentName: conv.studentName || "",
    studentEmail: conv.studentEmail || "",
  });

  const handleSend = async () => {
    if (!active || !message.trim() || !token) return;
    try {
      setSending(true);
      const res = await fetch(`${API_BASE_URL}/api/support/conversations/${active.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        toast.error(text || "Failed to send message.");
        return;
      }
      const conv = await res.json();
      setMessage("");
      setActive(conv);
      setConversations((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const others = list.filter((c) => c.id !== conv.id);
        return [toSummaryView(conv), ...others];
      });
      invalidateApiCache((key) => String(key).includes("/api/support/"));
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadConversations(false);
  }, []);

  // Auto-refresh when notifications (including support notifications) arrive
  useEffect(() => {
    const handler = () => {
      loadConversations(false);
    };
    window.addEventListener("notifications:updated", handler);
    return () => window.removeEventListener("notifications:updated", handler);
  }, []);

  const sortedMessages =
    active && Array.isArray(active.messages)
      ? active.messages
          .slice()
          .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      : [];

  return (
    <AppLayout role="admin">
      <div className="max-w-6xl mx-auto space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Student Messages
            </h1>
            <p className="text-muted-foreground mt-1">
              Chat with students who reach out via the Contact Us page.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px,1fr] gap-4">
          {/* Conversation list */}
          <div className="card-static p-3 flex flex-col gap-2 h-[460px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-secondary" />
                Conversations
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => loadConversations(true)}
                title="Refresh"
              >
                ↻
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
              {loading && (
                <p className="text-xs text-muted-foreground px-2 py-1">Loading conversations…</p>
              )}
              {!loading && conversations.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  No messages yet. Students can start a chat from the Contact Us page.
                </p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id, false)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors border",
                    active && active.id === c.id ? "bg-secondary/10 border-secondary/40" : "border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                      <UserCircle2 className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.studentName || "Student"}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                    </div>
                    {c.unreadForAdmin > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold">
                        {c.unreadForAdmin}
                      </span>
                    )}
                  </div>
                  {c.lastMessageAt && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(c.lastMessageAt).toLocaleString()}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active conversation */}
          <div className="card-static p-4 flex flex-col h-[460px]">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a conversation to start chatting with a student.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <p className="font-semibold text-foreground">{active.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      Student conversation • {active.status || "OPEN"}
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar py-3 space-y-3">
                  {sortedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={
                        msg.senderRole === "ADMIN" ? "flex justify-end" : "flex justify-start"
                      }
                    >
                      <div
                        className={
                          msg.senderRole === "ADMIN"
                            ? "max-w-[80%] px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
                            : "max-w-[80%] px-3 py-2 rounded-lg bg-muted text-foreground text-sm"
                        }
                      >
                        <p>{msg.text}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/80">
                          {msg.senderRole === "ADMIN" ? "You" : "Student"} •{" "}
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-border flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a reply to the student…"
                    className="flex-1 h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    onKeyDown={(e) => e.key === "Enter" && !sending && message.trim() && handleSend()}
                  />
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={sending || !message.trim()}
                    onClick={handleSend}
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

