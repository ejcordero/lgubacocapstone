import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// ✅ API KEY VALIDATION (Added)
// ============================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_key_here' || GROQ_API_KEY === '') {
  console.warn('\n⚠️  WARNING: GROQ_API_KEY not configured!');
  console.warn('   Chat will NOT work until you add a valid key.');
  console.warn('');
  console.warn('   Steps to fix:');
  console.warn('   1. Get free key: https://console.groq.com/keys');
  console.warn('   2. Add to BacoFrontend/.env:');
  console.warn('      GROQ_API_KEY=gsk_your_actual_key_here');
  console.warn('   3. Restart this server\n');
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

const baccuSystemPrompt = `
You are BACCU, the official AI assistant for Baco Municipality, Oriental Mindoro, Philippines.

⚠️ CRITICAL RULE - OFF-TOPIC QUESTIONS:
You MUST strictly REFUSE to answer ANY question that is NOT about:
- Baco Municipality (demographics, geography, barangays, officials)
- Baco's history, culture, festivals, tourism
- Baco's local government services
- Any topic specifically related to Baco

When a user asks something UNRELATED to Baco, you MUST respond with ONLY this exact message:
"I'm sorry, I can only help with questions about Baco Municipality. Please ask me about Baco's barangays, officials, tourist spots, history, or local services."

DO NOT answer questions about:
- Other municipalities or cities
- General Philippines knowledge (unless specifically about Baco)
- World events, sports, entertainment, technology, etc.
- Weather (unless specific to Baco)
- Personal advice, jokes, chit-chat
- Anything outside the scope of Baco Municipality

STRICT RULES FOR BACCO-RELATED QUESTIONS:
1. ONLY use facts from the KNOWLEDGE BASE below. Never invent details.
2. Answer first, details second. No intro phrases like "Based on our records..." or "Here is an overview...". Just answer.
3. Keep replies to 2-3 sentences for simple facts. For lists, show only the most relevant items — never dump everything.
4. Use plain dashes (-) for bullet lists only when listing 3 or more items. Otherwise write a sentence.
5. End every reply with one short follow-up question.
6. Plain text only. No markdown: no **bold**, no *italic*, no # headers, no "Label: Value" pairs.

EXAMPLE BEHAVIOR:

User: "Tell me about Baco"
BACCU: "Baco is a 1st class coastal municipality in Oriental Mindoro with 27 barangays and around 40,000 residents. It's known for Mt. Halcon — the highest peak in the province — and the annual Banana Festival. Want to know about its history, tourism spots, or local government?"

User: "Who is the mayor?"
BACCU: "The current mayor is Allan 'AR' Roldan, with Reynaldo A. Marco as vice mayor. Anything else you'd like to know about Baco's local government?"

User: "What are the tourist spots?"
BACCU: "Baco's top spots include:
- Mt. Halcon (2,586 m, highest peak in the province)
- Tiboy Rapids (Sta. Rosa 2)
- Kambal-Bato Mountain River Resort (San Ignacio)
- Infinity Farm (Mangangan River)
There are also several others like Hidden Paradise, JC Resort, and Tribu Resort. Which one interests you?"

User: "What is the population of Baco?"
BACCU: "Baco has a population of 40,159 as of the 2024 census. Want to know more about its barangays or land area?"

User: "What is the history of Baco?"
BACCU: "Baco was once known as Voco, Bato, and Bacoy, and served as the first capital of Mindoro from 1575 to 1679. Its name likely comes from 'paco', an edible fern common in the area. Foundation Day is celebrated every January 25. Want to know more about its culture or local government?"

User: "Who won the NBA finals last night?" 
BACCU: "I'm sorry, I can only help with questions about Baco Municipality. Please ask me about Baco's barangays, officials, tourist spots, history, or local services."

User: "What is the capital of France?"
BACCU: "I'm sorry, I can only help with questions about Baco Municipality. Please ask me about Baco's barangays, officials, tourist spots, history, or local services."

User: "Tell me a joke"
BACCU: "I'm sorry, I can only help with questions about Baco Municipality. Please ask me about Baco's barangays, officials, tourist spots, history, or local services."

BACO MUNICIPALITY KNOWLEDGE BASE:
### Demographics & Geography
* Classification: 1st class coastal municipality. Mountainous with lowland (slope > 18%).
* Population: 40,159 (2024 census). Total land area: 31,126.023 hectares.
* 27 Barangays & 2020 Population: Alag (1,166), Bangkatan (2,387), Burbuli (594), Catwiran I (1,466), Catwiran II (1,507), Dulangan I (1,774), Dulangan II (2,749), Lumang Bayan (647), Malapad (505), Mangangan I (2,689), Mangangan II (799), Mayabig (1,701), Pambisan (1,201), Pulang-Tubig (962), Putican-Cabulo (502), San Andres (321), San Ignacio (2,392), Santa Cruz (433), Santa Rosa I (2,129), Santa Rosa II (1,711), Tabon-tabon (1,584), Tagumpay (1,788), Water (1,588), Baras (1,563), Bayanan (1,518), Lantuyang (1,281), Poblacion (2,860).
### Local Government Officials (2022-2025)
* Mayor: Allan "AR" Roldan.
* Vice Mayor: Reynaldo A. Marco.
* Congressman (1st District): Arnan Panaligan.
### History & Etymology
* Former names: Voco, Bato, Bacoy. 
* Served as the first official capital of Mindoro (1575 to 1679).
* Etymology: Derived from "paco" (edible fern) or "baku-bako" (rough road/potholes from frequent flooding).
* Foundation Day: January 25, 1921.
### Tourism & Resorts
* Mt. Halcon: Highest peak in the province at 2,586 meters (8,484 ft). 
* Resorts: Infinity Farm (Mangangan River), Tagbungan Mountain Resort (Dulangan III), Tampisaw Resort (San Ignacio), Tiboy Rapids (Sta. Rosa 2), Kambal-Bato Mountain River Resort (San Ignacio), Janaki Devie's Resort, Alkhaimah, Bayanan River, Delfinity, Hidden Paradise, JC Resort, Tribu Resort.
* Festivals: Banana Festival.
`;

// Strips any leftover markdown the model sneaks through
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold** → plain
    .replace(/\*(.*?)\*/g, '$1')        // *italic* → plain
    .replace(/^#{1,6}\s+/gm, '')        // ## Heading → plain
    .replace(/^\*\s+/gm, '- ')          // * bullet → - bullet
    .trim();
}

// ============================================
// ✅ HEALTH CHECK ENDPOINT (Added)
// ============================================

app.get("/api/chat/health", (req, res) => {
  const hasValidKey = GROQ_API_KEY && 
                      GROQ_API_KEY !== 'your_groq_key_here' && 
                      GROQ_API_KEY !== '';
  
  res.json({
    status: hasValidKey ? 'ok' : 'warning',
    service: 'BACCU Chat API',
    version: '1.0.0',
    apiKeyConfigured: hasValidKey,
    timestamp: new Date().toISOString(),
    endpoints: {
      chat: 'POST /api/chat',
      health: 'GET /api/chat/health'
    }
  });
});

// ============================================
// ✅ MAIN CHAT ENDPOINT (Enhanced Error Handling)
// ============================================

app.post("/api/chat", async (req, res) => {
  try {
    // ✅ Check API Key First
    if (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_key_here' || GROQ_API_KEY === '') {
      return res.status(503).json({
        error: "Service Unavailable",
        message: "GROQ_API_KEY not configured. Contact administrator."
      });
    }

    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Message is required",
        hint: "Send { \"message\": \"your question\" }"
      });
    }

    // ✅ Log incoming request (truncated for privacy)
    console.log(`📨 [${new Date().toLocaleTimeString()}] Message: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: baccuSystemPrompt },
        { role: "user", content: userMessage }
      ],
      model: "openai/gpt-oss-20b",
      temperature: 0.0,
    });

    const raw = chatCompletion.choices[0]?.message?.content ?? "";
    const clean = stripMarkdown(raw);

    // ✅ Log response (truncated)
    console.log(`✅ [${new Date().toLocaleTimeString()}] Reply: "${clean.substring(0, 60)}${clean.length > 60 ? '...' : ''}"`);

    res.json({ reply: clean });

  } catch (error) {
    // ✅ Specific Error Handling
    console.error(`❌ [${new Date().toLocaleTimeString()}] Error:`, error.message);

    // Authentication / Invalid API Key
    if (error.message.includes('401') || 
        error.message.includes('authentication') || 
        error.message.includes('invalid_api_key') ||
        error.status === 401) {
      return res.status(401).json({
        error: "Authentication Failed",
        message: "Invalid GROQ_API_KEY. Check your .env file."
      });
    }

    // Rate Limiting
    if (error.message.includes('rate_limit') || 
        error.message.includes('429') ||
        error.status === 429) {
      return res.status(429).json({
        error: "Rate Limited",
        message: "Too many requests. Please wait a moment and try again.",
        retryAfter: "30 seconds"
      });
    }

    // Network / Connection Errors
    if (error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.message.includes('fetch failed') ||
        error.message.includes('network')) {
      return res.status(503).json({
        error: "Service Unavailable",
        message: "Cannot connect to AI service. Check internet connection."
      });
    }

    // Model Not Found
    if (error.message.includes('model_not_found') || error.status === 404) {
      return res.status(500).json({
        error: "Model Error",
        message: "AI model unavailable. Try again later."
      });
    }

    // Context Too Long
    if (error.message.includes('context_length') || error.message.includes('max_tokens')) {
      return res.status(400).json({
        error: "Request Too Long",
        message: "Your message is too long. Please shorten it."
      });
    }

    // Generic fallback
    res.status(500).json({
      error: "AI Engine Error",
      message: "Failed to get response. Please try again.",
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// ============================================
// ✅ GLOBAL ERROR HANDLERS (Added)
// ============================================

// Catch-all for unhandled routes
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found on chat service`,
    availableRoutes: [
      "POST /api/chat - Send message to BACCU",
      "GET /api/chat/health - Check service status"
    ]
  });
});

// Global error middleware
app.use((err, req, res, next) => {
  console.error('❌ [CHAT] Unhandled Error:', err.message);
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong on the chat server"
  });
});

// ============================================
// ✅ SERVER STARTUP WITH ERROR HANDLING (Added)
// ============================================

const PORT = process.env.CHAT_API_PORT || 3001;
let isListening = false;

const server = app.listen(PORT, '0.0.0.0', () => {
  isListening = true;
  console.log(`\n🤖 BACCU Chat API running on http://localhost:${PORT}`);
  console.log(`   Health:     http://localhost:${PORT}/api/chat/health`);
  console.log(`   Endpoint:   http://localhost:${PORT}/api/chat`);
  
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_key_here' || GROQ_API_KEY === '') {
    console.warn(`\n   ⚠️  API KEY NOT CONFIGURED - Chat will fail!\n`);
  } else {
    console.log(`   ✅ API Key configured\n`);
  }
});

// Handle port conflicts
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    if (isListening) {
      console.warn(`\n⚠️  Port ${PORT} dual-stack warning (server still running)\n`);
      return;
    }
    console.error(`\n❌ Port ${PORT} already in use!`);
    console.error(`   Another process is using this port.`);
    console.error(`   Fix: npx kill-port ${PORT}\n`);
    process.exit(1);
  }
  
  console.error('\n❌ Failed to start Chat API:', error.message);
  process.exit(1);
});

// ============================================
// ✅ GRACEFUL SHUTDOWN (Added)
// ============================================

function shutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down Chat API...`);
  
  server.close(() => {
    console.log('✅ Chat API stopped');
    process.exit(0);
  });
  
  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('⚠️  Forced exit');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  shutdown('ERROR');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});