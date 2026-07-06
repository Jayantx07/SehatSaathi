<div align="center">

# Sehat Saathi – Multi-Agent AI Medication Concierge

### Intelligent Medication Tracking & Safety Platform | Kaggle Hackathon

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green?logo=node.js)
![Express](https://img.shields.io/badge/Express.js-API-black?logo=express)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styling-38BDF8?logo=tailwindcss)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-Animations-blue?logo=framer)
![MCP](https://img.shields.io/badge/MCP-Tooling-orange)
![Cron](https://img.shields.io/badge/Node--Cron-Background_Jobs-yellow)

### Bridging the gap between getting a prescription and safely consuming it day-to-day.

</div>

---

# Overview

Sehat Saathi acts as an intelligent, automated concierge for patients managing multiple medications. It bridges the gap between getting a prescription and safely consuming it day-to-day.

The platform combines an advanced multi-agent AI pipeline for prescription analysis with a beautiful, responsive tracking dashboard, ensuring medication safety, schedule adherence, and timely refills.

---

# Core Features

## 1. Prescription Analysis Pipeline (Multi-Agent System)

- **Agent 1: Extraction Agent** — Securely extracts medications, dosages, frequencies, and duration from an uploaded prescription image.
- **Agent 2: Pharmacist Analyst** — Checks for critical drug-drug interactions between the newly prescribed medications and the patient's existing inventory.
- **Agent 3: Decision & Action Agent** — Determines if an alert needs to be sent based on interactions, and securely triggers email warnings via a Model Context Protocol (MCP) tool.
- **Privacy First (PII Masking)** — A custom Express middleware intercepts sensitive fields (like Patient Name and Email) and masks them before they ever reach the LLM, ensuring HIPAA-level compliance.

---

## 2. Live Medication Tracker (CDSS Dashboard)

- **Premium UI** — Built with Next.js, Framer Motion, and Lucide icons using Antigravity design principles (glassmorphism, subtle pulses, and dark sage styling).
- **Inventory Management** — Extracts are seamlessly saved to a local JSON inventory, tracked per user.
- **Dose Consumption** — Patients can click "Take Dose" to optimistically reduce their stock in the UI and log the consumption in the backend.

---

## 3. Automated Refills & Alerts

- **Cron Jobs** — A background Node-Cron service runs every minute to check medication schedules and stock levels.
- **Email Integration** — Automatically sends beautiful HTML emails via Resend when it's time to take a pill.
- **Low Stock Workflow** — If stock drops to 3 or below:
  - The UI turns red.
  - A "🛒 Order Refill" button appears, linking directly to the 1mg search page for that specific medicine.
  - A subtle "+ Refill" button appears, allowing the user to seamlessly specify how many pills they bought (e.g. +15) to replenish their tracker instantly.

---

# How to Demo to Judges

### 1. Start the Server
Make sure both `npm run dev` in frontend and backend are running.

### 2. Upload a Prescription
Use the dropzone to upload a sample prescription. Watch the 4-step loading animation (it looks great on screen).

### 3. Show the Multi-Agent Logic
Point out the terminal logs on the backend showing the PII masking taking effect and the three agents coordinating.

### 4. Dashboard Interaction
Scroll down to the Live Dashboard.
- Click **Take Dose** and watch the stock drop.
- Click the **Simulate Live Alert** cheat button to show them how the automated email reminder looks in your inbox.
- Click **Take Dose** until stock drops to 3. Show how the UI turns red, click **Order Refill** to open 1mg, and then use the **+ Refill** input to restock the inventory.

---

# Tech Stack

## Frontend
- React.js (Next.js)
- Tailwind CSS
- Framer Motion
- Lucide Icons

## Backend
- Node.js
- Express.js
- Custom PII Masking Middleware
- Node-Cron

## AI & Tooling
- Multi-Agent Pipeline (Extraction, Pharmacist, Decision)
- Model Context Protocol (MCP) Integration
- Resend (Email APIs)

---

# Key Engineering Highlights

### Multi-Agent Orchestration
- Coordinated logic spanning three specialized AI agents, ensuring high accuracy and robust interaction checking.

### Privacy-First Architecture
- Built-in HIPAA-aware middleware that sanitizes PII before AI processing.

### Premium User Experience
- Real-time responsive dashboard utilizing glassmorphism and smooth framer-motion animations for seamless interaction.

---

# Problem Statement

Managing multiple medications safely is challenging. Patients often face issues like missed doses, harmful drug interactions, and running out of medicine unexpectedly.

Sehat Saathi addresses this by providing an all-in-one platform that proactively manages prescriptions, analyzes interactions, reminds users of doses, and tracks inventory—all in a highly secure, beautifully designed interface.

---

# Developer

### Jayant Kumawat

Frontend-Focused Full-Stack Developer

Portfolio  
http://fun-project-875083.framer.app/

---

# Repository Support

If you find this project valuable:
- Star the repository
- Share feedback

---

### Sehat Saathi — Safe, Intelligent, and Automated Medication Management.
