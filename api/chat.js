import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages are required.",
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are 4.0, an academic co-pilot. Give helpful, clear, concise answers. Help the student plan schoolwork, understand assignments, manage time, and make good academic decisions.",
        },
        ...messages,
      ],
    });

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "Groq returned no response.",
      });
    }

    return res.status(200).json({
      content,
    });
  } catch (error) {
    console.error("Groq error:", error);

    return res.status(500).json({
      error: error.message || "Groq request failed.",
    });
  }
}