// ============================================================
// Sehat Saathi - Prescription Routes
// Orchestrates the full 3-Agent Pipeline
// ============================================================

import { Router } from "express";
import {
  visionExtractorAgent
} from "../agents/visionExtractor.agent.js";
import {
  pharmacistAnalystAgent,
  pharmacistAnalystAgentDemo,
} from "../agents/pharmacistAnalyst.agent.js";
import {
  decisionActionAgent,
  decisionActionAgentDemo,
} from "../agents/decisionAction.agent.js";
import { addMedicines } from "../services/inventory.service.js";

export const prescriptionRouter = Router();

/**
 * POST /api/prescription/analyze
 * ============================================================
 * THE MAIN PIPELINE ENDPOINT
 *
 * Orchestrates the full multi-agent pipeline:
 *   1. PII Masking (already applied by middleware)
 *   2. Agent 1: Vision Extraction
 *   3. Agent 2: Drug Interaction Analysis
 *   4. Agent 3: Decision & Action (may invoke MCP Tool)
 *
 * Request Body:
 *   - imageBase64: string  (Base64 encoded prescription image)
 *   - mimeType: string     (e.g., 'image/jpeg')
 *   - patientEmail: string (for email alerts, optional)
 *   - patientContext: string (any additional context, will be PII-masked)
 *   - demoMode: boolean    (use mock data, no real API calls)
 *
 * Response:
 *   - Full pipeline result with all agent outputs
 * ============================================================
 */
prescriptionRouter.post("/analyze", async (req, res, next) => {
  const startTime = Date.now();

  try {
    // Use req.maskedBody instead of req.body — PII is already masked
    const {
      imageBase64,
      mimeType = "image/jpeg",
      patientEmail,
      patientContext,
      demoMode = false,
    } = req.maskedBody;

    // Validate required fields
    if (!imageBase64 && !demoMode) {
      return res.status(400).json({
        error: "Missing required field: imageBase64",
        hint: "Send a Base64 encoded prescription image, or set demoMode: true",
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("🚀 Sehat Saathi: Starting Multi-Agent Pipeline");
    console.log(`📧 Patient Email: ${patientEmail || "Not provided"}`);
    console.log(`🔧 Demo Mode: ${demoMode}`);
    console.log("=".repeat(60));

    // ============================================================
    // PIPELINE STEP 1: Vision Extraction (Agent 1)
    // ============================================================
    console.log("\n📌 PIPELINE STEP 1: Vision Extraction");
    const agent1Result = demoMode
      ? { success: false, error: "Demo mode for vision extraction is disabled." }
      : await visionExtractorAgent(imageBase64, mimeType);

    if (!agent1Result.success && !demoMode) {
      return res.status(422).json({
        error: "Vision extraction failed",
        agent: "VisionExtractorAgent",
        details: agent1Result.error,
      });
    }

    // ============================================================
    // PIPELINE STEP 2: Drug Interaction Analysis (Agent 2)
    // ============================================================
    console.log("\n📌 PIPELINE STEP 2: Pharmacist Analysis");
    const agent2Result = demoMode
      ? await pharmacistAnalystAgentDemo(agent1Result.data)
      : await pharmacistAnalystAgent(agent1Result.data);

    // ============================================================
    // PIPELINE STEP 3: Decision & Action (Agent 3 + MCP Tool)
    // ============================================================
    console.log("\n📌 PIPELINE STEP 3: Decision & Action");
    const agent3Result = demoMode
      ? await decisionActionAgentDemo(agent2Result.data, patientEmail)
      : await decisionActionAgent(
          agent2Result.data,
          patientEmail,
          agent1Result.data
        );

    // ============================================================
    // PIPELINE STEP 4: Save to Inventory
    // ============================================================
    if (patientEmail && agent1Result.success && agent1Result.data?.medicines?.length > 0) {
      console.log("\n📌 PIPELINE STEP 4: Saving to Inventory");
      try {
        await addMedicines(patientEmail, agent1Result.data.medicines);
      } catch (err) {
        console.error("❌ Failed to save medicines to inventory:", err);
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log(`✅ Sehat Saathi Pipeline Complete in ${totalTime}s`);
    console.log("=".repeat(60) + "\n");

    // Build the final response
    return res.status(200).json({
      success: true,
      pipelineVersion: "1.0.0",
      processingTimeSeconds: totalTime,
      securityNote: "All PII has been masked before LLM processing (HIPAA-aware)",
      demo: demoMode,

      agents: {
        // Agent 1 Results
        visionExtractor: {
          status: agent1Result.success ? "success" : "error",
          medicines: agent1Result.data.medicines,
          confidence: agent1Result.data.extractionConfidence,
          prescriberName: agent1Result.data.prescriberName, // Already [NAME REDACTED]
        },

        // Agent 2 Results
        pharmacistAnalyst: {
          status: agent2Result.success ? "success" : "error",
          interactions: agent2Result.data.interactions,
          overallSeverity: agent2Result.data.overallSeverity,
          summary: agent2Result.data.summary,
          recommendations: agent2Result.data.recommendations,
        },

        // Agent 3 Results
        decisionAction: {
          status: agent3Result.success ? "success" : "error",
          urgencyLevel: agent3Result.data.urgencyLevel,
          alertSent: agent3Result.data.shouldSendAlert,
          mcpToolInvoked: agent3Result.data.mcpToolCalled,
          emailProvider: agent3Result.data.emailResult?.provider || null,
          patientSummary: agent3Result.data.patientFacingSummary,
          nextSteps: agent3Result.data.nextSteps,
        },
      },

      // Flattened view for frontend consumption
      summary: {
        medicineCount: agent1Result.data.medicines?.length || 0,
        interactionCount: agent2Result.data.interactions?.length || 0,
        criticalInteractions:
          agent2Result.data.interactions?.filter((i) => i.severity === "CRITICAL")
            .length || 0,
        severity: agent2Result.data.overallSeverity,
        alertSent: agent3Result.data.shouldSendAlert,
        urgency: agent3Result.data.urgencyLevel,
        patientMessage: agent3Result.data.patientFacingSummary,
      },
    });
  } catch (error) {
    next(error); // Forward to global error handler
  }
});

/**
 * GET /api/prescription/demo
 * Quick demo endpoint — no image required
 */
prescriptionRouter.get("/demo", async (req, res, next) => {
  try {
    const demoRequest = {
      body: { demoMode: true, patientEmail: req.query.email || null },
    };

    // Simulate the full pipeline with demo data
    const agent1Result = { 
      success: true, 
      data: { 
        medicines: [
          { name: "Warfarin", dosage: "5mg", frequency: "Twice a day", duration: "30 days" },
          { name: "Aspirin", dosage: "81mg", frequency: "Once a day", duration: "30 days" },
          { name: "Ibuprofen", dosage: "400mg", frequency: "Every 8 hours", duration: "10 days" }
        ], 
        prescriberName: "[NAME REDACTED]" 
      } 
    };
    const agent2Result = await pharmacistAnalystAgentDemo(agent1Result.data);
    const agent3Result = await decisionActionAgentDemo(
      agent2Result.data,
      req.query.email
    );

    // Add demo medicines to inventory if email provided
    if (req.query.email && agent1Result.data?.medicines?.length > 0) {
      try {
        await addMedicines(req.query.email, agent1Result.data.medicines);
      } catch (err) {
        console.error("❌ Failed to save demo medicines to inventory:", err);
      }
    }

    return res.status(200).json({
      success: true,
      demo: true,
      message: "Demo pipeline executed with mock prescription data (Warfarin + Aspirin + Ibuprofen)",
      agents: {
        visionExtractor: agent1Result,
        pharmacistAnalyst: agent2Result,
        decisionAction: agent3Result,
      },
    });
  } catch (error) {
    next(error);
  }
});
