import React, { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import MessageBubble from "../components/Chat/MessageBubble";
import { supabase } from "../lib/supabase";

const SUGGESTIONS = [
  "What should I focus on tonight?",
  "I'm really busy today — what can wait?",
  "Add a study session for calculus tomorrow at 8pm",
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

  const send = async (text) => {
    const content = (text ?? input).trim();

    if (!content || sending || !conversationId) return;

    setInput("");
    setSending(true);
    setError("");

    try {
      // Save user's message
      const { error: userMessageError } = await supabase
        .from("messages")
        .insert({
          role: "user",
          content,
          conversation_id: conversationId,
        });

      if (userMessageError) {
        throw userMessageError;
      }

      // Get the conversation history
      const { data: history, error: historyError } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (historyError) {
        throw historyError;
      }

      // Ask Groq for an answer
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: history || [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "AI request failed.");
      }

      // Save AI response
      const { error: aiMessageError } = await supabase
        .from("messages")
        .insert({
          role: "assistant",
          content: result.content,
          conversation_id: conversationId,
        });

      if (aiMessageError) {
        throw aiMessageError;
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

  return (
    <div className="flex flex-col h-screen max-h-screen">

      <div className="px-5 md:px-10 pt-8 pb-4">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Sparkles className="size-7" />
          Talk to 4.0
        </h1>

        <p className="text-muted-foreground text-sm mt-2">
          Ask anything. 4.0 uses your schedule and memory to help you plan.
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
                Your academic co-pilot. Try asking:
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mt-6">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border p-3 text-sm text-left hover:bg-accent"
                  >
                    {s}
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
              4.0 is thinking...
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t px-5 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="max-w-3xl mx-auto flex gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-xl border px-4 py-3"
            placeholder="Message 4.0..."
            rows={1}
          />

          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="px-4 rounded-xl border disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

    </div>
  );
}