const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const SYSTEM_PROMPT = `
You are ExpenseAI inside a group expense splitting app like Splitwise.

IMPORTANT RULES:
- You ONLY explain balances between group members.
- You NEVER create bank accounts.
- You NEVER suggest checking or savings accounts.
- You NEVER invent new balances.
- You ONLY use the JSON data provided.
- If balances are empty, say: "No expenses recorded yet."
- Respond in the SAME language as the user.
- Be concise.
`;

exports.callLLM = async (prompt) => {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ]
  });

  return response.choices[0].message.content;
};

exports.callLLMStream = async (prompt, onToken) => {
  const stream = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    stream: true
  });

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) onToken(token);
  }
};
