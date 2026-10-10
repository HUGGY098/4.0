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

    const { messages } = req.body || {};

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages are required.",
      });
    }

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
              content:
                "You are 4.0, an academic co-pilot. Give helpful, clear, concise answers. Help the student plan schoolwork, understand assignments, manage time, and make good academic decisions.",
            },
            ...messages,
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    const text = await groqResponse.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: `Groq returned a non-JSON response (${groqResponse.status}).`,
      });
    }

    if (!groqResponse.ok) {
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
    console.error("Groq API error:", error);

    return res.status(500).json({
      error: error?.message || "Unexpected server error.",
    });
  }
}