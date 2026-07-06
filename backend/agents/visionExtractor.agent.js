import Groq from "groq-sdk";
import { maskPII } from "../middleware/piiMasking.middleware.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function visionExtractorAgent(imageBase64, mimeType = "image/jpeg") {
  console.log("🤖 [Agent 1: Vision Extractor] Starting prescription analysis...");

  // Strip prefix if it exists to get clean base64
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");

  const systemPrompt = `You are a medical prescription OCR specialist AI. Analyze the provided prescription image carefully.

Extract all medication information and the prescriber's name. Return ONLY valid JSON matching this exact structure:
{
  "prescriberName": "Doctor's name or 'Unknown'",
  "medicines": [
    {
      "name": "string (medication name)",
      "dosage": "string (e.g., '150mg', '10ml')",
      "frequency": "string (e.g., 'Twice a day', 'Every 8 hours')",
      "duration": "string (e.g., '5 days') or null",
      "instructions": "string (e.g., 'Take after food') or null",
      "route": "string (e.g., 'Oral') or null"
    }
  ]
}

CRITICAL: Return ONLY the JSON object, no markdown, no explanation.`;

  try {
    console.log("🤖 [Agent 1] Calling Groq API (Model: meta-llama/llama-4-scout-17b-16e-instruct)...");
    
    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: systemPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${cleanBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const responseText = response.choices[0].message.content;
    console.log("🤖 [Agent 1] Raw response received:", responseText);

    let extractedData;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      console.warn("🤖 [Agent 1] JSON parse failed, attempting extraction from text...");
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Vision Agent failed to produce valid JSON");
      }
    }

    if (!extractedData.medicines || !Array.isArray(extractedData.medicines)) {
      throw new Error("Vision Agent output missing required 'medicines' array");
    }

    const stringifiedOutput = JSON.stringify(extractedData);
    const { maskedText } = maskPII(stringifiedOutput);
    const finalOutput = JSON.parse(maskedText);

    console.log(
      `✅ [Agent 1] Extraction complete. Found ${finalOutput.medicines.length} medication(s).`
    );

    return {
      success: true,
      agent: "VisionExtractorAgent",
      data: finalOutput,
    };
  } catch (error) {
    console.error("❌ [Agent 1] Vision extraction failed:", error);
    throw error; // Throwing real error as requested
  }
}
