import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";

export default function GoogleSync() {
  const [status, setStatus] = useState("");

  const syncGoogleCalendar = async () => {
    try {
      setStatus("Getting Google Calendar events...");

      const token = localStorage.getItem("google_calendar_token");

      if (!token) {
        setStatus("No Google token found. Please login with Google first.");
        return;
      }

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!data.items) {
        setStatus("No Google Calendar events found.");
        return;
      }


      const {
        data: { user },
      } = await supabase.auth.getUser();


      const events = data.items
        .filter(event => event.start)
        .map(event => ({
          user_id: user.id,
          title: event.summary || "Untitled Event",
          start_time:
            event.start.dateTime ||
            event.start.date,
          end_time:
            event.end?.dateTime ||
            event.end?.date,
          type: "personal",
          google_event_id: event.id,
        }));


      const { error } = await supabase
        .from("events")
        .upsert(events, {
          onConflict: "user_id,google_event_id",
        });


      if (error) throw error;


      setStatus(`✅ Imported ${events.length} events!`);

    } catch (error) {
      console.error(error);
      setStatus("❌ Sync failed: " + error.message);
    }
  };


  return (
    <div className="max-w-3xl mx-auto px-5 py-10">

      <h1 className="text-3xl font-semibold mb-4">
        Google Calendar Sync
      </h1>

      <p className="text-muted-foreground mb-6">
        Import your Google Calendar events into 4.0.
      </p>

      <Button onClick={syncGoogleCalendar}>
        Sync Google Calendar
      </Button>

      {status && (
        <p className="mt-6">
          {status}
        </p>
      )}

    </div>
  );
}
