// ============================================================
// Sehat Saathi - Main Server Entry Point
// Multi-Agent Medication Management Concierge
// Kaggle Hackathon Demo
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";

// Route Imports
import { prescriptionRouter } from "./routes/prescription.routes.js";
import { alertRouter } from "./routes/alert.routes.js";
import { inventoryRouter } from "./routes/inventory.routes.js";
import { startCronJobs } from "./services/cron.service.js";

// ============================================================
// MIDDLEWARE: PII MASKING MIDDLEWARE (KAGGLE REQUIREMENT #1)
// This middleware intercepts ALL incoming requests and sanitizes
// the request body BEFORE any LLM ever sees the data.
// This is a critical security feature demonstrating PII awareness.
// ============================================================
import { piiMaskingMiddleware } from "./middleware/piiMasking.middleware.js";

const app = express();
const PORT = process.env.PORT || 5000;

// --- Standard Middleware ---
app.use(
  cors({
    origin: true, // Allow all origins for the hackathon demo (e.g., if Next.js runs on 3001)
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" })); // 50mb limit for Base64 image uploads
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ============================================================
// APPLY PII MASKING GLOBALLY (BEFORE ALL ROUTES)
// Every request body is sanitized here. Real patient names,
// phone numbers, and ages are masked BEFORE reaching any agent.
// ============================================================
app.use(piiMaskingMiddleware);

// --- Health Check ---
app.get("/", (req, res) => {
  res.json({
    status: "✅ Sehat Saathi Backend is running",
    version: "1.0.0-hackathon",
    agents: [
      "Vision Extractor Agent (Gemini 1.5 Pro)",
      "Pharmacist Analyst Agent (GPT-4o)",
      "Decision & Action Agent (LangChain + MCP Tool)",
    ],
    security: "PII Masking: ACTIVE on all endpoints",
  });
});

// --- API Routes ---
// /api/prescription → Triggers the full 3-Agent Pipeline
app.use("/api/prescription", prescriptionRouter);
// /api/alert → Standalone MCP Tool endpoint
app.use("/api/alert", alertRouter);
// /api/inventory → Medication Inventory & Reminder System
app.use("/api/inventory", inventoryRouter);

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.message);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
    // In production, never expose stack traces to clients
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║       🏥 Sehat Saathi Backend             ║
  ║       Running on port ${PORT}              ║
  ║       PII Masking:    ACTIVE             ║
  ║       Multi-Agent:    READY              ║
  ║       MCP Tool:       INITIALIZED        ║
  ╚══════════════════════════════════════════╝
  `);
  startCronJobs();
});

export default app;
