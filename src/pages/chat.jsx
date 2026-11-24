
import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  CalendarPlus,
  Check,
  X,
} from "lucide-react";
import MessageBubble from "../components/Chat/MessageBubble";
import { supabase } from "../lib/supabase";

const SUGGESTIONS = [
  "What should I focus on tonight?",
  "I'm really busy today — what can wait?",
  "What assignments and deadlines are coming up?",
  "What do you remember about my study habits?",
  "Add a study session to my calendar tomorrow at 5 PM for one hour.",
];

const eventTypeLabels = {
  assignment: "Assignment",
  exam: "Exam / test",
  class: "Class",
  personal: "Personal",
  study_session: "Study session",
};

function formatEventDate(value) {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [pendingEvent, setPendingEvent] = useState(null);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const createConversation = async () => {
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
    setPendingEvent(null);
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
  }, [messages, sending, pendingEvent]);

  const newChat = () => {
    if (sending || savingEvent) return;
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
        title: event.title || "Untitled event",
        type: event.type || "personal",
        status: event.status || "pending",
        start_time: event.start_time || null,
        due_time: event.due_time || null,
        end_time: event.end_time || null,
        importance_score: event.importance_score ?? null,
        description: event.description || null,
      }));

    return {
      current_time: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      events,
    };
  };

  const saveMessage = async (role, content) => {
    if (!conversationId) return;

    const { error } = await supabase
      .from("messages")
      .insert({
        role,
        content,
        conversation_id: conversationId,
      });

    if (error) throw error;
  };

  const send = async (text) => {
    const content = (text ?? input).trim();

    if (!content || sending || !conversationId || savingEvent) return;

    setInput("");
    setSending(true);
    setError("");
    setPendingEvent(null);

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

      console.log("4.0 ACTUAL SCHEDULE DATA:", scheduleContext);

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

      await saveMessage(
        "assistant",
        result.content || "How can I help?"
      );

      if (result.proposedEvent) {
        setPendingEvent(result.proposedEvent);
      } else {
        setPendingEvent(null);
      }

      await loadMessages(conversationId);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message || "Something went wrong.");
      await loadMessages(conversationId);
    } finally {
      setSending(false);
    }
  };

  const confirmEvent = async () => {
    if (!pendingEvent || savingEvent || !conversationId) return;

    setSavingEvent(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("Please sign in before adding an event.");
      }

      const eventData = {
        title: pendingEvent.title.trim(),
        type: pendingEvent.type,
        status: "pending",
        importance_score: Number(pendingEvent.importance_score) || 5,
        source: "ai",
        user_id: user.id,
        start_time: pendingEvent.start_time || null,
        due_time: pendingEvent.due_time || null,
        end_time: pendingEvent.end_time || null,
      };

      const { error: insertError } = await supabase
        .from("events")
        .insert(eventData);

      if (insertError) throw insertError;

      const savedTitle = eventData.title;

      setPendingEvent(null);

      await saveMessage(
        "assistant",
        `Added **${savedTitle}** to your schedule. You can find it on the Schedule page.`
      );

      await loadMessages(conversationId);
    } catch (err) {
      console.error("AI event creation error:", err);
      setError(
        err.message ||
          "I couldn't add that event. Please try again."
      );
    } finally {
      setSavingEvent(false);
    }
  };

  const cancelEvent = async () => {
    if (savingEvent || !pendingEvent) return;

    setPendingEvent(null);
    setError("");

    try {
      await saveMessage(
        "assistant",
        "No problem — I didn't add anything to your schedule."
      );

      await loadMessages(conversationId);
    } catch (err) {
      console.error("Cancel message error:", err);
      setError("The event was cancelled, but I couldn't save the chat message.");
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen">
      <div className="px-5 md:px-10 pt-8 pb-4">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Sparkles className="size-7" />
          Talk to 4.0
        </h1>

        <p className="text-muted-foreground text-sm mt-2">
          Your academic co-pilot, powered by your actual schedule.
        </p>

        <button
          onClick={newChat}
          disabled={sending || savingEvent}
          className="mt-4 rounded-xl border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {messages.length === 0 && !error && (
            <div className="py-10 text-center">
              <Sparkles className="size-8 mx-auto mb-4" />

              <h2 className="font-display text-lg font-semibold">
                Hi, I'm 4.0
              </h2>

              <p className="text-sm text-muted-foreground mt-2">
                I'll use your saved schedule to help you decide what to do next.
                I can also add events to your schedule when you ask.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mt-6">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    disabled={sending}
                    className="rounded-xl border p-3 text-sm text-left hover:bg-accent disabled:opacity-50"
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

          {pendingEvent && (
            <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarPlus className="size-5" />
                Confirm calendar event
              </div>

              <div>
                <p className="text-lg font-semibold">
                  {pendingEvent.title}
                </p>

                <p className="text-sm text-muted-foreground mt-1">
                  {eventTypeLabels[pendingEvent.type] || "Event"}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                {pendingEvent.start_time && (
                  <div>
                    <span className="text-muted-foreground">Starts: </span>
                    {formatEventDate(pendingEvent.start_time)}
                  </div>
                )}

                {pendingEvent.due_time && (
                  <div>
                    <span className="text-muted-foreground">Due: </span>
                    {formatEventDate(pendingEvent.due_time)}
                  </div>
                )}

                {pendingEvent.end_time && (
                  <div>
                    <span className="text-muted-foreground">Ends: </span>
                    {formatEventDate(pendingEvent.end_time)}
                  </div>
                )}

                <div>
                  <span className="text-muted-foreground">Priority: </span>
                  {pendingEvent.importance_score}/10
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This event will only be saved after you confirm.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={confirmEvent}
                  disabled={savingEvent}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {savingEvent ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {savingEvent ? "Adding..." : "Confirm & Add"}
                </button>

                <button
                  onClick={cancelEvent}
                  disabled={savingEvent}
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
                >
                  <X className="size-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {sending && (
            <div className="flex gap-2 text-sm items-center">
              <Loader2 className="animate-spin size-4" />
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
          className="max-w-3xl mx-auto flex gap-2"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="flex-1 rounded-xl border px-4 py-3"
            placeholder="Message 4.0..."
            rows={1}
            disabled={sending || savingEvent}
          />

          <button
            type="submit"
            disabled={
              !input.trim() ||
              sending ||
              savingEvent ||
              !conversationId
            }
            className="px-4 rounded-xl border disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
