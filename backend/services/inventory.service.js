import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INVENTORY_FILE = path.join(__dirname, '../inventory.json');

/**
 * Ensures the inventory.json file exists.
 */
async function ensureFileExists() {
  try {
    await fs.access(INVENTORY_FILE);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(INVENTORY_FILE, JSON.stringify({}), 'utf-8');
    }
  }
}

/**
 * Gets the entire inventory data.
 */
export async function getAllInventories() {
  await ensureFileExists();
  const data = await fs.readFile(INVENTORY_FILE, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

/**
 * Gets inventory for a specific email.
 */
export async function getInventory(email) {
  const data = await getAllInventories();
  return data[email] || { medicines: [] };
}

/**
 * Saves the entire inventory data.
 */
async function saveInventory(data) {
  await fs.writeFile(INVENTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Intelligently generates reminder times based on frequency string.
 * This is simplified logic for the hackathon.
 */
function generateReminderTimes(frequency) {
  const freqLower = frequency ? frequency.toLowerCase() : '';
  
  if (freqLower.includes('twice') || freqLower.includes('2 times') || freqLower.includes('12 hours')) {
    return ['09:00', '21:00'];
  } else if (freqLower.includes('thrice') || freqLower.includes('3 times') || freqLower.includes('8 hours')) {
    return ['08:00', '14:00', '20:00'];
  } else if (freqLower.includes('four') || freqLower.includes('4 times') || freqLower.includes('6 hours')) {
    return ['06:00', '12:00', '18:00', '23:59'];
  } else if (freqLower.includes('night') || freqLower.includes('bedtime')) {
    return ['21:00'];
  }
  
  // Default to once a day in the morning
  return ['09:00'];
}

export async function addMedicines(email, extractedMedicines) {
  if (!email || !extractedMedicines || extractedMedicines.length === 0) return;

  const data = await getAllInventories();
  
  if (!data[email]) {
    data[email] = { medicines: [] };
  }

  let addedCount = 0;
  for (const med of extractedMedicines) {
    const existingIndex = data[email].medicines.findIndex(m => m.name.toLowerCase() === med.name.toLowerCase());
    
    if (existingIndex !== -1) {
      // Medicine exists, refill stock Left
      data[email].medicines[existingIndex].stockLeft = Math.max(10, data[email].medicines[existingIndex].stockLeft);
      // Update dosage and frequency in case they changed
      data[email].medicines[existingIndex].dosage = med.dosage;
      data[email].medicines[existingIndex].frequency = med.frequency;
    } else {
      data[email].medicines.push({
        id: uuidv4(),
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        stockLeft: 10,
        reminderTimes: generateReminderTimes(med.frequency),
        lowStockAlertSent: false
      });
      addedCount++;
    }
  }

  await saveInventory(data);
  
  console.log(`📦 [Inventory] Added ${addedCount} new medicines for ${email} (and updated existing)`);
  return data[email];
}

/**
 * Consumes a medicine (decreases stock by 1).
 */
export async function consumeMedicine(email, medicineId) {
  const data = await getAllInventories();
  
  if (!data[email] || !data[email].medicines) {
    throw new Error('User inventory not found');
  }
  
  const medIndex = data[email].medicines.findIndex(m => m.id === medicineId);
  if (medIndex === -1) {
    throw new Error('Medicine not found in inventory');
  }
  
  if (data[email].medicines[medIndex].stockLeft > 0) {
    data[email].medicines[medIndex].stockLeft -= 1;
    
    // Reset low stock alert if somehow it goes above 3 again (e.g. refill later)
    if (data[email].medicines[medIndex].stockLeft > 3) {
      data[email].medicines[medIndex].lowStockAlertSent = false;
    }
    
    await saveInventory(data);
    return data[email].medicines[medIndex];
  } else {
    throw new Error('Medicine is out of stock');
  }
}

/**
 * Removes a medicine from the inventory completely.
 */
export async function removeMedicine(email, medicineId) {
  const data = await getAllInventories();
  
  if (!data[email] || !data[email].medicines) {
    throw new Error('User inventory not found');
  }
  
  const initialLength = data[email].medicines.length;
  data[email].medicines = data[email].medicines.filter(m => m.id !== medicineId);
  
  if (data[email].medicines.length === initialLength) {
    throw new Error('Medicine not found in inventory');
  }
  
  await saveInventory(data);
  return { success: true };
}

/**
 * Refills a medicine in the inventory by a specified amount (default 10).
 */
export async function refillMedicine(email, medicineId, amount = 10) {
  const data = await getAllInventories();
  
  if (!data[email] || !data[email].medicines) {
    throw new Error('User inventory not found');
  }
  
  const medIndex = data[email].medicines.findIndex(m => m.id === medicineId);
  if (medIndex === -1) {
    throw new Error('Medicine not found in inventory');
  }
  
  data[email].medicines[medIndex].stockLeft += amount;
  
  if (data[email].medicines[medIndex].stockLeft > 3) {
    data[email].medicines[medIndex].lowStockAlertSent = false;
  }
  
  await saveInventory(data);
  return data[email].medicines[medIndex];
}
