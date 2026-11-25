
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

- Help the student make realistic decisions using their actual schedule.
- Never invent assignments, grades, deadlines, or events.
- Never recommend completed work as unfinished.
- Distinguish due dates from actual time blocks.
- Never schedule an event in the past.
- Ask one concise question when essential information is missing.

CALENDAR ACTIONS

You can propose:
- create: Add an event.
- move: Change an existing event's date or time.
- delete: Remove an existing event.

When the student clearly requests a calendar change, call propose_calendar_change.

A proposal is NOT a completed action. Never say something has been saved, moved, or deleted until the student confirms it.

CREATE:
- Use a useful title.
- Choose assignment, exam, class, personal, or study_session.
- Estimate importance_score from 1 to 10.
- Include known start_time, due_time, and end_time.
- Do not invent unspecified times.
- Ask for missing essential information.

MOVE:
- Use the exact event ID from the active schedule.
- Preserve fields the student did not ask to change.
- Only propose a new time when the student has supplied enough information.

DELETE:
- Use the exact event ID from the active schedule.
- Never delete a completed event.
- Explain why removal was requested.

AUTOMATIC PRIORITY

Estimate importance_score from 1 to 10:
- 9–10: Extremely important exams or urgent high-value deadlines.
- 7–8: Important assignments, exams, and major commitments.
- 4–6: Normal assignments and useful study sessions.
- 1–3: Optional or low-urgency activities.

Consider event type, deadline proximity, explicit importance, whether it is mandatory or optional, and existing priority information.

Do not assume every exam is more important than every personal commitment.
If uncertain, use 5 and explain that it is an estimate.
Do not change an existing event's priority merely because it is being moved.

CALENDAR CONFLICTS

A conflict exists only when two scheduled time blocks overlap.

Only consider events with both start_time and end_time.
A due date by itself is not a time-block conflict.

For every overlapping event:
- Identify its exact event ID.
- Compare the importance and flexibility of both commitments.
- Prefer moving a flexible event over deleting it.
- Never recommend deleting a mandatory commitment merely because another event has a higher score.
- If both commitments are important or the answer is unclear, use ask_user.

Allowed conflict decisions:
- move_existing: Recommend moving the existing event. Supply new_start_time and new_end_time.
- delete_existing: Recommend deleting the existing event only when clearly appropriate.
- ask_user: The student needs to decide.

Never silently move or delete anything.
Every proposed change must be confirmed by the student.

TOOL USAGE

Use propose_calendar_change only when a calendar change is clearly requested.
Do not use it for ordinary planning or hypothetical examples.
If the exact event cannot be identified, ask which event the student means.
Do not propose a change if essential information is missing.

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
            "Prepare a calendar change for the student to review. This tool never saves anything.",
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
          max_tokens: 1800,
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

      if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
        return null;
      }

      return date.toISOString();
    };

    const isFuture = (value) =>
      !value || new Date(value).getTime() > Date.now();

    if (!["create", "move", "delete"].includes(proposal.action)) {
      return res.status(400).json({
        error: "Invalid calendar action.",
      });
    }

    const existingPrimary =
      proposal.action === "create"
        ? null
        : findEvent(proposal.event_id);

    if (proposal.action !== "create") {
      if (!existingPrimary) {
        return res.status(400).json({
          error:
            "The selected event is not in your active schedule. Please try again.",
        });
      }

      if (
        String(existingPrimary.status || "").toLowerCase() === "completed"
      ) {
        return res.status(400).json({
          error: "Completed events cannot be changed.",
        });
      }

      proposal.title = existingPrimary.title;
      proposal.type = existingPrimary.type;
      proposal.importance_score = existingPrimary.importance_score;
    } else {
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
    }

    const startTime = validDate(proposal.start_time);
    const dueTime = validDate(proposal.due_time);
    const endTime = validDate(proposal.end_time);

    if (
      (proposal.start_time && !startTime) ||
      (proposal.due_time && !dueTime) ||
      (proposal.end_time && !endTime)
    ) {
      return res.status(400).json({
        error: "The proposal contains an invalid date or time.",
      });
    }

    if (proposal.action !== "delete") {
      if (
        proposal.action === "move" &&
        !startTime &&
        !endTime &&
        !dueTime
      ) {
        return res.status(400).json({
          error: "The move proposal does not include a new date or time.",
        });
      }

      const resultingStart =
        startTime || existingPrimary?.start_time || null;
      const resultingEnd =
        endTime || existingPrimary?.end_time || null;

      if (
        resultingStart &&
        resultingEnd &&
        new Date(resultingEnd) <= new Date(resultingStart)
      ) {
        return res.status(400).json({
          error: "The proposed end time must be after its start time.",
        });
      }

      if (
        (startTime && !isFuture(startTime)) ||
        (endTime && !isFuture(endTime))
      ) {
        return res.status(400).json({
          error: "The proposed time must be in the future.",
        });
      }
    }

    const score = Math.max(
      1,
      Math.min(
        10,
        Math.round(Number(proposal.importance_score) || 5)
      )
    );

    const resultingStart =
      proposal.action === "create"
        ? startTime
        : startTime || existingPrimary?.start_time || null;

    const resultingEnd =
      proposal.action === "create"
        ? endTime
        : endTime || existingPrimary?.end_time || null;

    // Classes and study sessions must always occupy a complete time block.
    const resultingType =
      proposal.action === "create"
        ? proposal.type
        : existingPrimary?.type;

    if (
      proposal.action !== "delete" &&
      ["class", "study_session"].includes(resultingType) &&
      (!resultingStart || !resultingEnd)
    ) {
      return res.status(400).json({
        error: "Classes and study sessions require both a start and end time.",
      });
    }

    const overlaps = (aStart, aEnd, bStart, bEnd) => {
      const a = new Date(aStart).getTime();
      const b = new Date(aEnd).getTime();
      const c = new Date(bStart).getTime();
      const d = new Date(bEnd).getTime();

      if ([a, b, c, d].some(Number.isNaN)) return false;

      return a < d && b > c;
    };

    const validatedConflicts = [];
    const seenConflictIds = new Set();

    if (proposal.action !== "delete" && resultingStart && resultingEnd) {
      for (const conflict of Array.isArray(proposal.conflicts)
        ? proposal.conflicts
        : []) {
        const existing = findEvent(conflict.event_id);

        if (!existing) continue;

        const id = String(existing.id);

        if (
          id === String(proposal.event_id || "") ||
          seenConflictIds.has(id) ||
          String(existing.status || "").toLowerCase() === "completed"
        ) {
          continue;
        }

        seenConflictIds.add(id);

        if (
          !existing.start_time ||
          !existing.end_time ||
          !overlaps(
            resultingStart,
            resultingEnd,
            existing.start_time,
            existing.end_time
          )
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

        const overlapsAnotherEvent =
          decision === "move_existing" &&
          newStart &&
          newEnd &&
          events.some((other) => {
            const otherId = String(other.id);
            return (
              otherId !== id &&
              otherId !== String(proposal.event_id || "") &&
              String(other.status || "").toLowerCase() !== "completed" &&
              other.start_time &&
              other.end_time &&
              overlaps(newStart, newEnd, other.start_time, other.end_time)
            );
          });

        const overlapsAnotherProposedMove =
          decision === "move_existing" &&
          newStart &&
          newEnd &&
          validatedConflicts.some((prior) =>
            prior.decision === "move_existing" &&
            prior.new_start_time &&
            prior.new_end_time &&
            overlaps(newStart, newEnd, prior.new_start_time, prior.new_end_time)
          );

        if (
          decision === "move_existing" &&
          (
            !newStart ||
            !newEnd ||
            new Date(newEnd) <= new Date(newStart) ||
            overlaps(resultingStart, resultingEnd, newStart, newEnd) ||
            overlapsAnotherEvent ||
            overlapsAnotherProposedMove
          )
        ) {
          validatedConflicts.push({
            event_id: id,
            title: existing.title || "Untitled event",
            decision: "ask_user",
            new_start_time: null,
            new_end_time: null,
            reason:
              "A safe alternative time was not provided. Please choose a time.",
          });
          continue;
        }

        validatedConflicts.push({
          event_id: id,
          title: existing.title || "Untitled event",
          decision,
          new_start_time: decision === "move_existing" ? newStart : null,
          new_end_time: decision === "move_existing" ? newEnd : null,
          reason: String(conflict.reason || "This event overlaps."),
        });
      }
    }

    // Independently detect any overlap the AI did not include.
    if (proposal.action !== "delete" && resultingStart && resultingEnd) {
      for (const event of events) {
        const id = String(event.id);

        if (
          id === String(proposal.event_id || "") ||
          seenConflictIds.has(id) ||
          !event.start_time ||
          !event.end_time
        ) {
          continue;
        }

        if (
          overlaps(
            resultingStart,
            resultingEnd,
            event.start_time,
            event.end_time
          )
        ) {
          validatedConflicts.push({
            event_id: id,
            title: event.title || "Untitled event",
            decision: "ask_user",
            new_start_time: null,
            new_end_time: null,
            reason:
              "This event overlaps with the proposed time but was not included in the AI's conflict analysis.",
          });
        }
      }
    }

    const proposedAction = {
      action: proposal.action,
      event_id:
        proposal.action === "create" ? null : String(proposal.event_id),
      title: String(proposal.title || "").trim(),
      type: allowedTypes.includes(proposal.type)
        ? proposal.type
        : "personal",
      importance_score: score,
      start_time: startTime,
      due_time: dueTime,
      end_time: endTime,
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
