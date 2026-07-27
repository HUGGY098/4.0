import React from "react";
import { useEffect, useMemo, useState } from "react";
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
  Trash2
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



export default function Schedule() {

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grouping, setGrouping] = useState("time");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);



  const load = async () => {

    setLoading(true);


    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("start_time", { ascending: true })
      .limit(200);



    if (error) {

      console.error("Failed loading events:", error);
      setEvents([]);

    } else {

      setEvents(data || []);

    }


    setLoading(false);

  };



  useEffect(() => {

    load();

  }, []);




  const grouped = useMemo(() => {


    const sorted = [...events].sort(
      (a,b) =>
        new Date(a.start_time || a.due_time) -
        new Date(b.start_time || b.due_time)
    );



    if (grouping === "priority") {


      const result = {
        High: [],
        Medium: [],
        Low: []
      };



      sorted.forEach(event => {


        const score = event.importance_score || 0;



        if (score >= 8)
          result.High.push(event);

        else if (score >= 5)
          result.Medium.push(event);

        else
          result.Low.push(event);


      });



      return result;

    }




    const result = {};



    sorted.forEach(event => {


      const date = new Date(
        event.start_time || event.due_time
      ).toLocaleDateString(
        undefined,
        {
          weekday: "long",
          month: "short",
          day: "numeric"
        }
      );



      if (!result[date])
        result[date] = [];



      result[date].push(event);


    });



    return result;



  }, [events, grouping]);




  const deleteEvent = async (id) => {

    const confirmDelete = window.confirm(
      "Delete this event?"
    );

    if (!confirmDelete) return;


    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);


    if (error) {
      console.error("Failed deleting event:", error);
      return;
    }


    load();

  };



  return (

    <div className="max-w-6xl mx-auto px-5 md:px-10 py-8">


      <div className="flex justify-between items-center mb-8">


        <div>

          <h1 className="font-display text-3xl font-semibold">
            Smart Schedule
          </h1>


          <p className="text-muted-foreground text-sm mt-2">
            Manage assignments, classes, and study sessions.
          </p>


        </div>




        <div className="flex flex-wrap gap-2">


          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setGrouping(
                grouping === "time"
                  ? "priority"
                  : "time"
              )
            }
          >

            {grouping === "time"
              ?
              <CalendarRange className="size-4 mr-2"/>
              :
              <Layers className="size-4 mr-2"/>
            }


            {grouping === "time"
              ? "By priority"
              : "By time"
            }


          </Button>




          
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href="/google-sync"}
          >
            <Calendar className="size-4 mr-2"/>
            Google
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert("Apple Calendar sync coming soon")}
          >
            <Apple className="size-4 mr-2"/>
            Apple
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSyncOpen(true)}
          >
            <GraduationCap className="size-4 mr-2"/>
            Canvas
          </Button>

<Button
            variant="outline"
            size="sm"
            onClick={load}
          >

            <RefreshCw className="size-4 mr-2"/>

            Refresh

          </Button>




          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
          >

            <Plus className="size-4 mr-2"/>

            Add

          </Button>



        </div>


      </div>





      {loading ? (

        <p>Loading schedule...</p>


      ) : events.length === 0 ? (


        <div className="border border-dashed rounded-xl p-10 text-center">


          <ListChecks className="mx-auto mb-3"/>


          No events yet.


        </div>



      ) : (


        Object.entries(grouped).map(([title,items]) => (


          <div key={title} className="mb-6">


            <h2 className="text-sm font-semibold mb-3">
              {title}
            </h2>




            <div className="space-y-2">


              {items.map(event => (


                <div
                  key={event.id}
                  className="rounded-xl border border-border bg-card p-4 flex justify-between"
                >


                  <div>


                    <div className="font-medium">
                      {event.title}
                    </div>



                    <div className="text-xs text-muted-foreground">
                      {event.type}
                    </div>


                  </div>




                  <div className="flex items-center gap-2">

                    <span
                      className={`text-xs px-2 py-1 rounded border ${
                        typeColors[event.type] ||
                        typeColors.personal
                      }`}
                    >

                      {event.importance_score || 0}

                    </span>


                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEvent(event.id)}
                    >
                      <Trash2 className="size-4"/>
                    </Button>

                  </div>




                </div>


              ))}


            </div>


          </div>


        ))


      )}






      <AddEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={load}
      />



      <CanvasSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        onSynced={load}
      />



    </div>

  );

}