import React from "react";
import { useEffect, useState } from "react";
import { Brain, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Memory() {
  const [memories, setMemories] = useState([]);
  const [newMemory, setNewMemory] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMemories = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("memory")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setMemories(data || []);
    } catch (error) {
      console.error("Memory loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const addMemory = async () => {
    if (!newMemory.trim()) return;

    try {
      const { error } = await supabase
        .from("memory")
        .insert({
          content: newMemory,
        });

      if (error) throw error;

      setNewMemory("");
      loadMemories();
    } catch (error) {
      console.error("Add memory error:", error);
    }
  };

  const deleteMemory = async (id) => {
    try {
      const { error } = await supabase
        .from("memory")
        .delete()
        .eq("id", id);

      if (error) throw error;

      loadMemories();
    } catch (error) {
      console.error("Delete memory error:", error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-10 py-8 md:py-12">

      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Brain className="size-7 text-primary" />
          Memory
        </h1>

        <p className="text-muted-foreground mt-2">
          4.0's stored notes about your habits, preferences, and study patterns.
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        <input
          className="border rounded-lg px-3 py-2 flex-1"
          placeholder="Add a memory..."
          value={newMemory}
          onChange={(e) => setNewMemory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addMemory();
          }}
        />

        <button
          className="border rounded-lg px-4 py-2 flex items-center"
          onClick={addMemory}
        >
          <Plus className="size-4 mr-2" />
          Add
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">
          Loading memories...
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No memories yet.
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="rounded-xl border bg-card p-4 flex items-center justify-between"
            >
              <p className="text-sm">
                {memory.content}
              </p>

              <button
                onClick={() => deleteMemory(memory.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
