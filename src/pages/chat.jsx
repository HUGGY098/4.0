import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import MessageBubble from "../components/Chat/MessageBubble";
import { supabase } from "../lib/supabase";

const SUGGESTIONS = [
  "What should I focus on tonight?",
  "I'm really busy today — what can wait?",
  "What assignments and deadlines are coming up?",
  "What do you remember about my study habits?",
];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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
  }, [messages, sending]);

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
        const dateValue = event.start_time || event.due_time;

        // Keep undated events too, so the AI can still see them.
        if (!dateValue) return true;

        const date = new Date(dateValue);

        // Include recent past events for context and future events.
        return !Number.isNaN(date.getTime()) && date >= cutoff;
      })
      .map((event) => ({
        title: event.title || "Untitled event",
        type: event.type || "personal",
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

  const send = async (text) => {
    const content = (text ?? input).trim();

    if (!content || sending || !conversationId) return;

    setInput("");
    setSending(true);
    setError("");

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

      // Retrieve the user's actual imported and manually added events.
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

      const { error: aiMessageError } = await supabase
        .from("messages")
        .insert({
          role: "assistant",
          content: result.content,
          conversation_id: conversationId,
        });

      if (aiMessageError) throw aiMessageError;

      await loadMessages(conversationId);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message || "Something went wrong.");
      await loadMessages(conversationId);
    } finally {
      setSending(false);
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
          className="mt-4 rounded-xl border px-4 py-2 text-sm hover:bg-accent"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {error && (
            <div className="rounded-xl border p-3 text-sm text-destructive">
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
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mt-6">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="rounded-xl border p-3 text-sm text-left hover:bg-accent"
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
          />

          <button
            type="submit"
            disabled={!input.trim() || sending || !conversationId}
            className="px-4 rounded-xl border disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}