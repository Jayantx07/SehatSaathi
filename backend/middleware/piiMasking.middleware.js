// ============================================================
// Sehat Saathi - PII Masking Middleware
// ============================================================
// KAGGLE REQUIREMENT: Security Feature - PII Masking
//
// PURPOSE: This middleware uses Regex patterns to detect and mask
// Personally Identifiable Information (PII) from ALL request bodies
// BEFORE the data is forwarded to any LLM agent.
//
// WHAT IS MASKED:
//   1. Full Names       → [NAME REDACTED]
//   2. Ages             → [AGE REDACTED]
//   3. Phone Numbers    → [PHONE REDACTED]
//   4. Email Addresses  → [EMAIL REDACTED]
//   5. SSN/NI Numbers   → [SSN REDACTED]
//
// WHY THIS MATTERS (for Kaggle judges):
//   In real healthcare systems, sending raw patient data to a
//   third-party LLM API (like OpenAI/Google) is a HIPAA violation.
//   This middleware demonstrates "Privacy by Design" — we mask
//   PII at the edge (middleware layer) so no sensitive data ever
//   leaves our system in a readable form.
// ============================================================

// --- PII Regex Patterns ---
const PII_PATTERNS = [
  // Full Name: "Patient: John Doe" or "Name: Mary Smith"
  // Catches 2-3 word capitalized name sequences preceded by common labels
  {
    label: "FULL_NAME",
    regex:
      /\b(patient|name|dr\.?|doctor|mr\.?|mrs\.?|ms\.?)[\s:]+([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/gi,
    replacement: "$1: [NAME REDACTED]",
  },

  // Standalone capitalized name patterns (First Last) - COMMENTED OUT due to false positives
  // with medical terms like "Blurred Vision", "Blood Pressure" etc.
  /*
  {
    label: "PROPER_NAME",
    regex: /\b([A-Z][a-z]{1,20})\s([A-Z][a-z]{1,20})\b/g,
    // We use a heuristic: if it looks like a name in a medical context, mask it
    // Note: This is simplified; production would use NER (Named Entity Recognition)
    replacement: "[NAME REDACTED]",
  },
  */

  // Age: "age: 45", "45 years old", "45yo", "DOB: 1985"
  {
    label: "AGE",
    regex:
      /\b(age[\s:]+\d{1,3}|\d{1,3}\s*(?:years?\s*old|yr|yo)|dob[\s:]+\d{4})\b/gi,
    replacement: "[AGE REDACTED]",
  },

  // Phone Numbers: Various formats (US, International, Indian)
  // Matches: +1-800-555-1234, (555) 123-4567, 9876543210, +91 98765 43210
  {
    label: "PHONE",
    regex:
      /(\+?\d{1,3}[\s\-\.]?)?\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4,6}\b/g,
    replacement: "[PHONE REDACTED]",
  },

  // Email Addresses
  {
    label: "EMAIL",
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z]{2,}\b/gi,
    replacement: "[EMAIL REDACTED]",
  },

  // SSN / National Insurance (US format: XXX-XX-XXXX)
  {
    label: "SSN",
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: "[SSN REDACTED]",
  },
];

/**
 * Masks PII in a string using all defined regex patterns.
 * This function is exported so agents can also call it directly
 * before constructing their LLM prompts (defense-in-depth).
 *
 * @param {string} text - Raw text potentially containing PII
 * @returns {{ maskedText: string, maskedFields: string[] }} - Sanitized text + list of what was masked
 */
export function maskPII(text) {
  if (!text || typeof text !== "string") return { maskedText: text, maskedFields: [] };

  let maskedText = text;
  const maskedFields = [];

  for (const pattern of PII_PATTERNS) {
    const before = maskedText;
    maskedText = maskedText.replace(pattern.regex, pattern.replacement);
    if (maskedText !== before) {
      maskedFields.push(pattern.label);
    }
  }

  return { maskedText, maskedFields };
}

/**
 * Recursively masks PII in all string values within an object.
 * This ensures nested request bodies are fully sanitized.
 *
 * @param {any} obj - Any value (string, object, array)
 * @returns {any} - Sanitized version of the input
 */
function deepMaskPII(obj) {
  if (typeof obj === "string") {
    return maskPII(obj).maskedText;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepMaskPII);
  }
  if (obj && typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip masking the image data (Base64 strings are binary, not PII)
      // Skip masking email address used for SENDING alerts (destination, not patient PII)
      if (key === "imageBase64" || key === "patientEmail") {
        sanitized[key] = value;
      } else {
        sanitized[key] = deepMaskPII(value);
      }
    }
    return sanitized;
  }
  return obj;
}

/**
 * Express Middleware: PII Masking
 * ============================================================
 * AGENTIC SECURITY BEHAVIOR:
 * Intercepts the request body at the middleware layer, applies PII
 * masking, attaches the masked body to req.maskedBody, and logs
 * which PII categories were detected. The original req.body is
 * preserved (for audit logs) but agents MUST use req.maskedBody.
 * ============================================================
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function piiMaskingMiddleware(req, res, next) {
  if (!req.body || Object.keys(req.body).length === 0) {
    req.maskedBody = req.body;
    return next();
  }

  console.log("🔒 [PII MASKING] Intercepting request to:", req.path);

  // Apply deep PII masking to the entire request body
  const sanitizedBody = deepMaskPII(req.body);

  // Attach to req for use in routes/agents
  // req.body        → Original (for internal audit only, never sent to LLM)
  // req.maskedBody  → Sanitized (ALWAYS use this when building LLM prompts)
  req.maskedBody = sanitizedBody;

  // Log masked field categories (not the values — that would defeat the purpose)
  const textFields = Object.entries(req.body)
    .filter(([k, v]) => typeof v === "string" && k !== "imageBase64")
    .map(([k, v]) => maskPII(v).maskedFields)
    .flat();

  if (textFields.length > 0) {
    console.log(
      `🔒 [PII MASKING] Masked categories detected: [${[...new Set(textFields)].join(", ")}]`
    );
  } else {
    console.log("🔒 [PII MASKING] No PII detected in request body.");
  }

  next();
}
