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


export default function AddEventDialog({
  open,
  onOpenChange,
  onCreated,
}) {

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);


  const submit = async (e) => {

    e.preventDefault();


    if (!title || !date) return;


    setLoading(true);


    try {

      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();


      if (!user) {
        throw new Error("No logged in user");
      }


      const { error } = await supabase
        .from("events")
        .insert({

          title,

          start_time: new Date(date).toISOString(),

          type: "personal",

          status: "pending",

          importance_score: 5,

          source: "manual",

          user_id: user.id,

        });


      if (error) {
        throw error;
      }


      setTitle("");
      setDate("");

      onCreated();

      onOpenChange(false);


    } catch (error) {

      console.error("Failed adding event:", error);

    } finally {

      setLoading(false);

    }

  };


  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent>

        <DialogHeader>

          <DialogTitle>
            Add Event
          </DialogTitle>

        </DialogHeader>


        <form
          onSubmit={submit}
          className="space-y-4"
        >

          <div className="space-y-2">

            <Label>
              Event name
            </Label>

            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Homework, exam, meeting..."
              required
            />

          </div>


          <div className="space-y-2">

            <Label>
              Date and time
            </Label>

            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />

          </div>


          <Button
            className="w-full"
            disabled={loading}
          >

            {loading ? "Adding..." : "Add event"}

          </Button>


        </form>


      </DialogContent>

    </Dialog>

  );

}
