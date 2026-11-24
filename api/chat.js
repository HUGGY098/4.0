
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
    const events = Array.isArray(schedule.events)
      ? schedule.events.filter(
          (event) =>
            String(event.status || "").toLowerCase() !== "completed"
        )
      : [];

    const currentTime =
      schedule.current_time || new Date().toISOString();

    const timezone =
      schedule.timezone || "America/Chicago";

    const scheduleText = JSON.stringify(
      {
        current_time: currentTime,
        timezone,
        events,
      },
      null,
      2
    );

    const systemPrompt = `
You are 4.0, a personalized academic co-pilot.

YOUR MAIN JOB
Help the student make specific, realistic decisions about their actual schoolwork, schedule, deadlines, and goals.

REAL SCHEDULE DATA
The student's schedule is provided below.

Current time: ${currentTime}
Student's time zone: ${timezone}

Schedule data:
${scheduleText}

SCHEDULE RULES
1. Use actual schedule data. Never invent assignments, deadlines, classes, grades, events, or available time.
2. Prioritize using due dates, importance, event type, and time available.
3. Distinguish an assignment's due date from its start time.
4. Treat completed events as finished. Never recommend them as unfinished or overdue.
5. Treat past events as past events.
6. Personal events and classes are commitments, not automatically assignments.
7. Ask one brief follow-up question when essential information is missing.
8. Never claim to have checked Canvas, grades, or another source unless that information was provided.
9. Keep responses clear, direct, and student-friendly.

ADDING CALENDAR EVENTS
You have access to a tool called prepare_calendar_event.

Use it when the student clearly asks you to add, schedule, or put an event on their calendar.

Examples:
- "Add math homework tomorrow at 5 PM."
- "Schedule a study session on Friday from 4 to 5."
- "Put my science exam on the calendar for December 2 at 9 AM."

IMPORTANT:
- This tool ONLY prepares a proposed event. It does not save anything.
- The student must confirm the proposal in the app before it is saved.
- Never tell the student an event has been added until the app confirms it.
- If the student has not provided enough information to determine a date and at least one time, ask a question instead of calling the tool.
- Do not invent dates or times.
- Interpret relative dates using the current time and the student's time zone.
- Convert proposed dates to ISO 8601 timestamps with the correct time-zone offset.
- For an event with a duration, calculate its end time.
- If the student gives a start and end time, use both.
- For assignments, use due_time when a deadline is provided.
- If no priority is specified, use 5.
- Use only these event types: assignment, exam, class, personal, study_session.
- Choose the most appropriate type based on the request.
- Do not create duplicate proposals for the same request.
- If the student asks to change an existing event, do not create a duplicate. Explain that editing existing events is not supported yet.

After the tool is called, explain what will be added and that the student must confirm it.

HOW TO WRITE
- Use short, natural paragraphs.
- Lead with the answer.
- Use Markdown when it improves readability.
- Use headings for longer answers.
- Use bold sparingly.
- Use numbered lists for steps and bullets for related items.
- You may create valid Markdown tables when useful.
- Never display raw Markdown table syntax or pipe characters as ordinary text.
- Use fenced code blocks only for actual code.
- Ask at most one question per response.
- Avoid generic productivity advice when actual schedule information is available.
- Keep responses concise.
`;

    const tools = [
      {
        type: "function",
        function: {
          name: "prepare_calendar_event",
          description:
            "Prepare a calendar event for the student to review and confirm. This does not save the event.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The event title.",
              },
              type: {
                type: "string",
                enum: [
                  "assignment",
                  "exam",
                  "class",
                  "personal",
                  "study_session",
                ],
              },
              importance_score: {
                type: "integer",
                minimum: 1,
                maximum: 10,
              },
              start_time: {
                type: ["string", "null"],
                description:
                  "ISO 8601 timestamp with time-zone offset, or null.",
              },
              due_time: {
                type: ["string", "null"],
                description:
                  "ISO 8601 deadline with time-zone offset, or null.",
              },
              end_time: {
                type: ["string", "null"],
                description:
                  "ISO 8601 end timestamp with time-zone offset, or null.",
              },
            },
            required: [
              "title",
              "type",
              "importance_score",
              "start_time",
              "due_time",
              "end_time",
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
          temperature: 0.4,
          max_tokens: 1200,
        }),
      }
    );

    const responseText = await groqResponse.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(
        "Groq returned a non-JSON response:",
        groqResponse.status,
        responseText
      );

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
        call.function?.name === "prepare_calendar_event"
    );

    if (!toolCall) {
      return res.status(200).json({
        content:
          assistantMessage.content ||
          "How can I help you with your schedule?",
        proposedEvent: null,
      });
    }

    let proposedEvent;

    try {
      proposedEvent = JSON.parse(toolCall.function.arguments);
    } catch {
      return res.status(500).json({
        error: "I couldn't understand the proposed calendar event.",
      });
    }

    const allowedTypes = [
      "assignment",
      "exam",
      "class",
      "personal",
      "study_session",
    ];

    if (
      typeof proposedEvent.title !== "string" ||
      !proposedEvent.title.trim() ||
      proposedEvent.title.length > 200 ||
      !allowedTypes.includes(proposedEvent.type)
    ) {
      return res.status(400).json({
        error: "The proposed event contains invalid details.",
      });
    }

    proposedEvent.importance_score = Math.min(
      10,
      Math.max(
        1,
        Math.round(Number(proposedEvent.importance_score) || 5)
      )
    );

    for (const field of [
      "start_time",
      "due_time",
      "end_time",
    ]) {
      const value = proposedEvent[field];

      if (value !== null && value !== undefined) {
        const parsed = new Date(value);

        if (
          typeof value !== "string" ||
          Number.isNaN(parsed.getTime()) ||
          !/[+-]\d{2}:\d{2}$|Z$/.test(value)
        ) {
          return res.status(400).json({
            error: `The proposed ${field} is invalid. Please try again.`,
          });
        }
      } else {
        proposedEvent[field] = null;
      }
    }

    if (
      !proposedEvent.start_time &&
      !proposedEvent.due_time &&
      !proposedEvent.end_time
    ) {
      return res.status(400).json({
        error: "The event needs at least one date or time.",
      });
    }

    const content =
      assistantMessage.content ||
      "I've prepared this event for your schedule. Please review the details and confirm before I save it.";

    return res.status(200).json({
      content,
      proposedEvent,
    });
  } catch (error) {
    console.error("4.0 chat API error:", error);

    return res.status(500).json({
      error: error?.message || "Unexpected server error.",
    });
  }
}
