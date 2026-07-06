// ============================================================
// Sehat Saathi - Alert Routes (Standalone MCP Tool Endpoint)
// ============================================================
// Allows direct invocation of the send_email_alert MCP Tool
// without going through the full prescription pipeline.
// Useful for testing and for setting medication reminders.
// ============================================================

import { Router } from "express";
import { sendEmailAlert } from "../mcp/sendEmailAlert.tool.js";

export const alertRouter = Router();

/**
 * POST /api/alert/send
 * Direct MCP Tool invocation endpoint
 */
alertRouter.post("/send", async (req, res, next) => {
  try {
    // req.maskedBody ensures PII in message content is masked
    const { patientEmail, subject, message, alertType = "REMINDER" } =
      req.maskedBody;

    if (!patientEmail || !subject || !message) {
      return res.status(400).json({
        error: "Missing required fields: patientEmail, subject, message",
      });
    }

    console.log(`📧 [Alert Route] Direct MCP Tool call: send_email_alert`);

    const result = await sendEmailAlert(patientEmail, subject, message, alertType);

    return res.status(200).json({
      success: true,
      tool: "send_email_alert",
      result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/alert/reminder
 * Schedule a medication reminder (simplified demo version)
 */
alertRouter.post("/reminder", async (req, res, next) => {
  try {
    const { patientEmail, medicineName, schedule } = req.maskedBody;

    if (!patientEmail || !medicineName) {
      return res.status(400).json({
        error: "Missing required fields: patientEmail, medicineName",
      });
    }

    const reminderMessage = `
💊 Medication Reminder from Sehat Saathi

It's time to take your medication:

Medicine: ${medicineName}
Schedule: ${schedule || "As prescribed"}

Please take your medication as directed by your healthcare provider.

Remember:
• Take at the same time each day for best results
• Do not skip doses unless advised by your doctor
• Keep track of any side effects and report to your healthcare provider

Stay healthy! 🌟
    `.trim();

    const result = await sendEmailAlert(
      patientEmail,
      `💊 Medication Reminder: ${medicineName} — Sehat Saathi`,
      reminderMessage,
      "REMINDER"
    );

    return res.status(200).json({
      success: true,
      tool: "send_email_alert",
      reminderFor: medicineName,
      result,
    });
  } catch (error) {
    next(error);
  }
});
