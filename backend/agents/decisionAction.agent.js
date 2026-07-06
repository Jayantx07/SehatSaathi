// ============================================================
// Sehat Saathi - Agent 3: Decision & Action Agent (Groq Version)
// ============================================================
// AGENTIC BEHAVIOR (THE CORE OF THE SYSTEM):
//   This is the "orchestrator" agent — the one that makes
//   autonomous decisions and TAKES ACTIONS in the real world.
//
//   Agent 3 demonstrates true agentic behavior because:
//   1. It receives structured analysis from Agent 2
//   2. It REASONS about whether action is required
//   3. It autonomously decides to invoke the MCP Tool (send_email_alert)
//   4. It self-determines the urgency, subject, and content of alerts
//   5. It produces a final patient-facing summary
//
//   This mirrors real-world LLM agent architectures where the model
//   selects tools from a "tool registry" (our MCP server) and calls
//   them based on reasoning, not hard-coded if/else logic.
//
// DECISION LOGIC:
//   CRITICAL severity  → Always send email alert (CRITICAL type)
//   MODERATE severity  → Send email alert (WARNING type)
//   LOW severity       → Log warning, no email
//   NONE              → All clear, no action
//
// INPUT:  { analysisData, patientEmail, prescriptionData }
// OUTPUT: { decision, actionTaken, emailResult, finalSummary }
// ============================================================

import { ChatGroq } from "@langchain/groq";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { sendEmailAlert, sendEmailAlertSchema } from "../mcp/sendEmailAlert.tool.js";
import { maskPII } from "../middleware/piiMasking.middleware.js";

const decisionLLM = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
  apiKey: process.env.GROQ_API_KEY,
});

const outputParser = new StringOutputParser();

/**
 * DecisionActionAgent
 * ============================================================
 * AGENTIC BEHAVIOR: Tool-augmented reasoning and autonomous action
 *
 * This agent receives the pharmacist's analysis and makes an
 * autonomous decision about what action to take. It has access
 * to the MCP Tool registry (send_email_alert) and invokes tools
 * based on its own reasoning — not hardcoded business logic.
 *
 * @param {Object} analysisData      - Output from Agent 2
 * @param {string} patientEmail      - Patient's email for alerts
 * @param {Object} prescriptionData  - Original prescription data
 * @returns {Promise<Object>}        - Decision result with actions taken
 */
export async function decisionActionAgent(
  analysisData,
  patientEmail,
  prescriptionData
) {
  console.log("🤖 [Agent 3: Decision & Action] Starting autonomous decision-making...");
  console.log(`🤖 [Agent 3] Pharmacist reported severity: ${analysisData.overallSeverity}`);

  // ============================================================
  // STEP 1: LLM-BASED REASONING (AGENTIC DECISION MAKING)
  // We give the agent the tool schema and let it decide whether
  // to call the tool and what parameters to use.
  // This is the "agentic" part — the LLM reasons, not our code.
  // ============================================================
  const systemPrompt = `You are the Sehat Saathi Decision Agent — the final arbiter of patient safety actions.

You have access to the following MCP Tool:
${JSON.stringify(sendEmailAlertSchema, null, 2).replace(/{/g, "{{").replace(/}/g, "}}")}

Your job:
1. Review the pharmacist's drug interaction analysis
2. Decide if an alert email SHOULD be sent to the patient
3. If yes, determine the alert type, subject, and message content
4. Generate a patient-friendly final summary

Decision Rules:
- CRITICAL severity → MUST send email with alertType: "CRITICAL"
- MODERATE severity → SHOULD send email with alertType: "WARNING"  
- LOW severity → DO NOT send email, just note it in summary
- NONE → No action needed

IMPORTANT: 
- The patient email is: {patientEmail}
- Keep all messaging empathetic and actionable
- Never include raw medical jargon without explanation
- PII has already been masked — do not attempt to guess patient identity

Return ONLY valid JSON:
{{
  "shouldSendAlert": true or false,
  "alertType": "CRITICAL" | "WARNING" | "REMINDER" | null,
  "emailSubject": "string or null",
  "emailMessage": "string (full email body, plain text) or null",
  "reasoning": "Why you made this decision",
  "patientFacingSummary": "1-2 paragraph plain-English summary for the patient",
  "urgencyLevel": "IMMEDIATE" | "WITHIN_24H" | "MONITOR" | "ALL_CLEAR",
  "nextSteps": ["Array of patient next steps"]
}}`;

  const humanPrompt = `PHARMACIST ANALYSIS REPORT:
Overall Severity: {overallSeverity}
Requires Alert: {requiresAlert}

Interactions Found:
{interactionsSummary}

Clinical Summary:
{clinicalSummary}

Patient Recommendations from Pharmacist:
{recommendations}

Based on this analysis, make your decision and generate the appropriate response.`;

  const decisionPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate(humanPrompt),
  ]);

  const decisionChain = decisionPrompt.pipe(decisionLLM).pipe(outputParser);

  const interactionsSummary =
    analysisData.interactions
      ?.map(
        (i) =>
          `• ${i.drugs.join(" + ")} [${i.severity}]: ${i.clinicalEffect}`
      )
      .join("\n") || "None";

  let decisionData;
  let emailResult = null;

  try {
    console.log("🤖 [Agent 3] Invoking Groq (Llama-3.3-70b-versatile) for autonomous decision-making...");

    const rawDecision = await decisionChain.invoke({
      patientEmail: patientEmail,
      overallSeverity: analysisData.overallSeverity,
      requiresAlert: analysisData.requiresAlert,
      interactionsSummary,
      clinicalSummary: analysisData.summary,
      recommendations: analysisData.recommendations?.join("\n") || "None",
    });

    const cleanJson = rawDecision
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    decisionData = JSON.parse(cleanJson);
    console.log(
      `🤖 [Agent 3] Decision made: shouldSendAlert=${decisionData.shouldSendAlert}, urgency=${decisionData.urgencyLevel}`
    );
  } catch (llmError) {
    // FALLBACK: If LLM reasoning fails, use deterministic rules
    console.warn(
      `⚠️ [Agent 3] LLM decision failed (${llmError.message}), using deterministic fallback rules...`
    );
    decisionData = buildFallbackDecision(analysisData, patientEmail);
  }

  // ============================================================
  // STEP 2: AUTONOMOUS TOOL INVOCATION (MCP TOOL CALL)
  // Agent 3 autonomously calls the send_email_alert MCP tool
  // if its reasoning determined that an alert is necessary.
  // THIS IS THE KEY AGENTIC BEHAVIOR — the agent acts in the world.
  // ============================================================
  if (decisionData.shouldSendAlert && patientEmail) {
    console.log(
      `🤖 [Agent 3] → Autonomously invoking MCP Tool: send_email_alert`
    );
    console.log(
      `🤖 [Agent 3] → Alert type: ${decisionData.alertType} | Subject: ${decisionData.emailSubject}`
    );

    // SECURITY: Final PII mask on email content before sending
    const { maskedText: maskedEmailBody } = maskPII(
      decisionData.emailMessage || ""
    );

    try {
      // === MCP TOOL INVOCATION ===
      emailResult = await sendEmailAlert(
        patientEmail,
        decisionData.emailSubject,
        maskedEmailBody,
        decisionData.alertType
      );

      console.log(
        `✅ [Agent 3] MCP Tool executed successfully. Email sent via: ${emailResult.provider}`
      );
    } catch (emailError) {
      console.error(
        `❌ [Agent 3] MCP Tool invocation failed: ${emailError.message}`
      );
      emailResult = {
        success: false,
        error: emailError.message,
        provider: "none",
      };
    }
  } else if (!patientEmail) {
    console.log(
      "🤖 [Agent 3] No patient email provided — skipping email alert."
    );
  } else {
    console.log(
      `🤖 [Agent 3] Decision: No alert needed (urgency: ${decisionData.urgencyLevel})`
    );
  }

  return {
    success: true,
    agent: "DecisionActionAgent",
    data: {
      decision: decisionData.reasoning,
      shouldSendAlert: decisionData.shouldSendAlert,
      urgencyLevel: decisionData.urgencyLevel,
      alertType: decisionData.alertType,
      patientFacingSummary: decisionData.patientFacingSummary,
      nextSteps: decisionData.nextSteps || [],
      emailResult,
      mcpToolCalled: decisionData.shouldSendAlert && !!patientEmail,
    },
  };
}

/**
 * Deterministic fallback decision when LLM is unavailable
 * Uses simple rule-based logic as a safety net
 */
function buildFallbackDecision(analysisData, patientEmail) {
  const severity = analysisData.overallSeverity;
  const shouldSendAlert = severity === "CRITICAL" || severity === "MODERATE";

  const alertMessages = {
    CRITICAL: {
      type: "CRITICAL",
      subject: "🚨 URGENT: Critical Drug Interaction Detected - Sehat Saathi",
      message: `Sehat Saathi has detected a CRITICAL drug interaction in your prescription.\n\n${analysisData.summary}\n\nRecommendations:\n${analysisData.recommendations?.join("\n") || "Please consult your doctor immediately."}`,
      urgency: "IMMEDIATE",
    },
    MODERATE: {
      type: "WARNING",
      subject: "⚠️ Important: Drug Interaction Warning - Sehat Saathi",
      message: `Sehat Saathi has identified a drug interaction that requires attention.\n\n${analysisData.summary}\n\nRecommendations:\n${analysisData.recommendations?.join("\n") || "Please consult your pharmacist."}`,
      urgency: "WITHIN_24H",
    },
  };

  const alertInfo = alertMessages[severity] || {
    type: null,
    subject: null,
    message: null,
    urgency: "MONITOR",
  };

  return {
    shouldSendAlert,
    alertType: alertInfo.type,
    emailSubject: alertInfo.subject,
    emailMessage: alertInfo.message,
    reasoning: `Deterministic fallback: ${severity} severity detected`,
    patientFacingSummary: analysisData.summary,
    urgencyLevel: alertInfo.urgency,
    nextSteps: analysisData.recommendations || [],
  };
}

// --- Demo Mode ---
export async function decisionActionAgentDemo(analysisData, patientEmail) {
  console.log("🤖 [Agent 3: DEMO MODE] Executing decision logic...");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const emailResult = {
    success: true,
    messageId: `demo-${Date.now()}`,
    provider: "Demo-Simulation",
    alertType: "CRITICAL",
    timestamp: new Date().toISOString(),
    note: "Email simulated for demo",
  };

  return {
    success: true,
    agent: "DecisionActionAgent",
    demo: true,
    data: {
      decision:
        "CRITICAL severity detected. Warfarin + Aspirin + Ibuprofen combination poses life-threatening bleeding risk. Autonomous alert initiated via MCP Tool.",
      shouldSendAlert: true,
      urgencyLevel: "IMMEDIATE",
      alertType: "CRITICAL",
      patientFacingSummary:
        "⚠️ Sehat Saathi has detected a potentially dangerous combination of medications in your prescription. The combination of Warfarin (blood thinner), Aspirin, and Ibuprofen significantly increases your risk of serious bleeding. Please do NOT take these medications together and contact your doctor immediately.",
      nextSteps: [
        "Call your prescribing physician TODAY before taking any of these medications",
        "Show this alert to your pharmacist when picking up your prescription",
        "If you experience unusual bleeding or bruising, go to the emergency room immediately",
        "Consider asking your doctor about safer alternatives to Ibuprofen (e.g., Acetaminophen/Paracetamol)",
      ],
      emailResult,
      mcpToolCalled: true,
    },
  };
}
