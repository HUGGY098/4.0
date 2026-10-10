
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

import {
  Plus,
  RefreshCw,
  CalendarRange,
  Layers,
  ListChecks,
  Calendar,
  Apple,
  GraduationCap,
  Trash2,
} from "lucide-react";

import AddEventDialog from "../components/Schedule/AddEventDialog";
import CanvasSyncDialog from "../components/Schedule/CanvasSyncDialog";
import { Button } from "../components/ui/button";

const typeColors = {
  assignment: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  exam: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  class: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  personal: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  study_session: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

function getEventDate(event) {
  const value = event.due_time || event.start_time || event.end_time;

  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDisplayDate(event) {
  const date = getEventDate(event);

  if (!date) return "No date";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Schedule() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grouping, setGrouping] = useState("time");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [pageError, setPageError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("start_time", { ascending: true })
        .limit(200);

      if (error) throw error;

      setEvents(data || []);
    } catch (error) {
      console.error("Failed loading events:", error);
      setPageError(error?.message || "Couldn't load your schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const now = new Date();

    const sorted = [...events].sort((a, b) => {
      const dateA = getEventDate(a);
      const dateB = getEventDate(b);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA - dateB;
    });

    if (grouping === "priority") {
      const result = { High: [], Medium: [], Low: [] };

      sorted.forEach((event) => {
        const score = Number(event.importance_score) || 0;

        if (score >= 8) result.High.push(event);
        else if (score >= 5) result.Medium.push(event);
        else result.Low.push(event);
      });

      Object.values(result).forEach((items) => {
        items.sort((a, b) => {
          const dateA = getEventDate(a);
          const dateB = getEventDate(b);

          const pastA = dateA && dateA < now;
          const pastB = dateB && dateB < now;

          if (pastA && pastB) return dateB - dateA;
          if (pastA) return -1;
          if (pastB) return 1;

          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;

          return dateA - dateB;
        });
      });

      return result;
    }

    const past = [];
    const upcoming = [];
    const undated = [];

    sorted.forEach((event) => {
      const date = getEventDate(event);

      if (!date) {
        undated.push(event);
      } else if (date < now) {
        past.push(event);
      } else {
        upcoming.push(event);
      }
    });

    const result = {};

    if (past.length) {
      result["Past events"] = past.sort(
        (a, b) => getEventDate(b) - getEventDate(a)
      );
    }

    upcoming.forEach((event) => {
      const title = getDisplayDate(event);
      if (!result[title]) result[title] = [];
      result[title].push(event);
    });

    if (undated.length) result["No date set"] = undated;

    return result;
  }, [events, grouping]);

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event?")) return;

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await load();
    } catch (error) {
      console.error("Failed deleting event:", error);
      setPageError(error?.message || "Couldn't delete this event.");
    }
  };

  const handleCreated = async () => {
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            Smart Schedule
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage assignments, classes, and study sessions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setGrouping((current) =>
                current === "time" ? "priority" : "time"
              )
            }
          >
            {grouping === "time" ? (
              <CalendarRange className="mr-2 size-4" />
            ) : (
              <Layers className="mr-2 size-4" />
            )}
            {grouping === "time" ? "By priority" : "By time"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/google-sync")}
          >
            <Calendar className="mr-2 size-4" />
            Google
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert("Apple Calendar sync coming soon")}
          >
            <Apple className="mr-2 size-4" />
            Apple
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSyncOpen(true)}
          >
            <GraduationCap className="mr-2 size-4" />
            Canvas
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>

          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add
          </Button>
        </div>
      </div>

      {pageError && (
        <p role="alert" className="mb-4 rounded-md border border-red-500/30 p-3 text-sm text-red-600">
          {pageError}
        </p>
      )}

      {loading ? (
        <p>Loading schedule...</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <ListChecks className="mx-auto mb-3" />
          No events yet.
        </div>
      ) : (
        Object.entries(grouped).map(([title, items]) => (
          <div key={title} className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">{title}</h2>

            <div className="space-y-2">
              {items.map((event) => {
                const start = formatDateTime(event.start_time);
                const due = formatDateTime(event.due_time);
                const end = formatDateTime(event.end_time);

                return (
                  <div
                    key={event.id}
                    className="flex flex-wrap justify-between gap-4 rounded-xl border border-border bg-card p-4"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{event.title}</div>

                      <div className="mt-1 text-xs capitalize text-muted-foreground">
                        {(event.type || "personal").replace("_", " ")}
                      </div>

                      {(start || due || end) && (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {start && <div>Starts: {start}</div>}
                          {due && <div>Due: {due}</div>}
                          {end && <div>Ends: {end}</div>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded border px-2 py-1 text-xs ${
                          typeColors[event.type] || typeColors.personal
                        }`}
                        title="Priority score"
                      >
                        Priority: {Number(event.importance_score) || 0}/10
                      </span>

                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${event.title}`}
                        onClick={() => deleteEvent(event.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <AddEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />

      <CanvasSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        onSynced={load}
      />
    </div>
  );
}
