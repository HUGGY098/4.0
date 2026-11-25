
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY is missing from Vercel.",
      });
    }

    const { messages, scheduleContext } = req.body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages are required.",
      });
    }

    const schedule = scheduleContext || {};
    const currentTime = schedule.current_time || new Date().toISOString();
    const timezone = schedule.timezone || "America/Chicago";

    const events = Array.isArray(schedule.events)
      ? schedule.events.filter(
          (event) =>
            String(event.status || "").toLowerCase() !== "completed"
        )
      : [];

    const scheduleText = JSON.stringify(
      { current_time: currentTime, timezone, events },
      null,
      2
    );

    const systemPrompt = `
You are 4.0, a personalized academic co-pilot.

CURRENT TIME: ${currentTime}
TIME ZONE: ${timezone}

ACTIVE SCHEDULE:
${scheduleText}

YOUR RESPONSIBILITIES

1. Help the student make realistic decisions using their actual schedule.
2. Recommend specific assignments and commitments using due dates, event types, and importance.
3. Never invent assignments, grades, deadlines, or events.
4. Never recommend completed work as unfinished.
5. Completed events are excluded from the schedule data.
6. Distinguish due dates from event start and end times.
7. Never schedule an event in the past.
8. Ask one concise question when essential information is missing.

CALENDAR ACTIONS

You can propose three kinds of calendar actions:

- create: Add a new event.
- move: Change the time of an existing event.
- delete: Remove an existing event.

Whenever the student clearly asks you to create, move, or delete an event, use the propose_calendar_change tool.

Never claim an event has been saved, moved, or deleted before the student confirms it.

For a new event:
- Include a useful title.
- Select one of these types: assignment, exam, class, personal, study_session.
- Estimate importance_score from 1 to 10.
- Include any known start_time, due_time, and end_time.
- Use ISO 8601 timestamps with time-zone offsets.
- Do not invent a time if the student has not provided one.
- Ask for missing essential scheduling information instead of guessing.

For a move:
- Identify the exact existing event using its event ID.
- Only select IDs present in the active schedule.
- Preserve existing dates and fields that the student did not ask to change.
- Provide the new time information.

For a delete:
- Identify the exact event using its event ID.
- Explain why removal was requested.
- Never delete a completed event.

AUTOMATIC PRIORITY

Estimate importance_score on a scale from 1 to 10:
- 9–10: Extremely important, such as major exams or urgent high-value deadlines.
- 7–8: Important assignments, exams, and major commitments.
- 4–6: Normal assignments and useful study sessions.
- 1–3: Optional or low-urgency activities.

Consider:
- Event type.
- Due date and how close it is.
- Explicit importance expressed by the student.
- Whether the event is mandatory or optional.
- Existing priority information.

Do not assume every exam is more important than every personal commitment.
If importance is uncertain, use 5 and explain that it is an estimate.

CALENDAR CONFLICTS

A conflict exists when two scheduled time blocks overlap.

Only consider events with both a valid start_time and end_time.
A due date by itself is not a time-block conflict.

For every overlapping active event:
- Identify its exact event ID.
- Compare its importance with the proposed event.
- Consider whether it is mandatory, flexible, or optional.
- Recommend a reasonable resolution.

Allowed conflict decisions:
- move_existing: Recommend moving the existing event. Supply a new start_time and end_time.
- delete_existing: Recommend deleting the existing event only when appropriate.
- ask_user: Importance is unclear, or both commitments may be necessary.

Never silently remove or move an event.
Every conflict resolution must be confirmed by the student.
Prefer moving a flexible event over deleting it.
Never recommend removing a mandatory commitment merely because another event has a higher numerical priority.
If two important commitments conflict, use ask_user.

TOOL USAGE

Call propose_calendar_change only when the student clearly requests a calendar change.
Do not use it for ordinary planning questions or hypothetical examples.

If the student asks to move or delete something but you cannot identify the exact event, ask which event they mean instead of guessing.

When proposing a change, provide a short explanation in the reason field.

When no calendar action is requested, answer normally using the student's schedule.

WRITING STYLE

- Friendly, clear, and student-friendly.
- Lead with the answer.
- Keep paragraphs short.
- Use Markdown when useful.
- Avoid unnecessary emojis.
- Ask at most one question per response.
`;

    const tools = [
      {
        type: "function",
        function: {
          name: "propose_calendar_change",
          description:
            "Propose a calendar creation, move, or deletion. This does not save anything. The student must confirm.",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              action: {
                type: "string",
                enum: ["create", "move", "delete"],
              },
              event_id: {
                type: ["string", "null"],
              },
              title: {
                type: ["string", "null"],
              },
              type: {
                type: ["string", "null"],
                enum: [
                  "assignment",
                  "exam",
                  "class",
                  "personal",
                  "study_session",
                  null,
                ],
              },
              importance_score: {
                type: ["integer", "null"],
              },
              start_time: {
                type: ["string", "null"],
              },
              due_time: {
                type: ["string", "null"],
              },
              end_time: {
                type: ["string", "null"],
              },
              reason: {
                type: "string",
              },
              conflicts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    event_id: { type: "string" },
                    decision: {
                      type: "string",
                      enum: [
                        "move_existing",
                        "delete_existing",
                        "ask_user",
                      ],
                    },
                    new_start_time: {
                      type: ["string", "null"],
                    },
                    new_end_time: {
                      type: ["string", "null"],
                    },
                    reason: { type: "string" },
                  },
                  required: [
                    "event_id",
                    "decision",
                    "new_start_time",
                    "new_end_time",
                    "reason",
                  ],
                },
              },
            },
            required: [
              "action",
              "event_id",
              "title",
              "type",
              "importance_score",
              "start_time",
              "due_time",
              "end_time",
              "reason",
              "conflicts",
            ],
          },
        },
      },
    ];

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          tools,
          tool_choice: "auto",
          parallel_tool_calls: false,
          temperature: 0.3,
          max_tokens: 1600,
        }),
      }
    );

    const responseText = await groqResponse.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Groq returned non-JSON:", responseText);
      return res.status(500).json({
        error: `Groq returned a non-JSON response (${groqResponse.status}).`,
      });
    }

    if (!groqResponse.ok) {
      console.error("Groq API error:", data);
      return res.status(groqResponse.status).json({
        error:
          data?.error?.message ||
          `Groq request failed with status ${groqResponse.status}.`,
      });
    }

    const assistantMessage = data?.choices?.[0]?.message;

    if (!assistantMessage) {
      return res.status(500).json({
        error: "Groq returned no message.",
      });
    }

    const toolCall = assistantMessage.tool_calls?.find(
      (call) =>
        call.function?.name === "propose_calendar_change"
    );

    if (!toolCall) {
      return res.status(200).json({
        content:
          assistantMessage.content ||
          "I'm ready to help with your schedule.",
        proposedAction: null,
      });
    }

    let proposal;

    try {
      proposal = JSON.parse(toolCall.function.arguments);
    } catch {
      return res.status(500).json({
        error: "The AI generated an invalid calendar proposal.",
      });
    }

    const allowedTypes = [
      "assignment",
      "exam",
      "class",
      "personal",
      "study_session",
    ];

    const findEvent = (id) =>
      events.find((event) => String(event.id) === String(id));

    const validDate = (value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      if (typeof value !== "string") return null;

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return null;
      if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return null;

      return date.toISOString();
    };

    if (!["create", "move", "delete"].includes(proposal.action)) {
      return res.status(400).json({
        error: "Invalid calendar action.",
      });
    }

    if (proposal.action === "create") {
      if (!String(proposal.title || "").trim()) {
        return res.status(400).json({
          error: "The proposed event needs a title.",
        });
      }

      if (!allowedTypes.includes(proposal.type)) {
        return res.status(400).json({
          error: "The proposed event has an invalid type.",
        });
      }
    } else {
      const existing = findEvent(proposal.event_id);

      if (!existing) {
        return res.status(400).json({
          error: "The AI selected an event that is not in your active schedule. Please try again.",
        });
      }

      if (
        String(existing.status || "").toLowerCase() === "completed"
      ) {
        return res.status(400).json({
          error: "Completed events cannot be changed by this proposal.",
        });
      }

      proposal.title = existing.title;
      proposal.type = existing.type;
      proposal.importance_score = existing.importance_score;
    }

    proposal.importance_score = Math.max(
      1,
      Math.min(10, Math.round(Number(proposal.importance_score) || 5))
    );

    proposal.start_time = validDate(proposal.start_time);
    proposal.due_time = validDate(proposal.due_time);
    proposal.end_time = validDate(proposal.end_time);

    if (proposal.action !== "delete") {
      if (
        proposal.action === "move" &&
        !proposal.start_time &&
        !proposal.end_time &&
        !proposal.due_time
      ) {
        return res.status(400).json({
          error: "The move proposal does not include a new date or time.",
        });
      }

      if (
        proposal.start_time &&
        proposal.end_time &&
        new Date(proposal.end_time) <= new Date(proposal.start_time)
      ) {
        return res.status(400).json({
          error: "The proposed end time must be after its start time.",
        });
      }
    }

    const validatedConflicts = [];

    for (const conflict of Array.isArray(proposal.conflicts)
      ? proposal.conflicts
      : []) {
      const existing = findEvent(conflict.event_id);

      if (!existing || existing.id === proposal.event_id) continue;

      if (
        String(existing.status || "").toLowerCase() === "completed"
      ) {
        continue;
      }

      const decision = [
        "move_existing",
        "delete_existing",
        "ask_user",
      ].includes(conflict.decision)
        ? conflict.decision
        : "ask_user";

      const newStart = validDate(conflict.new_start_time);
      const newEnd = validDate(conflict.new_end_time);

      if (
        decision === "move_existing" &&
        (!newStart || !newEnd || new Date(newEnd) <= new Date(newStart))
      ) {
        validatedConflicts.push({
          event_id: String(existing.id),
          title: existing.title,
          decision: "ask_user",
          new_start_time: null,
          new_end_time: null,
          reason: "A valid alternative time was not provided.",
        });
        continue;
      }

      validatedConflicts.push({
        event_id: String(existing.id),
        title: existing.title,
        decision,
        new_start_time: newStart,
        new_end_time: newEnd,
        reason: String(conflict.reason || "Calendar conflict."),
      });
    }

    const existingPrimary =
      proposal.action === "create"
        ? null
        : findEvent(proposal.event_id);

    const proposedAction = {
      action: proposal.action,
      event_id: proposal.action === "create" ? null : String(proposal.event_id),
      title: String(proposal.title || "").trim(),
      type: allowedTypes.includes(proposal.type)
        ? proposal.type
        : "personal",
      importance_score: proposal.importance_score,
      start_time: proposal.start_time,
      due_time: proposal.due_time,
      end_time: proposal.end_time,
      reason: String(proposal.reason || "Requested calendar change."),
      conflicts: validatedConflicts,
      existing_event: existingPrimary
        ? {
            title: existingPrimary.title,
            start_time: existingPrimary.start_time || null,
            due_time: existingPrimary.due_time || null,
            end_time: existingPrimary.end_time || null,
          }
        : null,
    };

    const content =
      assistantMessage.content ||
      (proposal.action === "create"
        ? "I've prepared a new calendar event for your review."
        : proposal.action === "move"
          ? "I've prepared the calendar move for your review."
          : "I've prepared the deletion for your review.");

    return res.status(200).json({
      content,
      proposedAction,
    });
  } catch (error) {
    console.error("4.0 chat API error:", error);

    return res.status(500).json({
      error: error?.message || "Unexpected server error.",
    });
  }
}
