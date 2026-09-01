# 🚀 Let's Apply — AI Internship Application Agent

**Let's Apply** is a client-side Chrome Extension (Manifest V3) designed to streamline and automate the internship application process on **Internshala**. It evaluates job postings semantically against your ground-truth profile and generates tailored, hallucination-free answers to screening questions using high-speed LLM inference (Groq).

---

## ✨ Features

- 🎯 **Semantic Match Scoring:** Computes compatibility (0–100%) with concise bullet points explaining alignment.
- ⚡ **Zero-Hallucination Answers:** Strictly grounded in your verified profile (projects, metrics, skills, experience).
- 🪄 **One-Click Form Auto-Fill:** Dispatches native synthetic events so Internshala's forms detect value updates immediately.
- 📄 **Client-Side Resume Parsing:** Uses `pdfjs-dist` to parse PDF resumes locally in the browser.
- 🔒 **100% Client-Side Privacy:** API keys and profile data are stored exclusively in `chrome.storage.local`.
- ⚡ **Groq Cloud LLM Inference:** Sub-2-second response times using Llama 3.3 70B Versatile / Llama 3.1 8B.

---

## 🛠️ Tech Stack

- **Framework:** [WXT](https://wxt.dev/) (Web Extension Toolbox) + React 19 + TypeScript
- **Styling:** Tailwind CSS + Lucide Icons
- **AI Inference:** [Groq Cloud API](https://console.groq.com/) (`llama-3.3-70b-versatile`)
- **PDF Parser:** `pdfjs-dist` (Client-side)
- **Target Platform:** Chrome Manifest V3

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js (v20+)
- Free [Groq API Key](https://console.groq.com/keys)

### 2. Installation & Setup

```bash
# Clone the repository
git clone https://github.com/CyberCodezilla/Lets_Apply.git
cd Lets_Apply

# Install dependencies
npm install

# Start development server with HMR
npm run dev

# Or build for production
npm run build
```

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `.output/chrome-mv3` directory.
4. The **Options Page** will open automatically — enter your Groq API key and configure your profile.

---

## 🖥️ Usage Workflow

1. Navigate to any internship detail page on [Internshala](https://internshala.com/).
2. Click the **Let's Apply** extension icon in the toolbar to open the Side Panel.
3. Click **"Analyze Page"** — the extension scrapes the page and requests Groq inference.
4. Review the **Match Score** and AI-drafted answers to screening questions.
5. Click **"Auto-Fill Form"** — inputs on Internshala will be populated instantly.
6. Verify and click Internshala's Submit button.

---

## 📄 License

MIT License
