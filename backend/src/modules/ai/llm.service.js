let groq = null;

try {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    const Groq = require("groq-sdk");
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    console.log("Groq AI initialized");
  } else {
    console.log("GROQ_API_KEY not set, AI features disabled");
  }
} catch (err) {
  console.log("Groq not available:", err.message);
}

const SYSTEM_PROMPT = `
You are ExpenseAI inside a group expense splitting app like Splitwise.

IMPORTANT RULES: