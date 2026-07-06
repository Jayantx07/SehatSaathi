// ============================================================
// Sehat Saathi - Agent 2: Pharmacist Analyst Agent (Groq Version)
// ============================================================
// AGENTIC BEHAVIOR:
//   This agent acts as an autonomous clinical pharmacist.
//   It receives the structured JSON from Agent 1 and performs
//   multi-dimensional drug interaction analysis using an LLM.
//
//   The agent is "agentic" because:
//   1. It uses LangChain's structured output parser for reliable JSON
//   2. It autonomously classifies severity levels (CRITICAL/MODERATE/LOW)
//   3. It generates actionable recommendations without human prompting
//   4. It passes a "requires_alert" boolean to guide Agent 3's decision
//
// INPUT:  { medicines: [...] } (output from Agent 1)
// OUTPUT: { interactions: [...], severity: string, requiresAlert: boolean, summary: string }
// ============================================================

import { ChatGroq } from "@langchain/groq";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// Initialize the LLM for pharmacist analysis using Llama 3 on Groq
const pharmacistLLM = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.1, // Low temp for consistent, reliable medical analysis
  apiKey: process.env.GROQ_API_KEY,
});

const outputParser = new StringOutputParser();

/**
 * PharmacistAnalystAgent
 * ============================================================
 * AGENTIC BEHAVIOR: Autonomous drug interaction analysis
 * 
 * Uses LangChain's prompt template + LLM + output parser chain
 * to systematically analyze medication combinations for interactions.
 * This is a classic "LLMChain" pattern in agentic architectures.
 *
 * @param {Object} prescriptionData - Structured output from Agent 1
 * @returns {Promise<Object>}       - Interaction analysis results
 */
export async function pharmacistAnalystAgent(prescriptionData) {
  console.log("🤖 [Agent 2: Pharmacist Analyst] Starting drug interaction analysis...");

  const { medicines = [] } = prescriptionData;

  if (medicines.length === 0) {
    console.warn("🤖 [Agent 2] No medicines to analyze.");
    return {
      success: true,
      agent: "PharmacistAnalystAgent",
      data: {
        interactions: [],
        overallSeverity: "NONE",
        requiresAlert: false,
        summary: "No medications found to analyze.",
        recommendations: [],
      },
    };
  }

  // Format medicine list for the prompt
  const medicineList = medicines
    .map(
      (m, i) =>
        `${i + 1}. ${m.name} - ${m.dosage} - ${m.frequency}${m.instructions ? ` (${m.instructions})` : ""
        }`
    )
    .join("\n");

  // ============================================================
  // LANGCHAIN CHAIN CONSTRUCTION (AGENTIC BEHAVIOR)
  // We build a LangChain pipeline: PromptTemplate → LLM → Parser
  // This is the foundation of LangChain's "chain" architecture
  // ============================================================
  const systemTemplate = `You are SehatSaathi-CDSS, an advanced AI Clinical Decision Support System (CDSS).

ROLE

You behave like a multidisciplinary hospital medication safety review team consisting of:

• Clinical Pharmacist
• Internal Medicine Physician
• Pediatrician
• Clinical Pharmacologist
• Medication Safety Officer

You are NOT diagnosing diseases.

You are reviewing prescription safety.

Your primary objective is

Maximize Patient Safety
Minimize False Positives
Prevent Alert Fatigue
Never Hallucinate
Always Prefer Conservative Clinical Reasoning

-------------------------------------

CRITICAL SAFETY PRINCIPLES

Patient safety always comes first.

Accuracy is more important than completeness.

If uncertain,
say you are uncertain.

Never invent medicines.

Never invent interactions.

Never invent diagnoses.

Unknown information is NOT evidence of danger.

Lack of information must decrease confidence,
NOT increase severity.

Never transform uncertainty into an emergency.

-------------------------------------

CLINICAL REVIEW WORKFLOW

Internally follow these steps.

Never expose your chain of thought.

====================================

STEP 1

DOCUMENT VALIDATION

Determine whether this prescription appears to be

REAL_PRESCRIPTION

SAMPLE_PRESCRIPTION

TRAINING_DOCUMENT

DEMO_DOCUMENT

TEST_DOCUMENT

If the document explicitly contains words such as

Sample

Demo

Training

Test Patient

Dummy

Example

Practice

then classify it accordingly.

Sample prescriptions must NEVER trigger emergency alerts.

Clinical inconsistencies inside sample prescriptions should NOT be treated as medical errors.

====================================

STEP 2

MEDICINE IDENTIFICATION

For every medicine

Identify

Brand Name

Generic Name

Drug Class

Common Clinical Use

Confidence Score

Examples

Calpol
↓

Paracetamol

Levolin
↓

Levosalbutamol

Meftal-P
↓

Mefenamic Acid

Zoclar
↓

Clarithromycin

If confidence is below 80%

Return

Unknown Medicine

Never guess.

Never hallucinate.

Unknown medicines belong under

Medicine Identification Issues

NOT

Drug Interactions.

====================================

STEP 3

STANDARDIZATION

Convert all medicines mentally into

Generic names

before performing any analysis.

Never analyze interactions using brand names alone.

====================================

STEP 4

PATIENT CONTEXT

Use available information

Age

Gender

Weight

Diagnosis

Symptoms

Duration

Frequency

Dosage

Route

Instructions

If information is unavailable

State

Insufficient information

Do not guess.

====================================

STEP 5

CLINICAL SAFETY REVIEW

Review

Drug–Drug Interactions

Duplicate Therapy

Drug–Disease Interactions

Age Appropriateness

Pediatric Safety

Pregnancy Safety

Renal Safety

Hepatic Safety

Dose Appropriateness

Frequency

Duration

Route

High-Risk Medicines

Contraindications

Therapeutic Duplication

Missing Standard Therapy

Medicine Identification Problems

====================================

STEP 6

SOS LOGIC

If medicine is marked

SOS

PRN

As Needed

Assume

It is NOT intended for routine simultaneous administration.

Lower interaction severity unless strong evidence supports otherwise.

Examples

Paracetamol

+

Mefenamic Acid (SOS)

↓

Usually

NONE

or

MINOR

NOT MODERATE

====================================

STEP 7

CLINICAL CONSISTENCY

If diagnosis is available

Determine whether medicines reasonably fit the diagnosis.

Example

Diagnosis

Malaria

Prescription

Abciximab

↓

Clinical inconsistency

However

If documentType is SAMPLE_PRESCRIPTION

Do NOT classify this as an error.

Mention

Expected because this is a sample document.

====================================

STEP 8

PREVENT ALERT FATIGUE

Report ONLY clinically meaningful interactions.

Ignore insignificant theoretical interactions.

Never elevate routine prescribing practices into warnings.

Do NOT warn simply because

two medicines treat fever

two medicines treat pain

two medicines belong to similar therapeutic classes

Only report interactions that would reasonably change

Monitoring

Dose

Counselling

Prescribing

====================================

STEP 9

UNKNOWN MEDICINES

Unknown medicines are

Data Quality Issues

NOT

Clinical Emergencies.

Never report

Unknown Medicine

as

MAJOR

or

CRITICAL.

Instead say

Interaction analysis incomplete because one or more medicines could not be confidently identified.

====================================

STEP 10

SEVERITY DEFINITIONS

NONE

No clinically meaningful concern.

No action required.

MINOR

Routine observation only.

No change usually required.

MODERATE

Additional monitoring

Dose adjustment

or physician review may be appropriate.

MAJOR

Evidence-supported interaction likely requiring physician intervention.

Potential for clinically significant harm.

CRITICAL

Immediate life-threatening concern.

Requires urgent medical attention.

Unknown medicines must NEVER create

MAJOR

or

CRITICAL

severity.

====================================

STEP 11

EMERGENCY ALERT POLICY

Only classify

MAJOR

or

CRITICAL

when ALL are true

1.

Medicines are confidently identified.

AND

2.

Evidence strongly supports significant interaction.

AND

3.

Interaction requires immediate clinical action.

Otherwise

Downgrade severity.

====================================

STEP 12

CLINICAL COMMUNICATION

Separate findings into

Clinically Significant Alerts

and

Clinical Considerations

Clinical Considerations should include

Routine counselling

Expected side effects

Monitoring advice

Non-urgent notes

Do not unnecessarily frighten patients.

====================================

STEP 13

EVIDENCE

Base reasoning on generally accepted clinical references such as

DrugBank

DailyMed

FDA

BNF

WHO

Lexicomp

Micromedex

NICE

Pediatric Guidelines

Do not fabricate references.

====================================

STEP 14

FINAL QUALITY CHECK

Before returning the result ask yourself

Did I hallucinate?

Did I invent a medicine?

Did I invent an interaction?

Did I exaggerate severity?

Did I create alert fatigue?

Did uncertainty incorrectly become an emergency?

If yes

Correct the output before responding.

====================================

OUTPUT REQUIREMENTS

Return ONLY valid JSON.

Never use Markdown.

Never explain reasoning.

Never include chain-of-thought.

Never change the existing JSON schema.

Preserve all existing keys.

If no interaction exists

Return

overallSeverity = NONE

interactions = []

requiresAlert = false

Use cdssExtensions for

Clinical Considerations

Duplicate Therapy

Medicine Identification Issues

Document Type

Clinical Consistency

Confidence

Unknown Medicines

Evidence Notes

Never generate emergency alerts solely because information is incomplete.

Remember

A safe AI is one that knows when NOT to alarm.

{{
  "overallSeverity": "NONE/MINOR/MODERATE/MAJOR/CRITICAL",
  "criticalCount": 0,
  "interactions": [
    {{
      "drugs": "Drug A + Drug B",
      "severity": "MODERATE/MAJOR/CRITICAL",
      "reason": "Explain WHY clinically, mentioning active ingredients."
    }}
  ],
  "recommendation": "Short, highly professional clinical advice (e.g., Use Calpol as primary antipyretic. Give Meftal-P only if advised. Seek medical advice if fever persists).",
  "cdssExtensions": {{
    "documentType": "REAL_PRESCRIPTION",
    "clinicalConsiderations": [
      "Calpol and Meftal-P both reduce fever; since Meftal-P is SOS, avoid unnecessary concurrent administration."
    ],
    "duplicateTherapy": "None detected OR explain overlap",
    "evidenceReferences": ["DrugBank", "Pediatric Guidelines"]
  }}
}}`;

  const humanTemplate = `Analyze this prescription data using the CDSS workflow:
- Patient Info / Diagnosis: (Extract from image if available, else 'Unknown')
- Medicines Found: {medicineList}

Provide the final JSON safety review.`;

  // Build the LangChain prompt template
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(systemTemplate),
    HumanMessagePromptTemplate.fromTemplate(humanTemplate),
  ]);

  // Create the chain: Prompt → LLM → String Parser
  const pharmacistChain = chatPrompt.pipe(pharmacistLLM).pipe(outputParser);

  try {
    console.log(
      `🤖 [Agent 2] Analyzing ${medicines.length} medications via Groq (Llama-3.3-70b-versatile)...`
    );

    const rawResponse = await pharmacistChain.invoke({ medicineList });

    // Parse the JSON response
    let analysisData;
    try {
      // Strip markdown code blocks if present
      const cleanJson = rawResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      analysisData = JSON.parse(cleanJson);
    } catch (parseError) {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Pharmacist Agent produced invalid JSON");
      }
    }

    // Normalize field names for consistency and ensure it matches the frontend's expected schema
    const rawInteractions = analysisData.interactions || [];
    const formattedInteractions = rawInteractions.map(i => ({
      drugs: Array.isArray(i.drugs) ? i.drugs : (typeof i.drugs === 'string' ? i.drugs.split(' + ') : []),
      type: i.type || "Drug Interaction",
      severity: i.severity || "LOW",
      mechanism: i.reason || i.mechanism || "",
      clinicalEffect: i.clinicalEffect || i.reason || "",
      recommendation: i.recommendation || ""
    }));

    const normalizedData = {
      interactions: formattedInteractions,
      overallSeverity: analysisData.overallSeverity || "NONE",
      requiresAlert:
        analysisData.requiresImmediateAlert ||
        analysisData.requiresAlert ||
        ["MAJOR", "CRITICAL"].includes(analysisData.overallSeverity) || false,
      requiresReminder: analysisData.requiresReminderAlert || false,
      summary: analysisData.recommendation || analysisData.summary || "Analysis complete.",
      recommendations: analysisData.recommendations || (analysisData.recommendation ? [analysisData.recommendation] : []),
      cdssExtensions: analysisData.cdssExtensions || null,
    };

    const criticalCount = normalizedData.interactions.filter(
      (i) => i.severity === "CRITICAL"
    ).length;

    console.log(
      `✅ [Agent 2] Analysis complete. Found ${normalizedData.interactions.length} interaction(s). ` +
      `Overall severity: ${normalizedData.overallSeverity}. Critical: ${criticalCount}`
    );

    return {
      success: true,
      agent: "PharmacistAnalystAgent",
      data: normalizedData,
    };
  } catch (error) {
    console.error("❌ [Agent 2] Pharmacist analysis failed:", error.message);
    return {
      success: false,
      agent: "PharmacistAnalystAgent",
      error: error.message,
      data: {
        interactions: [],
        overallSeverity: "UNKNOWN",
        requiresAlert: false,
        summary: "Analysis could not be completed.",
        recommendations: [],
      },
    };
  }
}

// --- Demo Mode: Returns mock interaction data ---
export async function pharmacistAnalystAgentDemo(prescriptionData) {
  console.log("🤖 [Agent 2: DEMO MODE] Returning mock drug interaction analysis...");
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API delay

  return {
    success: true,
    agent: "PharmacistAnalystAgent",
    demo: true,
    data: {
      interactions: [
        {
          drugs: ["Warfarin", "Aspirin"],
          type: "Drug-Drug Interaction",
          severity: "CRITICAL",
          mechanism:
            "Both drugs inhibit platelet aggregation through different pathways. Combined use significantly increases bleeding risk.",
          clinicalEffect:
            "Substantially increased risk of serious bleeding events including gastrointestinal hemorrhage and intracranial bleeding.",
          recommendation:
            "Avoid concurrent use unless benefit clearly outweighs risk. If used together, monitor INR closely and watch for bleeding signs.",
        },
        {
          drugs: ["Warfarin", "Ibuprofen"],
          type: "Drug-Drug Interaction",
          severity: "CRITICAL",
          mechanism:
            "NSAIDs inhibit COX-1/COX-2, reducing thromboxane A2 synthesis. Ibuprofen also displaces warfarin from plasma proteins.",
          clinicalEffect:
            "Elevated INR, increased anticoagulant effect, and higher bleeding risk.",
          recommendation:
            "Contraindicated combination. Use acetaminophen as an alternative analgesic for patients on warfarin.",
        },
        {
          drugs: ["Aspirin", "Ibuprofen"],
          type: "Duplicate Therapy",
          severity: "MODERATE",
          mechanism:
            "Ibuprofen competitively inhibits COX-1, potentially blocking aspirin's cardioprotective effect.",
          clinicalEffect:
            "Reduced efficacy of low-dose aspirin cardioprotection. Additive GI toxicity.",
          recommendation:
            "Take aspirin at least 30 minutes before or 8 hours after ibuprofen to preserve aspirin's antiplatelet effect.",
        },
      ],
      overallSeverity: "CRITICAL",
      requiresAlert: true,
      requiresReminder: true,
      summary:
        "This prescription contains a CRITICAL drug interaction between Warfarin, Aspirin, and Ibuprofen. The combination significantly elevates bleeding risk and may be life-threatening. Immediate medical review is required.",
      recommendations: [
        "Contact your prescribing physician immediately before taking these medications together",
        "Do NOT take Ibuprofen while on Warfarin — consider Acetaminophen instead",
        "Monitor for signs of unusual bleeding: bruising, blood in urine/stool, prolonged bleeding from cuts",
        "Get your INR (blood clotting) checked within 24-48 hours",
      ],
    },
  };
}
