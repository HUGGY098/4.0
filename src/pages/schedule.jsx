export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
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

    if (
      !scheduleContext ||
      !Array.isArray(scheduleContext.events)
    ) {
      return res.status(400).json({
        error: "Schedule data is missing. Please refresh and try again.",
      });
    }

    // Only accept normal chat roles and text messages.
    const safeMessages = messages
      .filter(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
      )
      .slice(-30)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 8000),
      }));

    const safeEvents = scheduleContext.events
      .slice(0, 200)
      .map((event) => ({
        title: String(event.title || "Untitled event").slice(0, 200),
        type: String(event.type || "personal").slice(0, 50),
        start_time: event.start_time || null,
        due_time: event.due_time || null,
        end_time: event.end_time || null,
        importance_score: event.importance_score ?? null,
        description:
          typeof event.description === "string"
            ? event.description.slice(0, 500)
            : null,
      }));

    const scheduleText = JSON.stringify({
      current_time: scheduleContext.current_time || new Date().toISOString(),
      timezone: scheduleContext.timezone || "Unknown",
      events: safeEvents,
    });

    const systemPrompt = `
You are 4.0, a personal academic co-pilot.

YOUR MAIN PURPOSE:
Help the student decide what to do based on THEIR REAL SCHEDULE and saved academic information, not generic productivity advice.

REAL SCHEDULE DATA:
The following JSON contains events retrieved from the student's 4.0 schedule.
Use it when answering questions about planning, priorities, deadlines, activities, and available time.

${scheduleText}

RULES FOR USING THE SCHEDULE:

1. Be specific. When asked what to work on, name actual assignments, tests, deadlines, or events from the supplied schedule.

2. Prioritize intelligently. Consider:
   - Events and deadlines coming up soon.
   - Overdue due dates, if any are listed.
   - The importance_score when available. Higher scores indicate greater importance.
   - Fixed activities that take up the student's time.
   - Whether the student has enough time to complete a task.
   - Conflicts between deadlines and scheduled activities.

3. Give an actionable recommendation. Say what to do first, what to do next, and approximately how long to spend on each task when the available information supports it.

4. Explain WHY. Connect your recommendation to the student's actual deadlines, importance scores, and calendar commitments.

5. Respect the current time and timezone supplied in the schedule data. Do not recommend an event that has already passed as though it is still upcoming.

6. Never invent assignments, exams, activities, due dates, grades, or calendar events. If the schedule does not contain enough information, say what is missing and ask a focused question.

7. A missing event in this data does not prove that the student has no other commitments. Be clear about uncertainty.

8. Do not assume an assignment is completed just because its due date has passed. If its status is unknown, describe it as potentially overdue and ask if needed.

9. If the student asks what can wait, compare the actual listed priorities and deadlines. Do not simply give a generic list of productivity tips.

10. If the student asks to add, edit, or delete an event, do not claim the change has happened unless an actual calendar/database action confirms it. For now, explain that you can help plan the change, but cannot directly change the calendar from this chat endpoint.

11. If the student asks what you remember about their habits or goals, do not pretend that schedule events are saved memories. Explain what information is available and ask for missing context when necessary.

12. Keep answers clear, friendly, and appropriately concise. Prefer a personalized plan over a lecture. Do not dump the entire schedule unless asked.

Before answering a planning question, inspect the supplied events and base the recommendation on them. If no relevant events exist, say so honestly rather than giving a fabricated personalized plan.
`.trim();

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
            {
              role: "system",
              content: systemPrompt,
            },
            ...safeMessages,
          ],
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
      return res.status(502).json({
        error: `Groq returned an invalid response (${groqResponse.status}).`,
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

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({
        error: "Groq returned no message content.",
      });
    }

    return res.status(200).json({ content });
  } catch (error) {
    console.error("Chat API error:", error);

    return res.status(500).json({
      error: error?.message || "Unexpected server error.",
    });
  }
}