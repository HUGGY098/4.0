
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const initialForm = {
  title: "",
  type: "assignment",
  priority: "5",
  startTime: "",
  dueTime: "",
  endTime: "",
};

function toISOStringOrNull(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("One of the dates is invalid. Please check it.");
  }

  return date.toISOString();
}

export default function AddEventDialog({
  open,
  onOpenChange,
  onCreated,
}) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrorMessage("");
  }

  function resetForm() {
    setForm(initialForm);
    setErrorMessage("");
  }

  async function submit(e) {
    e.preventDefault();
    setErrorMessage("");

    if (!form.title.trim()) {
      setErrorMessage("Please enter an event name.");
      return;
    }

    if (!form.startTime && !form.dueTime && !form.endTime) {
      setErrorMessage(
        "Please enter at least one start, due, or end date."
      );
      return;
    }

    setLoading(true);

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
        title: form.title.trim(),
        type: form.type,
        status: "pending",
        importance_score: Number(form.priority),
        source: "manual",
        user_id: user.id,
        start_time: toISOStringOrNull(form.startTime),
        due_time: toISOStringOrNull(form.dueTime),
        end_time: toISOStringOrNull(form.endTime),
      };

      const { error: insertError } = await supabase
        .from("events")
        .insert(eventData);

      if (insertError) throw insertError;

      resetForm();
      onOpenChange(false);
      await onCreated?.();
    } catch (error) {
      console.error("Failed adding event:", error);

      setErrorMessage(
        error?.message ||
          "Couldn't add the event. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) {
          onOpenChange(nextOpen);
          if (!nextOpen) setErrorMessage("");
        }
      }}
    >
      <DialogContent className="z-[100] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Event name</Label>
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Homework, exam, meeting..."
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type">Event type</Label>
            <select
              id="event-type"
              value={form.type}
              onChange={(e) => updateField("type", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="assignment">Assignment</option>
              <option value="exam">Exam / test</option>
              <option value="class">Class</option>
              <option value="personal">Personal</option>
              <option value="study_session">Study session</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-priority">
              Priority (1 = lowest, 10 = highest)
            </Label>
            <select
              id="event-priority"
              value={form.priority}
              onChange={(e) => updateField("priority", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map(
                (priority) => (
                  <option key={priority} value={String(priority)}>
                    {priority}
                    {priority >= 8
                      ? " — High"
                      : priority >= 5
                      ? " — Medium"
                      : " — Low"}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-start">Start date and time</Label>
            <Input
              id="event-start"
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => updateField("startTime", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-due">Due date and time</Label>
            <Input
              id="event-due"
              type="datetime-local"
              value={form.dueTime}
              onChange={(e) => updateField("dueTime", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-end">End date and time</Label>
            <Input
              id="event-end"
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => updateField("endTime", e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            You can enter only the dates that apply. At least one date
            is required.
          </p>

          {errorMessage && (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
