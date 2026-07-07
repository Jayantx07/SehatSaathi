"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, CheckCircle, ShoppingCart, Bell, AlertTriangle, Trash2 } from "lucide-react";

// ============================================================
// TYPE DEFINITIONS
// ============================================================
type AnalysisStage =
  | "idle"
  | "uploading"
  | "masking"
  | "extracting"
  | "analyzing"
  | "deciding"
  | "success"
  | "error";

type Severity = "CRITICAL" | "MODERATE" | "MINOR" | "LOW" | "NONE";

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  route?: string;
}

interface InventoryMedicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  stockLeft: number;
  reminderTimes: string[];
}

interface Interaction {
  drugs: string[];
  type: string;
  severity: Severity;
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
}

interface AnalysisResult {
  medicines: Medicine[];
  interactions: Interaction[];
  overallSeverity: Severity;
  patientSummary: string;
  nextSteps: string[];
  alertSent: boolean;
  urgencyLevel: string;
  processingTime: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const DEMO_RESULT: AnalysisResult = {
  medicines: [
    { name: "Abciximab", dosage: "1 tablet", frequency: "Morning", duration: "8 days" },
    { name: "Vomilast", dosage: "1 tablet", frequency: "Morning, Night", duration: "8 days" },
    { name: "Zoclar 500", dosage: "1 capsule", frequency: "Morning", duration: "3 days" },
    { name: "Gestakind 10/SR", dosage: "1 tablet", frequency: "Night", duration: "4 days" }
  ],
  interactions: [
    {
      drugs: ["Abciximab", "Zoclar 500"],
      type: "Drug-Drug",
      severity: "MINOR",
      mechanism: "Unknown",
      clinicalEffect: "The evidence is limited — the exact mechanism is uncertain because two of the medications above couldn't be fully identified from the image.",
      recommendation: "Monitor"
    }
  ],
  overallSeverity: "MINOR",
  patientSummary: "A malaria treatment course...",
  nextSteps: [
    "Schedule a review with your healthcare provider to discuss this medication list.",
    "Keep an up-to-date list of everything you're taking to share at that visit."
  ],
  alertSent: false,
  urgencyLevel: "LOW",
  processingTime: "5.72"
};

// ============================================================
// MAIN DASHBOARD COMPONENT
// ============================================================
export default function Dashboard() {
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patientEmail, setPatientEmail] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<{ title: string, desc: string, type: "alert" | "success" } | null>(null);
  
  const [activeRefillId, setActiveRefillId] = useState<string | null>(null);
  const [refillAmount, setRefillAmount] = useState<number>(10);

  // Pipeline progression state (0 to 4)
  const [pipelineStep, setPipelineStep] = useState(0);

  // Track animation state for hero demo chips
  const [demoActive, setDemoActive] = useState(false);

  const pipelineRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // Simple on-mount reveal hook for static elements
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealEls = document.querySelectorAll(".static-reveal");

    if (!reduceMotion && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in-view");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.1 }
      );
      revealEls.forEach((el) => io.observe(el));
      return () => io.disconnect();
    } else {
      revealEls.forEach((el) => el.classList.add("in-view"));
    }
  }, []);

  const smoothScrollTo = (ref: React.RefObject<HTMLElement | null>, block: ScrollLogicalPosition = "start") => {
    if (!ref.current) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: block,
    });
  };

  // ============================================================
  // LIVE TRACKER DATA & ACTIONS
  // ============================================================
  useEffect(() => {
    if (stage === "success" && patientEmail) {
      fetch(`${BACKEND_URL}/api/inventory?email=${encodeURIComponent(patientEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data && data.data.medicines) {
            setInventory(data.data.medicines);
          }
        })
        .catch(err => console.error("Failed to fetch inventory:", err));
    }
  }, [stage, patientEmail]);

  const showToast = (title: string, desc: string, type: 'success' | 'alert' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const consumeDose = async (medId: string) => {
    setInventory(prev => prev.map(m => m.id === medId ? { ...m, stockLeft: Math.max(0, m.stockLeft - 1) } : m));
    showToast("Dose Logged", "Your medication dose has been successfully recorded.", "success");
    try {
      await fetch(`${BACKEND_URL}/api/inventory/consume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: patientEmail, medicineId: medId })
      });
    } catch (err) {
      console.error("Failed to consume dose on backend", err);
    }
  };

  const deleteMedicine = async (medId: string, medName: string) => {
    // Optimistic UI update
    setInventory(prev => prev.filter(m => m.id !== medId));
    showToast("Medicine Removed", `${medName} has been removed from your tracker.`, "alert");
    try {
      await fetch(`${BACKEND_URL}/api/inventory/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: patientEmail, medicineId: medId })
      });
    } catch (err) {
      console.error("Failed to remove medicine on backend", err);
    }
  };

  const submitRefill = async (medId: string) => {
    const amountToRefill = refillAmount || 10;
    // Optimistic UI update
    setInventory(prev => prev.map(m => m.id === medId ? { ...m, stockLeft: m.stockLeft + amountToRefill } : m));
    showToast("Stock Refilled", `Added ${amountToRefill} pills to your inventory.`, "success");
    try {
      await fetch(`${BACKEND_URL}/api/inventory/refill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: patientEmail, medicineId: medId, amount: amountToRefill })
      });
    } catch (err) {
      console.error("Failed to refill medicine on backend", err);
    }
    setActiveRefillId(null);
    setRefillAmount(10);
  };

  const simulateAlert = async () => {
    showToast("Alert Simulated", "A live email alert has been triggered for your demo.", "alert");
    
    const medName = inventory.length > 0 ? inventory[0].name : "your medication";
    
    try {
      await fetch(`${BACKEND_URL}/api/inventory/force-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: patientEmail, type: "REMINDER", medicineName: medName })
      });
    } catch (err) {
      console.error("Failed to force alert", err);
    }
  };

  // ============================================================
  // DRAG AND DROP HANDLER
  // ============================================================
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setStage("uploading");
      setResult(null);
      setError(null);
      setPipelineStep(0);

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = (reader.result as string).split(",")[1];
        const mimeType = file.type || "image/jpeg";
        await runAnalysisPipeline(base64String, mimeType, false);
      };
      reader.onerror = () => {
        setError("Failed to read the image file.");
        setStage("error");
      };
    },
    [patientEmail]
  );

  // ============================================================
  // MAIN PIPELINE CALL
  // ============================================================
  async function runAnalysisPipeline(imageBase64: string, mimeType: string, isDemo = false) {
    setStage("masking");
    setPipelineStep(1);
    
    // Slight delay to allow DOM to render the pipeline section before scrolling to it
    setTimeout(() => smoothScrollTo(pipelineRef, "center"), 50);

    // Simulate pipeline steps lighting up
    const stepInterval = setInterval(() => {
      setPipelineStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      if (isDemo) {
        // Local Demo Simulation
        await new Promise(res => setTimeout(res, 5000));
        clearInterval(stepInterval);
        setPipelineStep(4);
        processApiResponse({ summary: DEMO_RESULT, agents: { pharmacistAnalyst: { interactions: DEMO_RESULT.interactions, overallSeverity: DEMO_RESULT.overallSeverity }, visionExtractor: { medicines: DEMO_RESULT.medicines }, decisionAction: { patientSummary: DEMO_RESULT.patientSummary, nextSteps: DEMO_RESULT.nextSteps } } }, true);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/prescription/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          patientEmail: patientEmail || undefined,
          demoMode: false,
        }),
      });

      clearInterval(stepInterval);
      setPipelineStep(4);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `Analysis failed (${response.status})`);
      }

      const data = await response.json();
      processApiResponse(data, false);
    } catch (err) {
      clearInterval(stepInterval);
      const message = err instanceof Error ? err.message : "Analysis failed. Please try again.";
      console.error("Analysis pipeline error:", message);
      setError(message);
      setStage("error");
    }
  }

  function processApiResponse(data: any, isDemo: boolean) {
    const res: AnalysisResult = {
      medicines: data.agents?.visionExtractor?.medicines || data.summary?.medicines || [],
      interactions: data.agents?.pharmacistAnalyst?.interactions || [],
      overallSeverity: data.summary?.severity || data.agents?.pharmacistAnalyst?.overallSeverity || "NONE",
      patientSummary: data.agents?.decisionAction?.patientSummary || data.summary?.patientMessage || "",
      nextSteps: data.agents?.decisionAction?.nextSteps || [],
      alertSent: data.summary?.alertSent || false,
      urgencyLevel: data.summary?.urgency || "MONITOR",
      processingTime: data.processingTimeSeconds || "5.72",
    };
    
    // For demo, forcefully overwrite missing fields with the mock
    if (isDemo) {
        Object.assign(res, DEMO_RESULT);
    }
    
    setResult(res);
    setStage("success");
    setTimeout(() => smoothScrollTo(resultsRef, "start"), 100);
  }

  const isLoading = ["uploading", "masking", "extracting", "analyzing", "deciding"].includes(stage);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: isLoading,
  });

  // Demo run function
  const runDemo = () => {
    if (isLoading) return;
    setDemoActive(true);
    setStage("idle");
    setResult(null);
    setError(null);
    
    runAnalysisPipeline("", "image/jpeg", true);
    
    setTimeout(() => setDemoActive(false), 5800);
  };

  // Fetch Dashboard without upload
  const fetchDashboard = () => {
    if (!patientEmail) {
      setError("Please enter your email to view the dashboard.");
      return;
    }
    setStage("masking"); 
    setPipelineStep(4);
    setTimeout(() => {
      fetch(`${BACKEND_URL}/api/inventory?email=${encodeURIComponent(patientEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data && data.data.medicines) {
            setInventory(data.data.medicines);
            setResult(null); // No analysis result, just dashboard
            setStage("success");
            setTimeout(() => smoothScrollTo(resultsRef, "start"), 100);
          } else {
            setError("No inventory found for this email.");
            setStage("idle");
          }
        })
        .catch(err => {
          setError("Failed to fetch dashboard.");
          setStage("idle");
        });
    }, 600);
  };

  const chipData = [
    { label: "Patient — masked", flag: false },
    { label: "Abciximab · 1 tablet", flag: false },
    { label: "Vomilast · 1 tablet", flag: false },
    { label: "Zoclar 500 · 1 capsule", flag: false },
    { label: "Gestakind 10/SR · 1 tablet", flag: false },
    { label: "⚠ 1 interaction found", flag: true },
  ];

  return (
    <div className="wrap">
      {/* NAV */}
      <header className="nav">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F1F3EC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l2 8 4-16 2 8h8" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Sehat Saathi <em>AI</em></span>
            <span className="brand-sub">MEDICATION CONCIERGE</span>
          </div>
        </div>
        <div className="status-pill">
          <span className={`status-dot ${isLoading ? "is-active" : ""}`}></span>
          <span>{isLoading ? "analyzing prescription…" : "4 agents on standby"}</span>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Multi-agent pipeline · Kaggle Hackathon 2025</p>
          <h1>Your prescription,<br /><em>read like a pharmacist would.</em></h1>
          <p className="lede">
            Photograph any prescription, typed or handwritten. Four specialist agents mask who you are, read what the doctor wrote, check it against known drug interactions, and hand back a plain-English answer — before the photo would've finished uploading anywhere else.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}>
              Scan your prescription
            </button>
            <span className="hero-hint">or try the sample below ↓</span>
          </div>
        </div>

        <div className="hero-demo">
          <div className="demo-card">
            <div className="demo-card-head">
              <span>Live scan · sample prescription</span>
              <span className="rec"><span className="rec-dot"></span> reading</span>
            </div>
            <div className="doc-frame">
              <div className="scanbar"></div>
              <div className="doc-line w45"></div>
              <div className="doc-line w60"></div>
              <div className="doc-rule"></div>
              <div className="doc-line w80"></div>
              <div className="doc-line w70"></div>
              <div className="doc-line w95"></div>
              <div className="doc-rule"></div>
              <div className="doc-line w60"></div>
              <div className="doc-line w45"></div>
            </div>
            
            <div className="chip-row">
              {chipData.map((c, i) => (
                <span
                  key={i}
                  className={`chip ${c.flag ? "tag-flag" : ""}`}
                  style={{ animationDelay: `${1.2 + i * 0.35}s` }}
                >
                  {c.label}
                </span>
              ))}
            </div>
            
            <div className="demo-foot">
              <span>4 medications detected</span>
              <span className="ok">✓ 5.72s</span>
            </div>
          </div>
        </div>
      </section>

      {/* UPLOAD */}
      <section id="upload">
        <div className="upload-grid">
          <div>
            <div className="section-head reveal static-reveal">
              <p className="eyebrow">Start here</p>
              <h2>Start with what you have</h2>
              <p>A phone photo is enough. Crumpled, tilted, half a coffee ring on it — we've built the vision agent for real prescriptions, not clean scans.</p>
            </div>

            {/* Note: No 'reveal' class here to avoid wiping it on state updates */}
            <div 
              {...getRootProps()}
              className={`dropzone ${isDragActive ? "is-dragover" : ""}`}
              style={previewUrl ? { padding: 0, overflow: 'hidden', border: 'none' } : {}}
            >
              <input {...getInputProps()} />
              {previewUrl ? (
                <div style={{ position: 'relative', width: '100%', height: '240px', cursor: 'pointer', borderRadius: '14px', overflow: 'hidden' }}>
                  <img src={previewUrl} alt="Prescription preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,34,25,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: isDragActive ? 1 : 0, transition: 'opacity 0.2s', color: 'white' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = isDragActive ? '1' : '0'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: '32px', height: '32px', marginBottom: '8px', color: 'white' }}>
                      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                    </svg>
                    <span style={{ fontWeight: 500 }}>{isDragActive ? "Drop new image to replace" : "Click or drop to scan another"}</span>
                  </div>
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                  </svg>
                  <div className="dz-title">
                    {isDragActive ? "Drop the prescription here..." : "Drop a prescription photo, or click to choose one"}
                  </div>
                  <div className="dz-sub">
                    {error ? <span style={{color: "var(--pulse)"}}>{error}</span> : "JPG, PNG, or HEIC · nothing leaves your device until you drop it here"}
                  </div>
                </>
              )}
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p className="demo-note" style={{ margin: 0 }}>Don't have a prescription handy?</p>
              <button onClick={runDemo} disabled={isLoading} style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--paper-deep)', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, color: 'var(--ink)' }}>
                Run sample scan
              </button>
            </div>

            <label className="field-label">Email for the results (optional)</label>
            <input 
              className="field" 
              type="email" 
              placeholder="you@example.com" 
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              disabled={isLoading}
            />
            <div className="text-xs text-slate-500 mt-1">
              Note: Due to API free-tier restrictions, demo alerts are safely routed to our verified developer inbox.
            </div>
            
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={fetchDashboard} 
                disabled={isLoading || !patientEmail} 
                style={{ padding: '10px 16px', fontSize: '14px', borderRadius: '8px', border: 'none', background: 'var(--ink)', cursor: (!isLoading && patientEmail) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 600, color: 'white', opacity: (!isLoading && patientEmail) ? 1 : 0.5, transition: 'opacity 0.2s' }}
              >
                View Dashboard (No Upload)
              </button>
            </div>
          </div>

          <div className="reassure">
            <div className="reassure-item reveal static-reveal">
              <span className="dot"></span>
              <div>
                <h3>Your name never reaches the reading model</h3>
                <p>The PII Masker strips identifiers first — everything downstream sees the medicine, not the patient.</p>
              </div>
            </div>
            <div className="reassure-item reveal static-reveal">
              <span className="dot"></span>
              <div>
                <h3>One pass, then it's gone</h3>
                <p>Images are processed once and discarded — nothing sits around waiting to be a breach.</p>
              </div>
            </div>
            <div className="reassure-item reveal static-reveal">
              <span className="dot"></span>
              <div>
                <h3>Flags, not diagnoses</h3>
                <p>Sehat Saathi surfaces what's worth asking your pharmacist about. It doesn't replace them.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PIPELINE */}
      {(isLoading || stage === "success") && (
        <section className="pipeline reveal in-view" ref={pipelineRef}>
          <div className="wrap" style={{ padding: "64px 40px" }}>
            <div className="section-head reveal in-view">
              <p className="eyebrow">How it moves</p>
              <h2>Four agents, one pass, under six seconds</h2>
              <p>Each agent hands its output to the next — nothing is reprocessed, nothing waits in a queue.</p>
            </div>

            <div className="track reveal in-view">
              <div className="track-fill" style={{ width: `${(pipelineStep / 4) * 88}%` }}></div>

              <div className={`stage ${pipelineStep >= 1 ? "is-active" : ""}`}>
                <div className="stage-node">01</div>
                <span className="tag">STAGE 01</span>
                <h3>PII Masker</h3>
                <p>Strips names, addresses, and record numbers before any model sees the image.</p>
              </div>

              <div className={`stage ${pipelineStep >= 2 ? "is-active" : ""}`}>
                <div className="stage-node">02</div>
                <span className="tag">STAGE 02</span>
                <h3>Vision AI</h3>
                <p>Reads typed and handwritten prescriptions, medicine by medicine, dose by dose.</p>
              </div>

              <div className={`stage ${pipelineStep >= 3 ? "is-active" : ""}`}>
                <div className="stage-node">03</div>
                <span className="tag">STAGE 03</span>
                <h3>Pharmacist</h3>
                <p>Cross-checks every drug pair against known interactions and flags what's uncertain.</p>
              </div>

              <div className={`stage ${pipelineStep >= 4 ? "is-active" : ""}`}>
                <div className="stage-node">04</div>
                <span className="tag">STAGE 04</span>
                <h3>Decision Agent</h3>
                <p>Turns findings into reminders and next steps you can actually act on.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* RESULTS */}
      {(stage === "success" && (result || inventory.length > 0)) && (
        <section id="results" ref={resultsRef} className="reveal in-view">
          <div className="section-head reveal in-view">
            <p className="eyebrow">What comes back</p>
            <h2>{result ? "From the uploaded prescription" : "Your Live Dashboard"}</h2>
            <p>{result ? (result.interactions.length === 0 ? "No interactions found." : `${result.interactions.length} interactions worth a follow-up call.`) : "Here is your current medication inventory."}</p>
          </div>

          <div className="results-grid">
            <div className="reveal in-view">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Live Medication Tracker</h3>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={simulateAlert}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(210,74,59,0.1)', color: 'var(--pulse)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(210,74,59,0.2)', cursor: 'pointer' }}
                >
                  <Bell size={14} /> Simulate Live Alert
                </motion.button>
              </div>

              {inventory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <AnimatePresence>
                    {inventory.map((med) => (
                      <motion.div 
                        key={med.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--paper-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
                              <Pill size={24} />
                            </div>
                            <div>
                              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>{med.name}</div>
                              <div style={{ fontSize: '14px', color: 'var(--ink-light)', marginTop: '2px' }}>{med.dosage} · {med.frequency}</div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                {med.reminderTimes.map((time: string, i: number) => (
                                  <span key={i} style={{ fontSize: '12px', background: 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: '6px', fontWeight: 600, color: 'var(--ink)' }}>⏰ {time}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: med.stockLeft <= 3 ? 'var(--pulse)' : 'var(--sage)' }}>
                                {med.stockLeft} pills remaining
                              </div>
                              <button
                                onClick={() => deleteMedicine(med.id, med.name)}
                                title="Remove Medicine"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--ink-light)', cursor: 'pointer', padding: '4px', opacity: 0.6, transition: 'all 0.2s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--pulse)'; e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-light)'; e.currentTarget.style.opacity = '0.6'; }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            {med.stockLeft <= 3 ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {activeRefillId === med.id ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input 
                                      type="number" 
                                      min="1"
                                      value={refillAmount} 
                                      onChange={(e) => setRefillAmount(parseInt(e.target.value) || 0)} 
                                      style={{ width: '50px', padding: '6px', borderRadius: '6px', border: '1px solid rgba(76,122,86,0.5)', background: 'transparent', color: 'var(--sage)', fontWeight: 600, fontSize: '14px', outline: 'none' }}
                                    />
                                    <motion.button 
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => submitRefill(med.id)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sage)', color: 'white', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                                      title="Confirm Refill"
                                    >
                                      <CheckCircle size={14} />
                                    </motion.button>
                                  </div>
                                ) : (
                                  <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setActiveRefillId(med.id); setRefillAmount(10); }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(76,122,86,0.1)', color: 'var(--sage)', padding: '8px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, border: '1px solid rgba(76,122,86,0.2)', cursor: 'pointer' }}
                                    title="Mark as Refilled"
                                  >
                                    + Refill
                                  </motion.button>
                                )}
                                <motion.button 
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => window.open(`https://www.1mg.com/search/all?name=${encodeURIComponent(med.name)}`, '_blank')}
                                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--pulse)', color: 'white', padding: '8px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(210,74,59,0.3)' }}
                                >
                                  <ShoppingCart size={16} /> Order Refill
                                </motion.button>
                              </div>
                            ) : (
                              <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => consumeDose(med.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--ink)', color: 'white', padding: '8px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                              >
                                <CheckCircle size={16} /> Take Dose
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                result?.medicines?.map((med, idx) => (
                  <div className="med-card" key={idx}>
                    <div className="med-left">
                      <div className="med-icon">
                        <Pill size={18} />
                      </div>
                      <div>
                        <div className="med-name">{med.name}</div>
                        <div className="med-dose">{med.dosage}</div>
                        <div className="med-meta">{med.frequency} {med.duration ? `· ${med.duration}` : ''}</div>
                      </div>
                    </div>
                    <span className="med-set">✓ Set</span>
                  </div>
                ))
              )}
            </div>

            {result && (
              <div className="side-col reveal in-view">
              {result.interactions.length === 0 ? (
                // ALL CLEAR STATE
                <div className="alert-card" style={{ background: "var(--sage-dim)", borderColor: "rgba(76,122,86,.35)" }}>
                  <div className="alert-head">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{color: "var(--sage)"}}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>All Clear</span>
                  </div>
                  <span className="sev-tag" style={{ color: "var(--sage)", background: "rgba(76,122,86,.16)" }}>Safe</span>
                  <p>No significant drug interactions detected. Safe to administer as prescribed.</p>
                </div>
              ) : (
                result.interactions.map((interaction, idx) => (
                  <div className="alert-card" key={idx} style={
                    interaction.severity === 'CRITICAL' ? { background: "var(--pulse-dim)", borderColor: "rgba(210,74,59,.35)" } : {}
                  }>
                    <div className="alert-head">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={
                        interaction.severity === 'CRITICAL' ? { color: "var(--pulse)" } : {}
                      }>
                        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
                        <path d="M12 9v4"/>
                        <path d="M12 17h.01"/>
                      </svg>
                      <span>Interaction flagged</span>
                    </div>
                    <span className="sev-tag" style={
                      interaction.severity === 'CRITICAL' ? { color: "var(--pulse)", background: "rgba(210,74,59,.16)" } : {}
                    }>{interaction.severity}</span>
                    <p style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
                      {interaction.drugs.join(" + ")}
                    </p>
                    <p>{interaction.clinicalEffect}</p>
                  </div>
                ))
              )}

              <div className="actions-card">
                <h3>Recommended actions</h3>
                {result.nextSteps.length > 0 ? (
                  result.nextSteps.map((step, idx) => (
                    <div className="action-row" key={idx}>
                      <span className="action-num">{idx + 1}</span>
                      <p>{step}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="action-row">
                      <span className="action-num">1</span>
                      <p>Schedule a review with your healthcare provider to discuss this medication list.</p>
                    </div>
                    <div className="action-row">
                      <span className="action-num">2</span>
                      <p>Keep an up-to-date list of everything you're taking to share at that visit.</p>
                    </div>
                  </>
                )}
                
                <div className="meta-row">
                  <span>Processed in {result.processingTime}s</span>
                  <span>PII masked</span>
                </div>
              </div>
            </div>
            )}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer>
        <div className="foot-row">
          <span className="foot-brand">Sehat Saathi · Kaggle Hackathon 2025</span>
          <div className="foot-tags">
            <span className="foot-tag">PII Masker</span>
            <span className="foot-tag">Vision AI</span>
            <span className="foot-tag">Pharmacist</span>
            <span className="foot-tag">Decision Agent</span>
          </div>
        </div>
      </footer>

      {/* GLOBAL TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              position: 'fixed',
              bottom: '40px',
              right: '40px',
              background: 'rgba(25,30,40,0.95)',
              backdropFilter: 'blur(10px)',
              padding: '16px 24px',
              borderRadius: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              border: `1px solid ${toastMessage.type === 'alert' ? 'rgba(210,74,59,0.3)' : 'rgba(76,122,86,0.3)'}`,
              zIndex: 9999
            }}
          >
            <div style={{ color: toastMessage.type === 'alert' ? 'var(--pulse)' : 'var(--sage)', marginTop: '2px' }}>
              {toastMessage.type === 'alert' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>{toastMessage.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginTop: '4px' }}>{toastMessage.desc}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
