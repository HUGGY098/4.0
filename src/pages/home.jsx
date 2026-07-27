import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

import {
  CalendarDays,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight
} from "lucide-react";


export default function Home() {

  const [events, setEvents] = useState([]);
  const [memory, setMemory] = useState([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {

    async function loadData() {

      try {

        const [
          { data: eventsData },
          { data: memoryData }
        ] = await Promise.all([

          supabase
            .from("events")
            .select("*")
            .order("start_time", { ascending: true })
            .limit(50),

          supabase
            .from("memory")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(50)

        ]);


        setEvents(eventsData || []);
        setMemory(memoryData || []);


      } catch (error) {

        console.error("Failed loading dashboard:", error);

      } finally {

        setLoading(false);

      }

    }


    loadData();

  }, []);



  const now = new Date();


  const upcoming = events
    .filter(event => {

      const time = event.due_time || event.start_time;

      return time && new Date(time) >= now;

    })
    .sort(
      (a,b) =>
        new Date(a.due_time || a.start_time) -
        new Date(b.due_time || b.start_time)
    )
    .slice(0,5);



  const overdue = events.filter(event => {

    const time = event.due_time || event.start_time;

    return (
      time &&
      new Date(time) < now &&
      event.status !== "done"
    );

  });



  const highPriority = events
    .filter(event => event.status !== "done")
    .sort(
      (a,b) =>
        (b.importance_score || 0) -
        (a.importance_score || 0)
    )
    .slice(0,3);



  return (

    <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 md:py-12">


      <section className="mb-10">

        <div className="inline-flex items-center gap-2 text-xs bg-accent rounded-full px-3 py-1 mb-4">

          <Sparkles className="size-3.5" />

          Your academic co-pilot

        </div>


        <h1 className="font-display text-3xl md:text-4xl font-semibold">

          Welcome back.

          <span className="text-muted-foreground">
            {" "}Here's your day at a glance.
          </span>

        </h1>


        <p className="text-muted-foreground mt-3 max-w-2xl">

          4.0 combines your schedule, assignments, and memories to help you decide what to focus on.

        </p>

      </section>



      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">

        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarDays}/>

        <StatCard label="Overdue" value={overdue.length} icon={AlertTriangle}/>

        <StatCard label="High Priority" value={highPriority.length} icon={TrendingUp}/>

        <StatCard label="Memories" value={memory.length} icon={Clock}/>

      </section>



      <div className="grid md:grid-cols-2 gap-5">


        <Panel
          title="Upcoming"
          to="/schedule"
          action="Full schedule"
        >

          {loading ? (

            <p>Loading...</p>

          ) : upcoming.length === 0 ? (

            <p className="text-muted-foreground">
              Nothing scheduled yet.
            </p>

          ) : (

            upcoming.map(event => (

              <div
                key={event.id}
                className="py-3 border-b border-border"
              >

                <div className="text-sm font-medium">
                  {event.title}
                </div>

                <div className="text-xs text-muted-foreground">
                  {event.type}
                </div>

              </div>

            ))

          )}

        </Panel>



        <Panel
          title="Ask 4.0"
          to="/chat"
          action="Open chat"
        >

          <div className="rounded-xl bg-accent p-4 text-sm">

            <MessageSquare className="size-4 inline mr-2" />

            Ask 4.0 what you should focus on today.

            <br />

            <Link
              to="/chat"
              className="inline-flex items-center gap-1 mt-4 text-primary"
            >

              Start chatting

              <ArrowRight className="size-4"/>

            </Link>

          </div>

        </Panel>


      </div>


    </div>

  );
}



function StatCard({label,value,icon:Icon}) {

  return (

    <div className="rounded-xl border border-border bg-card p-4">

      <Icon className="size-4 text-muted-foreground"/>

      <div className="text-2xl font-semibold mt-2">
        {value}
      </div>

      <div className="text-xs text-muted-foreground">
        {label}
      </div>

    </div>

  );

}



function Panel({title,children,to,action}) {

  return (

    <div className="rounded-2xl border border-border bg-card">

      <div className="flex justify-between p-4 border-b border-border">

        <h2 className="font-semibold">
          {title}
        </h2>


        {to && (

          <Link
            to={to}
            className="text-xs text-primary flex items-center gap-1"
          >

            {action}

            <ArrowRight className="size-3"/>

          </Link>

        )}

      </div>


      <div className="p-5">
        {children}
      </div>


    </div>

  );

}