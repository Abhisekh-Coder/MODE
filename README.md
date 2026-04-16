# MODE — Multiomics Decision Engine

> 3-agent AI pipeline that transforms raw biomarker data into a personalized 12-month health roadmap.

**Live:** [mode-app on Vercel](https://mode-app-gilt.vercel.app) · **Repo:** [GitHub](https://github.com/Abhisekh-Coder/MODE)

---

## What It Does

Upload biomarker XLSX + clinical history + symptoms → Three AI agents sequentially analyze, map health systems, and generate a personalized protocol:

| Agent | Model | Task | Output | Cost |
|-------|-------|------|--------|------|
| **Agent 1** | Opus 4.6 | 25-section biomarker analysis + MODE clusters | Sheet 3 + cluster handoff | ~$2.50 |
| **Agent 2** | Sonnet 4 | 9 FOXO health systems × 4 columns each | Sheet 4 + system handoff | ~$0.25 |
| **Agent 3** | Sonnet 4 | 3-phase roadmap + 30 biweekly protocol cards | Sheet 5 | ~$0.30 |

**Total: ~$3.05/run · ~8 min · 5-sheet XLSX playbook**

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 · TypeScript · Tailwind CSS · Vite · Zustand |
| Backend | Flask · Python 3.13 |
| AI | Anthropic Claude API (streaming SSE) |
| Database | Supabase (PostgreSQL + REST) |
| Deploy | Vercel (static + serverless Python) |
| UI | Glassmorphism · Dark purple theme · Animations |

---

## Project Structure

<!-- ARCHITECTURE:START — auto-update this section when files change -->
```
MODE_v3_Complete/
│
├── api/                              Vercel serverless function
│   ├── index.py                        Python request handler (no Flask)
│   └── requirements.txt                Python deps (httpx, python-dotenv)
│
├── data/                             Reference data
│   └── foxo_ranges.csv                 FOXO optimal ranges (90+ biomarkers)
│
├── docs/                             Archived build documentation
│   ├── CLAUDE_CODE_INSTRUCTION.md       Build instructions
│   └── MODE_PRD_v3_FINAL.md            Full PRD (70KB)
│
├── frontend/                         React SPA (Vite + TypeScript + Tailwind)
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts               API client (fetch + EventSource)
│   │   ├── components/
│   │   │   └── Layout.tsx               Sidebar nav + main container
│   │   ├── hooks/
│   │   │   └── useStreaming.ts          SSE streaming hook for agent output
│   │   ├── pages/
│   │   │   ├── Landing.tsx              Glassmorphism landing page
│   │   │   ├── Login.tsx                Session auth (ID + password)
│   │   │   ├── Dashboard.tsx            Playbook list with status cards
│   │   │   ├── NewPlaybook.tsx          Member form + drag-drop file upload
│   │   │   ├── Pipeline.tsx             Agent cards · Sheets · Logs · Uploads
│   │   │   ├── SettingsPrompts.tsx      Side-by-side prompt editor
│   │   │   └── SettingsModels.tsx       Cost tracking (USD + INR)
│   │   ├── store/
│   │   │   └── pipelineStore.ts         Zustand state management
│   │   └── types/
│   │       └── index.ts                 TypeScript interfaces (228 lines)
│   ├── index.html                    Entry HTML
│   ├── package.json                  Dependencies (React, Zustand, Lucide, etc.)
│   ├── tailwind.config.js            Tailwind config
│   ├── tsconfig.json                 TypeScript config
│   └── vite.config.ts                Vite config + API proxy
│
├── prompts/                          AI prompt templates (injected at runtime)
│   ├── foundation.txt                  FOXO system · MODE engine · anti-hallucination
│   ├── Biomarker.txt                   FOXO optimal ranges reference table
│   ├── agent1_biomarker_analysis.txt   25 sections + cluster analysis + handoff
│   ├── agent2_system_mapping.txt       9 systems × 4 columns (KI, RC, CI, CC)
│   └── agent3_humanized_roadmap.txt    3 phases + 30 biweekly cards
│
├── src/                              Python backend (Flask)
│   ├── app.py                          Flask entry point (port 5001)
│   ├── builders/
│   │   └── xlsx_builder.py             5-sheet XLSX export with styling
│   ├── parsers/
│   │   ├── biomarkers.py               XLSX parser (openpyxl)
│   │   ├── biomarker_ranges.py         FOXO range lookup · 5-band classify · validate
│   │   ├── clinical_history.py         DOCX/text parser
│   │   ├── ocr_pipeline.py             Claude Vision OCR for scanned PDFs
│   │   ├── agent_output.py             LLM response parser (sections, systems, cards)
│   │   └── handoff_builder.py          Auto-builds handoff when agent hits token limit
│   ├── pipeline/
│   │   ├── orchestrator.py             State machine · agent runner · checkpoints
│   │   ├── claude_client.py            Anthropic API streaming (httpx, no SDK)
│   │   ├── db.py                       Supabase REST persistence (urllib, no SDK)
│   │   └── log_store.py                In-memory + DB event logging
│   ├── routes/
│   │   └── api.py                      22 REST endpoints + SSE streaming
│   └── validators/
│       └── quality_gates.py            FOXO range validation + structural checks
│
├── .env.example                      Environment variable template
├── .gitignore                        Git exclusions
├── .vercelignore                     Vercel upload exclusions
├── supabase_schema.sql               Database schema (7 tables)
├── vercel.json                       Deployment config (frontend + serverless)
└── README.md                         This file
```

**Stats:** 48 source files · ~5,200 lines · 7 pages · 5 prompts · 22 API endpoints
<!-- ARCHITECTURE:END -->

---

## Setup

### Prerequisites
- Python 3.13+ · Node.js 18+ · Anthropic API key · Supabase project

### 1. Environment
```bash
cp .env.example .env
```
```
ANTHROPIC_API_KEY=sk-ant-api03-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
OPUS_MODEL=claude-opus-4-6
SONNET_MODEL=claude-sonnet-4-20250514
```

### 2. Database
Run `supabase_schema.sql` in Supabase SQL Editor → creates 7 tables:
`playbooks` · `agent_runs` · `agent_outputs` · `upload_files` · `pipeline_logs` · `pipeline_data` · `settings`

### 3. Backend
```bash
pip install -r api/requirements.txt
cd src && python app.py          # http://localhost:5001
```

### 4. Frontend
```bash
cd frontend && npm install && npm run dev    # http://localhost:3000
```

### 5. Deploy to Vercel
```bash
vercel --prod
```

---

## Pipeline Flow

```
  ┌─────────────┐
  │  Upload      │  Biomarker XLSX · Clinical DOCX · Symptoms PDF
  │  + Parse     │  pandas/openpyxl · python-docx · Claude Vision OCR
  └──────┬───────┘
         │
         ▼
  ┌─────────────────────────────────────┐
  │  Agent 1 — Biomarker Analysis       │  Model: Opus 4.6
  │  25 clinical sections               │  ~30K tokens output
  │  MODE cluster classification (C1-C8)│  ~$2.50
  └──────┬──────────────────────────────┘
         │ cluster_handoff (8 clusters)
         ▼
  ┌─────────────────────────────────────┐
  │  Agent 2 — System Mapping           │  Model: Sonnet 4
  │  9 FOXO systems × 4 columns        │  ~25K tokens output
  │  Key Insights · Root Cause ·        │  ~$0.25
  │  Clinical Implications · Clarity    │
  └──────┬──────────────────────────────┘
         │ system_handoff (9 systems)
         ▼
  ┌─────────────────────────────────────┐
  │  Agent 3 — Humanized Roadmap        │  Model: Sonnet 4
  │  3-phase annual plan                │  ~30K tokens output
  │  30 biweekly protocol cards         │  ~$0.30
  │  Nutrition·Activity·Stress·Sleep    │
  └──────┬──────────────────────────────┘
         │
         ▼
  ┌─────────────┐
  │  Export      │  5-sheet XLSX playbook
  │  Playbook    │  Persisted to Supabase
  └─────────────┘
```

---

## Key Features

| Feature | Detail |
|---------|--------|
| **FOXO 5-Band** | LOW · LOW_NORMAL · OPTIMAL · HIGH_NORMAL · HIGH (not lab ranges) |
| **90+ ranges** | Gender/age-specific from `data/foxo_ranges.csv` |
| **Human-in-the-loop** | Edit agent output before handoff extraction |
| **Auto handoff** | Builds cluster/system handoff when agent hits token limit |
| **Supabase persistence** | All state survives server restarts |
| **Error recovery** | Retry failed agent without restarting pipeline |
| **Cost tracking** | Per-agent USD + INR with token breakdown |
| **Quality gates** | FOXO range compliance + structural validation |
| **Glass UI** | Dark purple theme · glassmorphism · animations |

---

## API Endpoints

```
POST   /api/playbook                      Create playbook with file upload
GET    /api/playbooks                     List all playbooks
GET    /api/pipeline/:id/status           Pipeline status + cost
GET    /api/pipeline/:id/agent/:n/run     Run agent N (SSE stream)
POST   /api/pipeline/:id/agent/:n/approve Approve with optional edits
POST   /api/pipeline/:id/agent/:n/reject  Reject with feedback
GET    /api/pipeline/:id/agent/:n/output  Parsed output + raw preview
GET    /api/pipeline/:id/agent/:n/prompt  Full assembled prompt
PUT    /api/pipeline/:id/agent/:n/prompt  Override prompt for this run
GET    /api/pipeline/:id/agent/:n/handoff Handoff block
GET    /api/pipeline/:id/sheet/:n         Sheet data (1-5)
GET    /api/pipeline/:id/uploads          Upload file details
GET    /api/pipeline/:id/logs             Filtered process logs
GET    /api/pipeline/:id/export           Download XLSX
GET    /api/settings/prompts              Prompt file contents
PUT    /api/settings/prompts              Save edited prompts
GET    /api/settings/models               Model config + cost data
```

---

## Credentials

| Service | Variable | Where |
|---------|----------|-------|
| Anthropic | `ANTHROPIC_API_KEY` | `.env` |
| Supabase | `SUPABASE_URL` + `SUPABASE_KEY` | `.env` |
| App Login | `Abhisekh_2026` / `12345@abhi` | Session auth |

---

## License

Private — FOXO Health
