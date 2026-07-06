import cron from 'node-cron';
import { getAllInventories, getInventory } from './inventory.service.js';
import { sendEmailAlert } from '../mcp/sendEmailAlert.tool.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INVENTORY_FILE = path.join(__dirname, '../inventory.json');

/**
 * Helper to save inventory directly from cron to update lowStockAlertSent flag
 */
async function saveInventory(data) {
  await fs.writeFile(INVENTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Initializes and starts the background cron jobs.
 */
export function startCronJobs() {
  console.log("⏰ [Cron] Initializing background scheduler...");

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Format current time as HH:mm to match reminderTimes
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;
      
      const allInventories = await getAllInventories();
      let inventoryUpdated = false;

      // Loop through all users
      for (const [email, userData] of Object.entries(allInventories)) {
        if (!userData.medicines || userData.medicines.length === 0) continue;

        for (const med of userData.medicines) {
          // Logic 1: Time to take med
          if (med.reminderTimes && med.reminderTimes.includes(currentTime)) {
            const subject = `💊 Reminder: Time to take ${med.name}`;
            const message = `Hello,\n\nIt's time to take your medication: **${med.name}**.\n\nDosage: ${med.dosage || 'As prescribed'}\n\nMake sure to mark it as consumed in the Sehat Saathi dashboard!`;
            
            // We call sendEmailAlert without awaiting to prevent blocking the loop
            sendEmailAlert(email, subject, message, 'REMINDER').catch(err => {
              console.error(`❌ [Cron] Error sending reminder for ${med.name} to ${email}:`, err);
            });
          }

          // Logic 2: Low Stock
          if (med.stockLeft <= 3 && !med.lowStockAlertSent) {
            const subject = `⚠️ Low Stock Alert: ${med.name}`;
            const message = `Hello,\n\nYou are running low on **${med.name}**. You only have ${med.stockLeft} left.\n\nPlease refill your prescription soon to avoid missing any doses.`;
            
            sendEmailAlert(email, subject, message, 'WARNING').catch(err => {
              console.error(`❌ [Cron] Error sending low stock alert for ${med.name} to ${email}:`, err);
            });
            
            // Set flag so we don't spam them every minute
            med.lowStockAlertSent = true;
            inventoryUpdated = true;
          }
        }
      }

      // Save changes if any flags were updated
      if (inventoryUpdated) {
        await saveInventory(allInventories);
      }

    } catch (error) {
      console.error("❌ [Cron] Error during scheduled check:", error);
    }
  });

  console.log("⏰ [Cron] Medication Reminder & Low Stock checks started (every minute).");
}
