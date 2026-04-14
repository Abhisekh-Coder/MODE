# MODE — Multiomics Decision Engine

A 3-agent sequential pipeline that transforms raw biomarker data + clinical history into a personalized, doctor-humanized health roadmap.

## Quick Start

```bash
# 1. Clone and setup
cd mode
pip install -r requirements.txt
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# 2. Run backend
cd src
python app.py

# 3. Run frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Architecture

```
Upload Files → Parse/OCR → Agent 1 (Opus) → Review → Agent 2 (Sonnet) → Review → Agent 3 (Sonnet) → Review → Export XLSX
```

| Agent | Model | What It Builds | Cost |
|-------|-------|---------------|------|
| Agent 1 | claude-opus-4-6 | Sheet 3: 25-section biomarker analysis + MODE cluster analysis | ~$2.50 |
| Agent 2 | claude-sonnet-4 | Sheet 4: 9 FOXO systems × 4 columns | ~$0.25 |
| Agent 3 | claude-sonnet-4 | Sheet 5: 3-phase humanized roadmap + 6 biweekly cards | ~$0.30 |

Total: ~$3.05/pipeline, 6-10 minutes.

## Input Files

**Mandatory (all 3 required):**
- Biomarker XLSX (with Foxo Optimal Range + Severity columns)
- Clinical History (DOCX or PDF)
- Symptoms Scoring (PDF — OCR'd automatically if scanned)

**Optional (advanced mapping):**
- Radiology imaging reports (PDF/DICOM)
- Physiotherapy assessment (PDF/DOCX)
- CT scan reports (PDF/DICOM)

## Output — 5 Sheets

| Sheet | Content |
|-------|---------|
| Sheet 1 | Parsed input summary |
| Sheet 2 | Raw biomarker data |
| Sheet 3 | Agent 1: Biomarker analysis with personalized implications |
| Sheet 4 | Agent 2: 9 FOXO systems (Key Insights, Root Cause, Clinical, Clarity Card) |
| Sheet 5 | Agent 3: 3-Phase humanized roadmap + 30 biweekly cards |

## Key Features

- **Human-in-the-loop**: Review and edit agent output before proceeding
- **Prompt editing**: View and modify agent prompts per-run
- **Process logs**: Every action logged with expandable prompt/response
- **OCR pipeline**: Scanned PDFs auto-detected and processed via Claude Vision
- **Quality gates**: Automated validation after each agent (character ranges, jargon detection, marker verification)

## Project Structure

```
mode/
├── prompts/          # 4 prompt templates (foundation + 3 agents)
├── src/
│   ├── app.py        # Flask entry point
│   ├── pipeline/     # Orchestrator + logging
│   ├── parsers/      # File parsers + OCR
│   ├── builders/     # XLSX output builder
│   ├── validators/   # Quality gate checks
│   └── routes/       # REST + SSE API endpoints
├── frontend/         # React + TypeScript + Tailwind
└── docs/             # PRD + wireframes
```

## API Endpoints

```
POST   /api/playbook                 Create playbook with files
GET    /api/playbooks                List all playbooks
GET    /api/pipeline/:id/status      Pipeline status
POST   /api/pipeline/:id/agent/:n/run    Run agent N (SSE stream)
POST   /api/pipeline/:id/agent/:n/approve  Approve with edits
POST   /api/pipeline/:id/agent/:n/reject   Reject with feedback
GET    /api/pipeline/:id/agent/:n/output   Get parsed output
GET    /api/pipeline/:id/agent/:n/prompt   Get full prompt
PUT    /api/pipeline/:id/agent/:n/prompt   Update prompt
GET    /api/pipeline/:id/logs              Get filtered logs
GET    /api/pipeline/:id/export            Download XLSX
```

## Docs

- `MODE_PRD_v3_FINAL.md` — Complete technical specification
- `CLAUDE_CODE_INSTRUCTION.md` — Build instructions for Claude Code
