
import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  CalendarPlus,
  CalendarClock,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import MessageBubble from "../components/Chat/MessageBubble";
import { supabase } from "../lib/supabase";

const SUGGESTIONS = [
  "What should I focus on tonight?",
  "I'm really busy today — what can wait?",
  "What assignments and deadlines are coming up?",
  "What do you remember about my study habits?",
];

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not specified";

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function overlaps(startA, endA, startB, endB) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) {
    return false;
  }

  return aStart < bEnd && aEnd > bStart;
}

function detectConflicts(proposal, events) {
  if (
    proposal.action === "delete" ||
    !proposal.start_time ||
    !proposal.end_time
  ) {
    return proposal.conflicts || [];
  }

  const detected = (events || []).filter((event) => {
    if (String(event.id) === String(proposal.event_id || "")) {
      return false;
    }

    if (
      String(event.status || "").toLowerCase() === "completed" ||
      !event.start_time ||
      !event.end_time
    ) {
      return false;
    }

    return overlaps(
      proposal.start_time,
      proposal.end_time,
      event.start_time,
      event.end_time
    );
  });

  const recommendations = new Map(
    (proposal.conflicts || []).map((item) => [
      String(item.event_id),
      item,
    ])
  );

  return detected.map((event) => {
    const recommendation = recommendations.get(String(event.id));

    return {
      event_id: String(event.id),
      title: event.title || "Untitled event",
      decision: recommendation?.decision || "ask_user",
      new_start_time: recommendation?.new_start_time || null,
      new_end_time: recommendation?.new_end_time || null,
      reason:
        recommendation?.reason ||
        "This event overlaps with the proposed time. The importance of both commitments needs to be reviewed.",
    };
  });
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const scrollRef = useRef(null);

  const createConversation = async () => {
    setPendingAction(null);

    const { data, error } = await supabase
      .from("conversations")
      .insert({ title: "New Chat" })
      .select()
      .single();

    if (error) {
      console.error("Conversation error:", error);
      setError("Couldn't create a chat.");
      return;
    }

    setConversationId(data.id);
    setMessages([]);
    setError("");
  };

  const loadMessages = async (id) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Message loading error:", error);
      return;
    }

    setMessages(data || []);
  };

  useEffect(() => {
    createConversation();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, sending, pendingAction]);

  const newChat = () => {
    createConversation();
  };

  const getScheduleContext = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("start_time", { ascending: true })
      .limit(200);

    if (error) {
      console.error("Schedule context error:", error);
      throw new Error(
        "I couldn't load your schedule, so I can't make a reliable plan yet. Please refresh and try again."
      );
    }

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);

    const events = (data || [])
      .filter((event) => {
        if (
          String(event.status || "").toLowerCase() === "completed"
        ) {
          return false;
        }

        const dateValue = event.due_time || event.start_time;

        if (!dateValue) return true;

        const date = new Date(dateValue);

        return !Number.isNaN(date.getTime()) && date >= cutoff;
      })
      .map((event) => ({
        id: String(event.id),
        title: event.title || "Untitled event",
        type: event.type || "personal",
        course: event.course || null,
        status: event.status || "pending",
        source: event.source || null,
        start_time: event.start_time || null,
        due_time: event.due_time || null,
        end_time: event.end_time || null,
        importance_score: event.importance_score ?? null,
        description: event.description || null,
      }));

    setScheduleEvents(events);

    return {
      current_time: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      events,
    };
  };

  const saveAssistantMessage = async (content) => {
    const { error } = await supabase.from("messages").insert({
      role: "assistant",
      content,
      conversation_id: conversationId,
    });

    if (error) throw error;
  };

  const send = async (text) => {
    const content = (text ?? input).trim();

    if (!content || sending || !conversationId) return;

    setInput("");
    setSending(true);
    setError("");
    setPendingAction(null);

    try {
      const { error: userMessageError } = await supabase
        .from("messages")
        .insert({
          role: "user",
          content,
          conversation_id: conversationId,
        });

      if (userMessageError) throw userMessageError;

      const { data: history, error: historyError } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (historyError) throw historyError;

      const scheduleContext = await getScheduleContext();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: history || [],
          scheduleContext,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "AI request failed.");
      }

      if (result.proposedAction) {
        const proposal = {
          ...result.proposedAction,
          conflicts: detectConflicts(
            result.proposedAction,
            scheduleContext.events
          ),
        };

        setPendingAction(proposal);
      }

      await saveAssistantMessage(
        result.content || "I've prepared a response for you."
      );

      await loadMessages(conversationId);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message || "Something went wrong.");
      await loadMessages(conversationId);
    } finally {
      setSending(false);
    }
  };

  const cancelAction = async () => {
    setPendingAction(null);

    try {
      await saveAssistantMessage(
        "I cancelled that proposed calendar change. Nothing was changed."
      );
      await loadMessages(conversationId);
    } catch (err) {
      console.error("Cancellation message error:", err);
      setError("The proposal was cancelled, but I couldn't save the chat message.");
    }
  };

  const confirmAction = async () => {
    if (!pendingAction || confirming) return;

    const proposal = pendingAction;

    if (
      proposal.conflicts?.some(
        (conflict) => conflict.decision === "ask_user"
      )
    ) {
      setError(
        "There is a calendar conflict that needs your decision. Cancel this proposal or ask 4.0 to help resolve the conflict first."
      );
      return;
    }

    setConfirming(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in before changing your schedule.");

      // Confirm that every affected event still exists and is active.
      const affectedIds = [
        ...(proposal.action === "create" ? [] : [proposal.event_id]),
        ...(proposal.conflicts || []).map((item) => item.event_id),
      ].filter(Boolean);

      let currentEvents = [];

      if (affectedIds.length) {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .in("id", affectedIds)
          .eq("user_id", user.id);

        if (error) throw error;

        currentEvents = data || [];

        if (currentEvents.length !== affectedIds.length) {
          throw new Error(
            "One or more events have changed or are no longer available. Refresh your schedule and try again."
          );
        }

        if (
          currentEvents.some(
            (event) =>
              String(event.status || "").toLowerCase() === "completed"
          )
        ) {
          throw new Error(
            "A completed event cannot be changed by this proposal."
          );
        }
      }

      // Apply the primary event action.
      if (proposal.action === "create") {
        const { error } = await supabase.from("events").insert({
          title: proposal.title,
          type: proposal.type || "personal",
          status: "pending",
          importance_score: proposal.importance_score || 5,
          source: "ai",
          user_id: user.id,
          start_time: proposal.start_time,
          due_time: proposal.due_time,
          end_time: proposal.end_time,
        });

        if (error) throw error;
      }

      if (proposal.action === "move") {
        const updates = {
          importance_score: proposal.importance_score || 5,
        };

        if (proposal.start_time) {
          updates.start_time = proposal.start_time;
        }

        if (proposal.due_time) {
          updates.due_time = proposal.due_time;
        }

        if (proposal.end_time) {
          updates.end_time = proposal.end_time;
        }

        const { data, error } = await supabase
          .from("events")
          .update(updates)
          .eq("id", proposal.event_id)
          .eq("user_id", user.id)
          .select("id")
          .single();

        if (error) throw error;
        if (!data) throw new Error("The event could not be moved.");
      }

      if (proposal.action === "delete") {
        const { data, error } = await supabase
          .from("events")
          .delete()
          .eq("id", proposal.event_id)
          .eq("user_id", user.id)
          .select("id")
          .single();

        if (error) throw error;
        if (!data) throw new Error("The event could not be deleted.");
      }

      // Apply the separately confirmed conflict recommendations.
      for (const conflict of proposal.conflicts || []) {
        if (conflict.decision === "move_existing") {
          const { data, error } = await supabase
            .from("events")
            .update({
              start_time: conflict.new_start_time,
              end_time: conflict.new_end_time,
            })
            .eq("id", conflict.event_id)
            .eq("user_id", user.id)
            .select("id")
            .single();

          if (error) throw error;
          if (!data) {
            throw new Error(
              `Couldn't move the conflicting event: ${conflict.title}.`
            );
          }
        }

        if (conflict.decision === "delete_existing") {
          const { data, error } = await supabase
            .from("events")
            .delete()
            .eq("id", conflict.event_id)
            .eq("user_id", user.id)
            .select("id")
            .single();

          if (error) throw error;
          if (!data) {
            throw new Error(
              `Couldn't delete the conflicting event: ${conflict.title}.`
            );
          }
        }
      }

      const actionText =
        proposal.action === "create"
          ? `Added "${proposal.title}" to your schedule.`
          : proposal.action === "move"
            ? `Moved "${proposal.title}" in your schedule.`
            : `Deleted "${proposal.title}" from your schedule.`;

      const conflictText = (proposal.conflicts || [])
        .filter((item) => item.decision !== "ask_user")
        .map((item) =>
          item.decision === "move_existing"
            ? `Moved "${item.title}" to resolve the conflict.`
            : `Deleted "${item.title}" to resolve the conflict.`
        )
        .join(" ");

      setPendingAction(null);

      await saveAssistantMessage(
        `${actionText} ${conflictText} Your calendar has been updated.`
      );

      await getScheduleContext();
      await loadMessages(conversationId);
    } catch (err) {
      console.error("Calendar action error:", err);
      setError(
        err.message ||
          "The calendar change could not be completed. Please refresh and check your schedule."
      );
    } finally {
      setConfirming(false);
    }
  };

  const actionIcon =
    pendingAction?.action === "create"
      ? CalendarPlus
      : pendingAction?.action === "move"
        ? CalendarClock
        : Trash2;

  const ActionIcon = actionIcon;

  return (
    <div className="flex h-screen max-h-screen flex-col">
      <div className="px-5 pb-4 pt-8 md:px-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold md:text-3xl">
          <Sparkles className="size-7" />
          Talk to 4.0
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Your academic co-pilot, powered by your actual schedule.
        </p>

        <button
          onClick={newChat}
          className="mt-4 rounded-xl border px-4 py-2 text-sm hover:bg-accent"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-10">
        <div className="mx-auto max-w-3xl space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {messages.length === 0 && !error && (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto mb-4 size-8" />

              <h2 className="font-display text-lg font-semibold">
                Hi, I'm 4.0
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                I'll use your saved schedule to help you decide what to do next.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="rounded-xl border p-3 text-left text-sm hover:bg-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble
              key={message.id || index}
              message={message}
            />
          ))}

          {pendingAction && (
            <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 font-semibold">
                <ActionIcon className="size-5" />
                Calendar change proposal
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                Review this proposal. Nothing will change until you confirm.
              </p>

              <div className="mt-4 space-y-2 rounded-xl bg-muted/40 p-3">
                <div className="font-medium">
                  {pendingAction.action === "create"
                    ? "Create event"
                    : pendingAction.action === "move"
                      ? "Move event"
                      : "Delete event"}
                </div>

                <div className="text-sm">
                  **{pendingAction.title}**
                </div>

                {pendingAction.action !== "delete" && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div>
                      Type: {(pendingAction.type || "personal").replace("_", " ")}
                    </div>
                    {pendingAction.start_time && (
                      <div>
                        Starts: {formatDate(pendingAction.start_time)}
                      </div>
                    )}
                    {pendingAction.due_time && (
                      <div>
                        Due: {formatDate(pendingAction.due_time)}
                      </div>
                    )}
                    {pendingAction.end_time && (
                      <div>
                        Ends: {formatDate(pendingAction.end_time)}
                      </div>
                    )}
                    <div>
                      Estimated priority: {pendingAction.importance_score}/10
                    </div>
                  </div>
                )}

                {pendingAction.action === "delete" && (
                  <div className="text-sm text-muted-foreground">
                    This event will be permanently removed from your schedule.
                  </div>
                )}

                <div className="border-t pt-2 text-sm">
                  **Why:** {pendingAction.reason}
                </div>
              </div>

              {pendingAction.conflicts?.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="size-4 text-amber-600" />
                    Calendar conflicts detected
                  </div>

                  {pendingAction.conflicts.map((conflict) => (
                    <div
                      key={conflict.event_id}
                      className="rounded-xl border p-3 text-sm"
                    >
                      <div className="font-medium">{conflict.title}</div>

                      <div className="mt-1 text-muted-foreground">
                        {conflict.reason}
                      </div>

                      <div className="mt-2 font-medium">
                        {conflict.decision === "move_existing"
                          ? "Recommendation: Move this event"
                          : conflict.decision === "delete_existing"
                            ? "Recommendation: Delete this event"
                            : "Decision needed: These commitments need your review"}
                      </div>

                      {conflict.decision === "move_existing" && (
                        <div className="mt-1 text-muted-foreground">
                          New start: {formatDate(conflict.new_start_time)}
                          <br />
                          New end: {formatDate(conflict.new_end_time)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pendingAction.conflicts?.some(
                (item) => item.decision === "ask_user"
              ) && (
                <p className="mt-3 text-sm text-amber-700">
                  4.0 needs your input before this conflict can be resolved.
                  Ask it to help compare the commitments, or cancel this proposal.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={confirmAction}
                  disabled={
                    confirming ||
                    pendingAction.conflicts?.some(
                      (item) => item.decision === "ask_user"
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {confirming ? "Saving..." : "Confirm changes"}
                </button>

                <button
                  onClick={cancelAction}
                  disabled={confirming}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  <XCircle className="size-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {sending && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              4.0 is checking your schedule...
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t px-5 py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="mx-auto flex max-w-3xl gap-2"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="flex-1 rounded-xl border px-4 py-3"
            placeholder="Message 4.0..."
            rows={1}
          />

          <button
            type="submit"
            disabled={!input.trim() || sending || !conversationId}
            className="rounded-xl border px-4 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
