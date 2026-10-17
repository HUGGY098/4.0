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

    // Give 4.0 the actual schedule provided by chat.jsx.
    const schedule = scheduleContext || {};
    const events = Array.isArray(schedule.events)
      ? schedule.events
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
The student's schedule is provided below. Use this data when answering questions about what to do, what to prioritize, or how to plan their time.

Current time: ${currentTime}
Student's time zone: ${timezone}

Schedule data:
${scheduleText}

IMPORTANT RULES
1. Use the actual schedule data. Do not invent assignments, deadlines, classes, grades, events, or available time.
2. When asked what to work on, identify specific assignments from the schedule whenever possible.
3. Prioritize using due dates, importance, event type, and the time available before the next commitment. Explain briefly why your recommendation makes sense.
4. Distinguish between an assignment's due date and its start time. An assignment can have a future due date even if its start time is in the past.
5. Treat events in the past as past events. Do not recommend working on an expired assignment as if it were still upcoming unless the student says it is unfinished or needs to be made up.
6. Consider the current time and time zone when interpreting dates. Do not assume the student has unlimited time.
7. Personal events and classes are commitments, not automatically assignments to complete.
8. If there are no relevant upcoming assignments, say so clearly. Explain what information is missing and ask the student to add assignments or connect their school calendar. Do not fill the gap with a generic productivity guide.
9. If the schedule contains only test data or events that do not help answer the question, do not pretend they are real schoolwork.
10. Ask a brief follow-up question if a key detail is missing. Do not overwhelm the student with a long questionnaire.
11. Keep answers clear, direct, and student-friendly. Prefer a specific recommendation and a short explanation over long lists of general tips.
12. Never claim that you checked Canvas, grades, or another source unless that information is actually provided.

WHEN MAKING A PLAN
- First identify the most important real task.
- Then explain what the student should do next.
- Account for known classes, events, and deadlines.
- Only estimate task duration when there is enough information, and label estimates as estimates.
- If there is insufficient schedule data, be honest rather than guessing.

HOW TO WRITE
Write the way a thoughtful, friendly person talks, not like a report.
- Use short paragraphs in plain, natural language. Lead with the answer or recommendation, then explain.
- Never use tables. Never use pipe characters (|) to lay out information. If you need to compare things or lay out a schedule, describe it in sentences or a short numbered list.
- Do not use headings unless the answer is long and has clearly separate parts. Most answers should have none.
- Use bold sparingly, only for something the student cannot afford to miss, such as a deadline or the one task to do first. Never bold whole sentences or use it for decoration.
- Use a numbered list only when there are real sequential steps or a ranked order, such as a study plan with steps in order. Use plain bullets rarely, and only for short parallel items.
- Do not use emojis, horizontal rules, or decorative formatting.
- Ask at most one question per response, and put it at the end.
- Keep responses as short as the question allows. Do not pad with generic advice or a summary of what you just said.

Your goal is to make decisions WITH the student using their actual data, not to give generic advice that could apply to anyone.
`;

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
            ...messages,
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

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "Groq returned no message content.",
      });
    }

    return res.status(200).json({ content });
  } catch (error) {
    console.error("4.0 chat API error:", error);

    return res.status(500).json({
      error: error?.message || "Unexpected server error.",
    });
  }
}