import { Router } from "express";
import { getInventory, consumeMedicine, removeMedicine, refillMedicine } from "../services/inventory.service.js";
import { sendEmailAlert } from "../mcp/sendEmailAlert.tool.js";

export const inventoryRouter = Router();

/**
 * GET /api/inventory?email=xxx
 * Retrieves the user's medication inventory
 */
inventoryRouter.get("/", async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "Missing required query parameter: email" });
    }
    
    const inventory = await getInventory(email);
    return res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inventory/consume
 * Decreases stockLeft by 1 for a specific medicine
 */
inventoryRouter.post("/consume", async (req, res, next) => {
  try {
    // We use req.body directly here because these routes do not invoke LLMs, 
    // and we need the real, unmasked email to update the database and send alerts.
    const email = req.body.email;
    const medicineId = req.body.medicineId;
    
    if (!email || !medicineId) {
      return res.status(400).json({ error: "Missing required fields: email, medicineId" });
    }
    
    const updatedMedicine = await consumeMedicine(email, medicineId);
    
    return res.status(200).json({
      success: true,
      message: "Medicine consumed successfully",
      medicine: updatedMedicine
    });
  } catch (error) {
    if (error?.message && (error.message.includes("not found") || error.message.includes("out of stock"))) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/inventory/force-alert
 * A 'cheat' endpoint for hackathon demo to instantly trigger the email MCP tool
 */
inventoryRouter.post("/force-alert", async (req, res, next) => {
  try {
    const email = req.body.email;
    const type = req.maskedBody?.type || req.body.type || "REMINDER";
    const medicineName = req.body.medicineName || "your medication";
    
    if (!email) {
      return res.status(400).json({ error: "Missing required field: email" });
    }
    
    let subject, message;
    
    if (type === "LOW_STOCK") {
      subject = `⚠️ DEMO: Low Stock Alert - ${medicineName}`;
      message = `This is a forced demo alert. You are running low on **${medicineName}**.\n\nPlease refill your prescription soon.`;
    } else {
      subject = `💊 DEMO: Medication Reminder - ${medicineName}`;
      message = `This is a forced demo alert.\n\nIt's time to take your medication: **${medicineName}**.\n\nMake sure to mark it as consumed in the Sehat Saathi dashboard!`;
    }
    
    const result = await sendEmailAlert(email, subject, message, type === "LOW_STOCK" ? "WARNING" : "REMINDER");
    
    return res.status(200).json({
      success: true,
      message: "Forced alert triggered successfully",
      result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inventory/remove
 * Removes a medicine from the user's inventory
 */
inventoryRouter.post("/remove", async (req, res, next) => {
  try {
    const email = req.body.email;
    const medicineId = req.body.medicineId;
    
    if (!email || !medicineId) {
      return res.status(400).json({ error: "Missing required fields: email, medicineId" });
    }
    
    await removeMedicine(email, medicineId);
    
    return res.status(200).json({
      success: true,
      message: "Medicine removed successfully"
    });
  } catch (error) {
    if (error?.message && error.message.includes("not found")) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/inventory/refill
 * Refills stockLeft by 10 for a specific medicine
 */
inventoryRouter.post("/refill", async (req, res, next) => {
  try {
    const email = req.body.email;
    const medicineId = req.body.medicineId;
    const amount = req.body.amount ? parseInt(req.body.amount) : 10;
    
    if (!email || !medicineId) {
      return res.status(400).json({ error: "Missing required fields: email, medicineId" });
    }
    
    const updatedMedicine = await refillMedicine(email, medicineId, amount);
    
    return res.status(200).json({
      success: true,
      message: "Medicine refilled successfully",
      medicine: updatedMedicine
    });
  } catch (error) {
    if (error?.message && error.message.includes("not found")) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});
