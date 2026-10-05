import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function runTest() {
  try {
    console.log("Connecting to Groq...");
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are BACCU, the official AI assistant representing the Baco Municipality in Oriental Mindoro."
        },
        {
          role: "user",
          content: "Hello, who are you?"
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
    });

    console.log("\nBACCU Response:");
    console.log(chatCompletion.choices[0]?.message?.content || "");
  } catch (error) {
    console.error("Error connecting to Groq:", error);
  }
}

runTest();