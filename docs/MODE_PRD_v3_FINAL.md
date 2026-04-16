# MODE — Multiomics Decision Engine
## Product Requirements Document v3.0 — Final Build Specification
## App Name: MODE | Tagline: Multiomics Decision Engine

---

# TABLE OF CONTENTS

1. Product Overview
2. Page Architecture & Navigation
3. State Machine
4. Data Flow Between Agents
5. OCR & Document Processing Pipeline
6. File Parsers (Complete Code)
7. Pipeline Orchestrator (Complete Code)
8. API Endpoints
9. Prompt Templates
10. XLSX Builder
11. Quality Gate Validators
12. Logging System (Complete Code)
13. Frontend Component Architecture
14. Token Optimization Strategy
15. Deployment Guide
16. Project File Structure
17. Environment Configuration

---

# 1. PRODUCT OVERVIEW

## 1.1 What MODE Is
A 3-agent sequential pipeline that transforms raw biomarker data, clinical history, symptoms, and optional advanced inputs (radiology, physio, CT scan) into a personalized, doctor-humanized health roadmap. Each agent builds on the previous, with human-in-the-loop review gates and comprehensive logging.

## 1.2 Pipeline (3 Agents)

```
[Upload] → [Parse + OCR] → [Agent 1: Analysis] → [Review/Edit/Approve]
  → [Agent 2: System Mapping] → [Review/Edit/Approve]
  → [Agent 3: Humanized Roadmap] → [Review/Edit/Approve] → [Export XLSX]
```

## 1.3 Input Data Types

| Input | Format | Required | OCR? |
|-------|--------|----------|------|
| Biomarker Mastersheet | XLSX | Mandatory | No |
| Clinical History | DOCX/PDF | Mandatory | If scanned PDF |
| Symptoms Scoring | PDF (Google Forms) | Mandatory | Yes |
| Radiology Imaging | PDF/DICOM/Image | Optional (Advanced) | Yes |
| Physio Assessment | PDF/DOCX | Optional (Advanced) | If scanned |
| CT Scan Report | PDF/DICOM | Optional (Advanced) | Yes |

## 1.4 Output — 5 Sheets with View/Edit/Download

| Sheet | Source | Content |
|-------|--------|---------|
| Sheet 1: Input | Parser | Parsed data summary |
| Sheet 2: Raw | Upload | Raw biomarker data (source of truth) |
| Sheet 3: Analysis | Agent 1 | 25-section analysis + MODE cluster handoff |
| Sheet 4: Systems | Agent 2 | 9 FOXO systems × 4 columns |
| Sheet 5: Roadmap | Agent 3 | 3-Phase humanized roadmap + 6 biweekly cards |

---

# 2. PAGE ARCHITECTURE & NAVIGATION

## 2.1 Complete Page Map

```
APP SHELL (persistent)
├── Header: MODE logo + tagline + user email
├── Sidebar Navigation (always visible)
│   ├── Dashboard (home)
│   ├── Pipeline (per-run context)
│   ├── ── separator ──
│   ├── Settings > Agents
│   ├── Settings > Prompts
│   └── Settings > Models
└── Main Content Area (switches by page)

PAGES:
1. Dashboard (/dashboard)
   └── Playbook list + "New Playbook" creation

2. New Playbook (/dashboard/new)
   └── Member details form + file upload zone

3. Pipeline (/pipeline/:runId)
   ├── Tab: Agents (agent cards with prompt view/edit/rerun)
   ├── Tab: Sheets (5 sheet tabs with view/edit/download)
   ├── Tab: Process Logs (filterable, per-run)
   └── Tab: Upload Logs (file parsing details)

4. Settings: Agents (/settings/agents)
   └── Per-agent config: model, tokens, temperature, toggle

5. Settings: Prompts (/settings/prompts)
   └── Editable text for foundation + 3 agent prompts

6. Settings: Models (/settings/models)
   └── API key, model assignments, cost tracking
```

## 2.2 Dashboard Page

```
┌─────────────────────────────────────────────┐
│ Playbooks                 [+ New playbook]  │
│ 3 playbooks created                         │
│                                             │
│ ┌─ Playbook Card ──────────────────────────┐│
│ │ Karteek Narumanchi       10 Apr 2026     ││
│ │ 37M · Bengaluru · 262 markers            ││
│ │ [●Upload] [●Agent1] [◉Agent2] [○Agent3] ││
│ │                Agent 2 in progress — 67%  ││
│ └──────────────────────────────────────────┘│
│ ┌─ Playbook Card ──────────────────────────┐│
│ │ Nipun Kanade              8 Apr 2026     ││
│ │ 34F · Mysore · 169 markers               ││
│ │ [●Upload] [●Agent1] [●Agent2] [●Agent3] ││
│ │                    Complete — exported    ││
│ └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘

Actions:
- "+ New playbook" → opens New Playbook form
- Click any card → navigates to Pipeline page for that run
- Failed runs show red status with "View logs" link
```

## 2.3 New Playbook Page

```
┌─────────────────────────────────────────────┐
│ Dashboard / New playbook                    │
│                                             │
│ MEMBER DETAILS                              │
│ [Name*] [Age/Sex*] [Location] [Occupation]  │
│ [Height] [Weight]                           │
│                                             │
│ UPLOAD DOCUMENTS                            │
│ ┌──── Drop zone ────────────────────────┐  │
│ │  Drop files or click to browse        │  │
│ │  XLSX, DOCX, PDF, DICOM, JPG, PNG    │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ Mandatory: [✓ Biomarker] [✓ Clinical Hx]   │
│            [✓ Symptoms]                     │
│ Optional:  [+ Radiology] [+ Physio] [+ CT] │
│                                             │
│            [Cancel] [Create & Start Pipeline]│
└─────────────────────────────────────────────┘
```

## 2.4 Pipeline Page — Agents Tab

```
┌─────────────────────────────────────────────┐
│ Dashboard / Karteek Narumanchi · Run #a3f   │
│ [Agents] [Sheets] [Process Logs] [Uploads]  │
│                                             │
│ ┌─ Agent 1: Biomarker Analysis ─── ●Done ──┐│
│ │ 25 sections, 262 markers analyzed         ││
│ │ Opus 4.6 | 28,431 tok | 152s | $2.38     ││
│ │ [View Prompt][Edit Prompt][Output]        ││
│ │ [View Handoff][Re-run]                    ││
│ │                                           ││
│ │ ▼ Prompt (expandable):                    ││
│ │ ┌─────────────────────────────────────┐   ││
│ │ │ <FOXO_SYSTEM>                       │   ││
│ │ │ <BELIEF_SYSTEM>...                  │   ││
│ │ │ AGENT 1 PROMPT...                   │   ││
│ │ │ --- SHEET 2 DATA ---                │   ││
│ │ │ | Aluminium | 15.06 | ...           │   ││
│ │ └─────────────────────────────────────┘   ││
│ └───────────────────────────────────────────┘│
│                                             │
│ ┌─ Agent 2: System Mapping ─── ◉Running ───┐│
│ │ Building 9 systems, system 6/9...         ││
│ │ ████████████████░░░░░░░░ 67%              ││
│ │ Sonnet 4 | ~16,800 tok | 84s             ││
│ │                                           ││
│ │ Streaming output:                         ││
│ │ ┌─────────────────────────────────────┐   ││
│ │ │ === GUT | STRAINED | CORRECT ===    │   ││
│ │ │ Key Insights: Gut barrier...█       │   ││
│ │ └─────────────────────────────────────┘   ││
│ │                                           ││
│ │ Process steps:                            ││
│ │ ✓ Foundation injected (4,833 tok)         ││
│ │ ✓ Cluster handoff loaded (edited)         ││
│ │ ⟳ Streaming output (16,800/~25K)          ││
│ │ ○ Parse 9 systems                         ││
│ │ ○ Run 45 quality checks                   ││
│ │                                           ││
│ │ [View Prompt][Edit Prompt][Cancel]        ││
│ └───────────────────────────────────────────┘│
│                                             │
│ ┌─ Agent 3: Humanized Roadmap ── ○Waiting ─┐│
│ │ Waiting for Agent 2 approval              ││
│ │ Sonnet 4 | Est. ~30K tok | Est. $0.30     ││
│ │ [View Prompt][Edit Prompt]                ││
│ └───────────────────────────────────────────┘│
│                                             │
│ [+ Add custom agent]                        │
└─────────────────────────────────────────────┘
```

## 2.5 Pipeline Page — Sheets Tab

```
┌─────────────────────────────────────────────┐
│ [Sheet1:input] [Sheet2:raw] [Sheet3:analysis]│
│ [Sheet4:systems] [Sheet5:roadmap]           │
│ [View] [Edit] [Download .xlsx]              │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │Biomarker │Value │Range │Status│Implication│
│ │──────────│──────│──────│──────│──────────│ │
│ │Aluminium │15.06 │0-5.0 │H.Norm│[editable]│ │
│ │Lead      │27.35 │0-2.0 │H.Norm│[editable]│ │
│ │Selenium  │113.8 │70-121│Optim │[readonly]│ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Approve & Continue →] [Request Changes]    │
└─────────────────────────────────────────────┘
```

## 2.6 Pipeline Page — Process Logs Tab

```
┌─────────────────────────────────────────────┐
│ [All agents ▼] [INFO+ ▼] [Search...] [Export]│
│                                             │
│ 10:23:01 [INFO] Pipeline init. #a3f-827     │
│ 10:23:05 [INFO] Biomarkers.xlsx (27KB)      │
│ 10:23:05 [DBG]  262 markers parsed          │
│ 10:23:10 [DBG]  Symptoms: scanned → OCR     │
│ 10:23:22 [INFO] OCR done: 55pg, $0.14       │
│ 10:23:24 [INFO] Agent 1 start ▸view prompt  │
│ 10:25:44 [INFO] Agent 1 done ▸view response │
│ 10:25:48 [WARN] S3 Clarity: 1,342ch (>850)  │
│ 10:26:30 [INFO] User approved (2 edits) ▸diff│
│ 10:26:31 [DBG]  Handoff extracted (edited)   │
│ 10:26:32 [INFO] Agent 2 start ▸view prompt  │
└─────────────────────────────────────────────┘
```

## 2.7 Pipeline Page — Upload Logs Tab

```
┌─────────────────────────────────────────────┐
│ Upload logs — Run #a3f-827                  │
│                                             │
│ File               │Method    │Result       │
│ Biomarkers.xlsx    │pandas    │262 markers  │
│ Clinical_Hx.docx   │python-docx│2,340 words │
│ Symptoms.pdf       │Vision OCR│55pg $0.14   │
│                                             │
│ No advanced inputs for this run.            │
│                                             │
│ OCR Detail:                                 │
│ 10:23:10 [DBG] PDF: scanned (42 ch/page)   │
│ 10:23:11 [INFO] OCR: 55 pages, 300 DPI     │
│ 10:23:22 [INFO] Done: 4,218 tokens, $0.14  │
└─────────────────────────────────────────────┘
```

## 2.8 Settings: Agents

```
┌─────────────────────────────────────────────┐
│ Agent Configuration                         │
│                                             │
│ ┌─ Agent 1: Biomarker Analysis ── [ON/OFF] ┐│
│ │ Model: [claude-opus-4-6 ▼]              ││
│ │ Max tokens: [30000]  Temp: [0]          ││
│ │ Prompt: [agent1_biomarker_analysis.txt ▼]││
│ │ Receives: Sheet 2 + clinical hx          ││
│ │ Produces: Sheet 3 + cluster handoff      ││
│ └──────────────────────────────────────────┘│
│ ┌─ Agent 2 ── [ON/OFF] ───────────────────┐│
│ │ Model: [claude-sonnet-4 ▼]              ││
│ │ ...                                      ││
│ └──────────────────────────────────────────┘│
│ ┌─ Agent 3 ── [ON/OFF] ───────────────────┐│
│ │ Model: [claude-sonnet-4 ▼]              ││
│ │ ...                                      ││
│ └──────────────────────────────────────────┘│
│ [+ Add custom agent]                        │
│                            [Save config]    │
└─────────────────────────────────────────────┘
```

## 2.9 Settings: Prompts

```
┌─────────────────────────────────────────────┐
│ Prompt Editor                               │
│                                             │
│ ┌─ Foundation Prompt (4,833 bytes) ────────┐│
│ │ <FOXO_SYSTEM>                            ││
│ │ <BELIEF_SYSTEM>                          ││
│ │ You operate under FOXO's preventive...   ││
│ │ [full editable textarea]                 ││
│ └──────────────────────────────────────────┘│
│ ┌─ Agent 1 Prompt ────────────────────────┐│
│ │ [full editable textarea]                 ││
│ └──────────────────────────────────────────┘│
│ ┌─ Agent 2 Prompt ────────────────────────┐│
│ │ [full editable textarea]                 ││
│ └──────────────────────────────────────────┘│
│ ┌─ Agent 3 Prompt ────────────────────────┐│
│ │ [full editable textarea]                 ││
│ └──────────────────────────────────────────┘│
│                          [Save all prompts] │
└─────────────────────────────────────────────┘
```

## 2.10 Settings: Models

```
┌─────────────────────────────────────────────┐
│ Model Configuration                         │
│                                             │
│ API Key: [sk-ant-api03-xxxx...xxxx]        │
│ Default: [claude-sonnet-4 ▼]               │
│                                             │
│ Agent │ Model      │ Why           │ Cost   │
│ A1    │ opus-4-6   │ Complex xref  │ ~$2.50 │
│ A2    │ sonnet-4   │ Structured gen│ ~$0.25 │
│ A3    │ sonnet-4   │ Structured gen│ ~$0.30 │
│ OCR   │ sonnet-4   │ Vision        │$0.03/pg│
│                                             │
│ This month: $9.58 (3 runs, avg $3.19/run)  │
│                          [Save settings]    │
└─────────────────────────────────────────────┘
```

---

# 3. STATE MACHINE

```typescript
type PipelineState =
  | 'IDLE'
  | 'DATA_UPLOADED'
  | 'AGENT_1_RUNNING' | 'AGENT_1_REVIEW'
  | 'AGENT_2_RUNNING' | 'AGENT_2_REVIEW'
  | 'AGENT_3_RUNNING' | 'AGENT_3_REVIEW'
  | 'COMPLETE'
  | 'ERROR';

// Transitions
upload_data()       : IDLE → DATA_UPLOADED
run_agent_1()       : DATA_UPLOADED → AGENT_1_RUNNING
agent_1_complete()  : AGENT_1_RUNNING → AGENT_1_REVIEW
approve_agent_1()   : AGENT_1_REVIEW → AGENT_2_RUNNING (with optional edits)
reject_agent_1()    : AGENT_1_REVIEW → AGENT_1_RUNNING (re-run with feedback)
agent_2_complete()  : AGENT_2_RUNNING → AGENT_2_REVIEW
approve_agent_2()   : AGENT_2_REVIEW → AGENT_3_RUNNING
reject_agent_2()    : AGENT_2_REVIEW → AGENT_2_RUNNING
agent_3_complete()  : AGENT_3_RUNNING → AGENT_3_REVIEW
approve_agent_3()   : AGENT_3_REVIEW → COMPLETE
reject_agent_3()    : AGENT_3_REVIEW → AGENT_3_RUNNING
error_any()         : ANY → ERROR (with recovery context)
reset()             : ANY → IDLE
```

---

# 4. DATA FLOW BETWEEN AGENTS

```
                   ┌──────────────┐
                   │ Foundation   │ ← Injected into EVERY agent (1, 2, 3)
                   │ Prompt       │
                   │ (~4K tokens) │
                   └──────┬───────┘
                          │
  ┌───────────┐           │
  │ Uploaded   │           │
  │ Files      │           │
  │ (parsed)   │           │
  └─────┬─────┘           │
        │                  │
        ▼                  ▼
  ┌─────────────────────────────────┐
  │ AGENT 1: Biomarker Analysis      │
  │ INPUT:  foundation + agent1_prompt│
  │         + sheet2_data             │
  │         + clinical_history        │
  │         + symptoms                │
  │         + advanced_inputs (opt)   │
  │ OUTPUT: sheet3_data (JSON)        │
  │         + cluster_handoff (text)  │
  │ MODEL:  claude-opus-4-6           │
  │ TOKENS: ~15K in, ~30K out        │
  └──────────┬──────────────────────┘
             │
    USER REVIEWS → can EDIT implications
             │
    HANDOFF extracted from EDITED output
             │
             ▼
  ┌─────────────────────────────────┐
  │ AGENT 2: 9-System Mapping       │
  │ INPUT:  foundation + agent2_prompt│
  │         + cluster_handoff (edited)│
  │         + clinical_history        │
  │ OUTPUT: sheet4_data (JSON)        │
  │         + system_handoff (text)   │
  │ MODEL:  claude-sonnet-4           │
  │ TOKENS: ~10K in, ~25K out        │
  └──────────┬──────────────────────┘
             │
    USER REVIEWS → can EDIT any column
             │
    HANDOFF extracted from EDITED output
             │
             ▼
  ┌─────────────────────────────────┐
  │ AGENT 3: Humanized Roadmap      │
  │ INPUT:  foundation + agent3_prompt│
  │         + system_handoff (edited) │
  │         + clinical_history        │
  │ OUTPUT: sheet5_data (JSON)        │
  │         (3 phases + 6 biweekly    │
  │          cards in doctor language) │
  │ MODEL:  claude-sonnet-4           │
  │ TOKENS: ~12K in, ~30K out        │
  └──────────┬──────────────────────┘
             │
    USER REVIEWS → can EDIT any card
             │
             ▼
         [EXPORT XLSX]

CRITICAL RULE:
When user edits Agent N output and approves:
1. Store edited output as the approved version
2. Extract handoff from the EDITED output (not raw LLM)
3. Feed edited handoff to Agent N+1
```

---

# 5. OCR & DOCUMENT PROCESSING PIPELINE

```python
# src/parsers/ocr_pipeline.py

import anthropic
import fitz  # PyMuPDF
import base64
from pathlib import Path

client = anthropic.Anthropic()

# ═══ FILE TYPE DETECTION ═══

def detect_pdf_type(filepath: str) -> dict:
    """Determine if PDF is text-based or needs OCR."""
    doc = fitz.open(filepath)
    total_chars = sum(len(page.get_text().strip()) for page in doc)
    avg = total_chars / max(len(doc), 1)
    return {
        'type': 'text' if avg > 100 else 'scanned',
        'pages': len(doc),
        'avg_chars_per_page': round(avg)
    }

# ═══ TEXT EXTRACTION ═══

def extract_text_pdf(filepath: str) -> list[dict]:
    """Extract text from text-based PDF."""
    import pdfplumber
    pages = []
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            pages.append({
                'page_number': i + 1,
                'text': page.extract_text() or '',
                'tables': page.extract_tables() or []
            })
    return pages

# ═══ CLAUDE VISION OCR ═══

EXTRACTION_PROMPTS = {
    'medical_report': (
        "Extract ALL text and data from this medical document image. "
        "Preserve exact values, units, and table structure. Output as structured text with "
        "section headers, all biomarker/test values with exact numbers and units, "
        "reference ranges, doctor's notes. Do NOT interpret — extract verbatim."
    ),
    'radiology': (
        "Extract ALL text from this radiology/imaging report. Preserve: "
        "patient demographics, study type/date, findings (verbatim with measurements), "
        "impression/conclusion, radiologist info. Output as structured text."
    ),
    'physio_assessment': (
        "Extract ALL text from this physiotherapy assessment. Preserve: "
        "patient details, ROM measurements (exact degrees), strength grading, "
        "functional assessments, treatment plans. Output as structured text."
    ),
    'ct_scan': (
        "Extract ALL text from this CT scan report. Preserve: "
        "study details, findings by region (verbatim), measurements, "
        "impression/conclusion. Output as structured text."
    ),
    'symptoms_form': (
        "Extract ALL responses from this symptom questionnaire. For each question: "
        "the question text and the selected/checked response. "
        "Preserve section structure (Metabolic, Immunity, Cognition, Gut, etc.)."
    )
}

def ocr_with_claude_vision(filepath: str, doc_type: str = 'medical_report') -> list[dict]:
    """OCR using Claude Vision. Converts PDF pages to images, sends to Claude."""
    doc = fitz.open(filepath)
    prompt = EXTRACTION_PROMPTS.get(doc_type, EXTRACTION_PROMPTS['medical_report'])
    pages = []

    for page_num in range(len(doc)):
        pix = doc[page_num].get_pixmap(dpi=300)
        img_b64 = base64.b64encode(pix.tobytes("png")).decode('utf-8')

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
                    {"type": "text", "text": prompt}
                ]
            }]
        )

        pages.append({
            'page_number': page_num + 1,
            'text': response.content[0].text,
            'tokens_used': response.usage.input_tokens + response.usage.output_tokens,
            'method': 'claude_vision'
        })

    return pages

# ═══ MASTER FILE ROUTER ═══

def process_file(filepath: str, file_type: str = None) -> dict:
    """Route any uploaded file to the correct parser."""
    ext = Path(filepath).suffix.lower()
    result = {'filepath': filepath, 'extension': ext, 'log': []}

    if ext in ('.xlsx', '.xls'):
        result['log'].append('Parsing XLSX with pandas')
        result['data'] = parse_biomarker_xlsx(filepath)
        result['method'] = 'direct_parse'

    elif ext == '.docx':
        result['log'].append('Parsing DOCX with python-docx')
        result['data'] = parse_clinical_history_docx(filepath)
        result['method'] = 'direct_parse'

    elif ext == '.pdf':
        info = detect_pdf_type(filepath)
        result['log'].append(f'PDF: {info["type"]} ({info["avg_chars_per_page"]} chars/page)')
        if info['type'] == 'text':
            result['data'] = extract_text_pdf(filepath)
            result['method'] = 'text_extraction'
        else:
            dtype = file_type or 'medical_report'
            result['data'] = ocr_with_claude_vision(filepath, dtype)
            result['method'] = 'claude_vision_ocr'
            result['log'].append(f'OCR: {len(result["data"])} pages')

    elif ext in ('.jpg', '.jpeg', '.png', '.dcm'):
        result['data'] = ocr_with_claude_vision(filepath, file_type or 'radiology')
        result['method'] = 'claude_vision_ocr'

    return result
```

---

# 6. FILE PARSERS (Complete Code)

```python
# src/parsers/biomarkers.py

import pandas as pd

def parse_biomarker_xlsx(filepath: str) -> dict:
    """Parse FOXO biomarker mastersheet into structured data."""
    df = pd.read_excel(filepath, sheet_name=0)
    df.columns = [c.strip() for c in df.columns]

    sections = {}
    current_section = "Uncategorized"
    all_markers = []

    for _, row in df.iterrows():
        biomarker = str(row.get('Biomarker', '')).strip()
        value = row.get('Value')
        severity = str(row.get('Foxo Severity', '')).strip()
        optimal = str(row.get('Foxo Optimal Range', '')).strip()

        # Section header: Value is NaN, Severity is NaN
        if pd.isna(value) and severity in ('nan', '', 'NaN'):
            if biomarker and biomarker != 'nan':
                current_section = biomarker
                sections[current_section] = []
            continue

        if severity in ('nan', '', 'NaN'):
            continue

        marker = {
            'biomarker': biomarker,
            'value': value,
            'optimal_range': optimal,
            'severity': severity,
            'section': current_section
        }
        sections.setdefault(current_section, []).append(marker)
        all_markers.append(marker)

    non_optimal = [m for m in all_markers if m['severity'] != 'Optimal']
    status_counts = {}
    for m in all_markers:
        s = m['severity']
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        'sections': sections,
        'all_markers': all_markers,
        'non_optimal': non_optimal,
        'status_counts': status_counts,
        'total_markers': len(all_markers),
        'non_optimal_count': len(non_optimal)
    }


def format_sheet2_for_prompt(parsed: dict) -> str:
    """Format parsed biomarkers as text for Agent 1 prompt injection."""
    lines = ["| Biomarker | Value | Foxo Optimal Range | Foxo Severity |",
             "|-----------|-------|--------------------|---------------|"]
    current = None
    for m in parsed['all_markers']:
        if m['section'] != current:
            current = m['section']
            lines.append(f"\n=== {current} ===")
        lines.append(f"| {m['biomarker']} | {m['value']} | {m['optimal_range']} | {m['severity']} |")
    return '\n'.join(lines)
```

```python
# src/parsers/clinical_history.py

from docx import Document

def parse_clinical_history_docx(filepath: str) -> str:
    """Extract text from clinical history DOCX."""
    doc = Document(filepath)
    return '\n'.join(p.text.strip() for p in doc.paragraphs if p.text.strip())
```

```python
# src/parsers/agent_output.py

import re
import json

def parse_agent1_response(raw: str) -> dict:
    """Parse Agent 1 LLM response into structured data."""
    # Split Output A (Sheet 3) and Output B (Cluster Handoff)
    handoff_marker = '--- COPY THIS TO AGENT 2 ---'
    if handoff_marker in raw:
        sheet3_text, handoff_rest = raw.split(handoff_marker, 1)
        end_marker = '--- END HANDOFF ---'
        handoff = handoff_marker + handoff_rest.split(end_marker)[0] + end_marker
    else:
        sheet3_text = raw
        handoff = ''

    # Parse sections
    sections = []
    section_splits = re.split(r'===\s*(.+?)\s*===', sheet3_text)
    for i in range(1, len(section_splits), 2):
        name = section_splits[i].strip()
        content = section_splits[i + 1] if i + 1 < len(section_splits) else ''
        markers = _parse_table(content)
        sections.append({'name': name, 'markers': markers})

    return {'sections': sections, 'cluster_handoff': handoff.strip()}


def parse_agent2_response(raw: str) -> dict:
    """Parse Agent 2 LLM response into 9 systems."""
    handoff_marker = '--- COPY THIS TO AGENT 3 ---'
    if handoff_marker in raw:
        systems_text, handoff_rest = raw.split(handoff_marker, 1)
        end_marker = '--- END HANDOFF ---'
        handoff = handoff_marker + handoff_rest.split(end_marker)[0] + end_marker
    else:
        systems_text = raw
        handoff = ''

    systems = []
    # Parse each system block
    system_pattern = r'(\d+)\.\s*(.+?)\s*\|\s*.*?State:\s*(\w+)\s*\|\s*Protocol:\s*(\w+(?:/\w+)?)'
    blocks = re.split(r'---\n', systems_text)

    for block in blocks:
        match = re.search(system_pattern, block)
        if not match:
            continue
        num, name, state, protocol = match.groups()

        system = {
            'number': int(num),
            'name': name.strip(),
            'state': state.strip(),
            'protocol': protocol.strip(),
            'key_insights': _extract_section(block, 'Key Insights:'),
            'root_cause': _extract_section(block, 'Root Cause Analysis:'),
            'clinical_implications': _extract_section(block, 'Clinical Implications:'),
            'clarity_card': _extract_section(block, 'Clarity Card:'),
        }
        systems.append(system)

    return {'systems': systems, 'system_handoff': handoff.strip()}


def parse_agent3_response(raw: str) -> dict:
    """Parse Agent 3 (combined roadmap + humanized) response."""
    # Agent 3 produces Part A (phases) and Part B (biweekly cards)
    return {
        'phases': _parse_phases(raw),
        'biweekly': _parse_biweekly_cards(raw),
        'raw_text': raw
    }


def _parse_table(text: str) -> list[dict]:
    """Parse markdown table rows."""
    markers = []
    for line in text.strip().split('\n'):
        if '|' not in line or '---' in line:
            continue
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) >= 5:
            markers.append({
                'biomarker': cells[0], 'value_with_units': cells[1],
                'optimal_range': cells[2], 'status': cells[3], 'implication': cells[4]
            })
    return markers


def _extract_section(text: str, header: str) -> str:
    """Extract text after a section header until next header or end."""
    if header not in text:
        return ''
    start = text.index(header) + len(header)
    # Find next section header
    next_headers = ['Key Insights:', 'Root Cause Analysis:', 'Clinical Implications:', 'Clarity Card:']
    end = len(text)
    for h in next_headers:
        if h != header and h in text[start:]:
            pos = text.index(h, start)
            if pos < end:
                end = pos
    return text[start:end].strip()


def _parse_phases(raw: str) -> list:
    """Parse 3 phases from Agent 3 output."""
    # Implementation depends on exact output format
    phases = []
    for phase_name in ['Groundwork', 'Integration', 'Transformation']:
        if phase_name in raw:
            # Extract phase content
            phases.append({'name': phase_name, 'content': '...'})
    return phases


def _parse_biweekly_cards(raw: str) -> dict:
    """Parse 30 biweekly cards from Agent 3 output."""
    # Implementation depends on exact output format
    return {'periods': 6, 'components': 5, 'cards': []}
```

---

# 7. PIPELINE ORCHESTRATOR (Complete Code)

```python
# src/pipeline/orchestrator.py

import anthropic
import time
from pathlib import Path
from datetime import datetime

from parsers.biomarkers import parse_biomarker_xlsx, format_sheet2_for_prompt
from parsers.clinical_history import parse_clinical_history_docx
from parsers.ocr_pipeline import process_file
from parsers.agent_output import parse_agent1_response, parse_agent2_response, parse_agent3_response
from pipeline.log_store import LogStore

client = anthropic.Anthropic()

class ModePipeline:
    def __init__(self, run_id: str = None):
        self.run_id = run_id or f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.state = 'IDLE'
        self.data = {}           # Raw parsed data
        self.outputs = {}        # Agent outputs (parsed JSON)
        self.raw_outputs = {}    # Agent outputs (raw text)
        self.handoffs = {}       # Compressed handoff blocks
        self.feedback = {}       # User feedback per agent
        self.member = {}         # Member details
        self.log = LogStore(self.run_id)
        self.config = self._load_config()

        self.log.add('INFO', 'pipeline', 'pipeline.init',
                      f'Pipeline created. Run: {self.run_id}')

    def _load_config(self) -> dict:
        """Load agent configuration."""
        return {
            'agents': {
                1: {'model': 'claude-opus-4-6', 'max_tokens': 30000, 'temperature': 0,
                    'prompt_file': 'prompts/agent1_biomarker_analysis.txt'},
                2: {'model': 'claude-sonnet-4-20250514', 'max_tokens': 25000, 'temperature': 0,
                    'prompt_file': 'prompts/agent2_system_mapping.txt'},
                3: {'model': 'claude-sonnet-4-20250514', 'max_tokens': 30000, 'temperature': 0,
                    'prompt_file': 'prompts/agent3_humanized_roadmap.txt'},
            },
            'foundation_prompt': Path('prompts/foundation.txt').read_text()
        }

    def _transition(self, new_state: str):
        old = self.state
        self.state = new_state
        self.log.add('INFO', 'pipeline', 'pipeline.state_change',
                      f'{old} → {new_state}')

    # ═══ UPLOAD & PARSE ═══

    def upload_data(self, files: dict, member_details: dict) -> dict:
        """Parse all uploaded files. files = {type: filepath}"""
        self.member = member_details

        # Mandatory: Biomarkers
        if 'biomarkers' in files:
            result = process_file(files['biomarkers'])
            self.data['biomarkers'] = result['data']
            self.data['sheet2_text'] = format_sheet2_for_prompt(result['data'])
            self.log.add('INFO', 'parse', 'upload.file_received',
                          f"Biomarkers: {result['data']['total_markers']} markers",
                          data={'status_counts': result['data']['status_counts']})

        # Mandatory: Clinical History
        if 'clinical_history' in files:
            result = process_file(files['clinical_history'])
            text = result['data'] if isinstance(result['data'], str) else '\n'.join(p['text'] for p in result['data'])
            self.data['clinical_history'] = text
            self.log.add('INFO', 'parse', 'upload.file_received',
                          f"Clinical history: {len(text.split())} words")

        # Mandatory: Symptoms
        if 'symptoms' in files:
            result = process_file(files['symptoms'], file_type='symptoms_form')
            text = '\n'.join(p['text'] for p in result['data']) if isinstance(result['data'], list) else str(result['data'])
            self.data['symptoms'] = text
            self.log.add('INFO', 'parse', 'upload.file_received',
                          f"Symptoms: {result['method']}")

        # Optional: Advanced inputs
        for key in ('radiology', 'physio', 'ct_scan'):
            if key in files:
                result = process_file(files[key], file_type=key)
                text = '\n'.join(p['text'] for p in result['data']) if isinstance(result['data'], list) else str(result['data'])
                self.data[key] = text
                self.log.add('INFO', 'parse', 'upload.file_received',
                              f"Advanced input ({key}): {result['method']}")

        self._transition('DATA_UPLOADED')
        return self.data.get('biomarkers', {}).get('status_counts', {})

    # ═══ BUILD PROMPT ═══

    def _build_prompt(self, agent_num: int, feedback: str = None) -> str:
        """Assemble the full prompt for an agent."""
        foundation = self.config['foundation_prompt']
        template = Path(self.config['agents'][agent_num]['prompt_file']).read_text()

        prompt = template.replace('{FOUNDATION_PROMPT}', foundation)
        prompt = prompt.replace('{BIOMARKER_DATA}', self.data.get('sheet2_text', ''))
        prompt = prompt.replace('{CLINICAL_HISTORY}', self.data.get('clinical_history', ''))
        prompt = prompt.replace('{SYMPTOMS_DATA}', self.data.get('symptoms', ''))
        prompt = prompt.replace('{AGENT_1_CLUSTER_HANDOFF}', self.handoffs.get('agent1', ''))
        prompt = prompt.replace('{AGENT_2_SYSTEM_HANDOFF}', self.handoffs.get('agent2', ''))

        # Advanced inputs
        advanced = ''
        for key, label in [('radiology', 'RADIOLOGY IMAGING REPORTS'),
                           ('physio', 'PHYSIOTHERAPY ASSESSMENT'),
                           ('ct_scan', 'CT SCAN REPORT')]:
            if key in self.data:
                advanced += f"\n═══ {label} ═══\n{self.data[key]}\n"
        prompt = prompt.replace('{ADVANCED_INPUTS}', advanced)

        if feedback:
            prompt += f"\n\n--- USER FEEDBACK (address these) ---\n{feedback}\n--- END FEEDBACK ---"

        self.log.add('DEBUG', 'agent', 'agent.prompt_built',
                      f'Agent {agent_num} prompt: {len(prompt)} chars',
                      data={'full_prompt': prompt, 'agent': agent_num})
        return prompt

    # ═══ RUN AGENT ═══

    def run_agent(self, agent_num: int, feedback: str = None):
        """Run an agent. Returns generator for streaming."""
        self._transition(f'AGENT_{agent_num}_RUNNING')
        prompt = self._build_prompt(agent_num, feedback)
        config = self.config['agents'][agent_num]

        self.log.add('INFO', 'agent', 'agent.start',
                      f'Agent {agent_num} starting. Model: {config["model"]}',
                      data={'agent': agent_num, 'model': config['model'],
                            'estimated_input_tokens': len(prompt) // 4})

        start = time.time()
        collected = ''

        # Streaming call
        with client.messages.stream(
            model=config['model'],
            max_tokens=config['max_tokens'],
            temperature=config['temperature'],
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            for text in stream.text_stream:
                collected += text
                yield {'type': 'chunk', 'text': text}

        duration = time.time() - start
        self.raw_outputs[f'agent{agent_num}'] = collected

        self.log.add('INFO', 'agent', 'agent.api_complete',
                      f'Agent {agent_num} done. {len(collected)} chars, {duration:.0f}s',
                      data={'agent': agent_num, 'duration_ms': int(duration * 1000),
                            'output_chars': len(collected),
                            'full_response': collected})

        # Parse
        parsers = {1: parse_agent1_response, 2: parse_agent2_response, 3: parse_agent3_response}
        parsed = parsers[agent_num](collected)
        self.outputs[f'agent{agent_num}'] = parsed

        # Extract handoff
        if agent_num == 1:
            self.handoffs['agent1'] = parsed.get('cluster_handoff', '')
        elif agent_num == 2:
            self.handoffs['agent2'] = parsed.get('system_handoff', '')

        self._transition(f'AGENT_{agent_num}_REVIEW')
        yield {'type': 'complete', 'parsed': parsed}

    # ═══ APPROVE / REJECT ═══

    def approve_agent(self, agent_num: int, edits: dict = None):
        """Approve agent output, optionally with edits."""
        if edits:
            self._apply_edits(agent_num, edits)
            self.log.add('INFO', 'user', 'user.approve',
                          f'Agent {agent_num} approved with {len(edits)} edits',
                          data={'agent': agent_num, 'edit_count': len(edits)})
            # Re-extract handoff from EDITED output
            if agent_num == 1:
                self.handoffs['agent1'] = self.outputs['agent1'].get('cluster_handoff', '')
                self.log.add('DEBUG', 'user', 'user.handoff_extracted',
                              'Handoff re-extracted from edited Agent 1 output')
            elif agent_num == 2:
                self.handoffs['agent2'] = self.outputs['agent2'].get('system_handoff', '')
        else:
            self.log.add('INFO', 'user', 'user.approve',
                          f'Agent {agent_num} approved (no edits)')

        if agent_num < 3:
            return self.run_agent(agent_num + 1)
        else:
            self._transition('COMPLETE')
            return None

    def reject_agent(self, agent_num: int, feedback: str):
        """Re-run agent with feedback."""
        self.feedback[f'agent{agent_num}'] = feedback
        self.log.add('INFO', 'user', 'user.reject',
                      f'Agent {agent_num} rejected',
                      data={'feedback': feedback})
        return self.run_agent(agent_num, feedback=feedback)

    def _apply_edits(self, agent_num: int, edits: dict):
        """Apply user edits to stored output."""
        output = self.outputs[f'agent{agent_num}']
        for path, value in edits.items():
            keys = path.split('.')
            obj = output
            for key in keys[:-1]:
                obj = obj[int(key)] if key.isdigit() else obj[key]
            final = keys[-1]
            if final.isdigit():
                obj[int(final)] = value
            else:
                obj[final] = value

    # ═══ EXPORT ═══

    def export_xlsx(self, output_path: str) -> str:
        """Build final XLSX with all sheets."""
        from builders.xlsx_builder import build_workbook
        return build_workbook(self, output_path)

    # ═══ STATE GETTERS ═══

    def get_status(self) -> dict:
        return {
            'run_id': self.run_id,
            'state': self.state,
            'member': self.member,
            'agents': {
                1: self._agent_status(1),
                2: self._agent_status(2),
                3: self._agent_status(3),
            },
            'cost_total': sum(self._agent_status(i).get('cost', 0) for i in (1,2,3))
        }

    def _agent_status(self, n: int) -> dict:
        key = f'agent{n}'
        if key in self.outputs:
            return {'status': 'complete', 'has_output': True}
        elif self.state == f'AGENT_{n}_RUNNING':
            return {'status': 'running'}
        elif self.state == f'AGENT_{n}_REVIEW':
            return {'status': 'review'}
        else:
            return {'status': 'waiting'}
```

---

# 8. API ENDPOINTS

```python
# src/routes/api.py

from flask import Flask, request, jsonify, Response, send_file
import json

app = Flask(__name__)
pipelines = {}  # run_id -> ModePipeline instance

# ── Upload & Create ──
@app.route('/api/playbook', methods=['POST'])
def create_playbook():
    """Create new playbook with member details and files."""
    member = json.loads(request.form.get('member', '{}'))
    files = {}
    for key in ('biomarkers', 'clinical_history', 'symptoms', 'radiology', 'physio', 'ct_scan'):
        if key in request.files:
            f = request.files[key]
            path = f'/tmp/uploads/{f.filename}'
            f.save(path)
            files[key] = path

    pipeline = ModePipeline()
    pipeline.upload_data(files, member)
    pipelines[pipeline.run_id] = pipeline
    return jsonify({'run_id': pipeline.run_id, 'status': pipeline.get_status()})

# ── List Playbooks ──
@app.route('/api/playbooks', methods=['GET'])
def list_playbooks():
    return jsonify([p.get_status() for p in pipelines.values()])

# ── Pipeline Status ──
@app.route('/api/pipeline/<run_id>/status', methods=['GET'])
def pipeline_status(run_id):
    p = pipelines.get(run_id)
    if not p: return jsonify({'error': 'not found'}), 404
    return jsonify(p.get_status())

# ── Run Agent (SSE Streaming) ──
@app.route('/api/pipeline/<run_id>/agent/<int:agent_num>/run', methods=['POST'])
def run_agent(run_id, agent_num):
    p = pipelines.get(run_id)
    feedback = request.json.get('feedback') if request.json else None

    def stream():
        for event in p.run_agent(agent_num, feedback):
            yield f"data: {json.dumps(event)}\n\n"

    return Response(stream(), mimetype='text/event-stream')

# ── Approve Agent ──
@app.route('/api/pipeline/<run_id>/agent/<int:agent_num>/approve', methods=['POST'])
def approve_agent(run_id, agent_num):
    p = pipelines.get(run_id)
    edits = request.json.get('edits') if request.json else None
    p.approve_agent(agent_num, edits)
    return jsonify({'status': p.get_status()})

# ── Reject Agent ──
@app.route('/api/pipeline/<run_id>/agent/<int:agent_num>/reject', methods=['POST'])
def reject_agent(run_id, agent_num):
    p = pipelines.get(run_id)
    feedback = request.json.get('feedback', '')
    p.reject_agent(agent_num, feedback)
    return jsonify({'status': p.get_status()})

# ── Get Agent Output ──
@app.route('/api/pipeline/<run_id>/agent/<int:agent_num>/output', methods=['GET'])
def get_output(run_id, agent_num):
    p = pipelines.get(run_id)
    return jsonify(p.outputs.get(f'agent{agent_num}', {}))

# ── Get Agent Prompt ──
@app.route('/api/pipeline/<run_id>/agent/<int:agent_num>/prompt', methods=['GET'])
def get_prompt(run_id, agent_num):
    p = pipelines.get(run_id)
    prompt = p._build_prompt(agent_num)
    return jsonify({'prompt': prompt, 'chars': len(prompt)})

# ── Update Agent Prompt ──
@app.route('/api/pipeline/<run_id>/agent/<int:agent_num>/prompt', methods=['PUT'])
def update_prompt(run_id, agent_num):
    """Save per-run prompt override."""
    p = pipelines.get(run_id)
    new_prompt = request.json.get('prompt', '')
    # Store override (per-run, not global)
    p.config['agents'][agent_num]['prompt_override'] = new_prompt
    p.log.add('INFO', 'user', 'user.prompt_edited',
              f'Agent {agent_num} prompt overridden ({len(new_prompt)} chars)')
    return jsonify({'saved': True})

# ── Get Logs ──
@app.route('/api/pipeline/<run_id>/logs', methods=['GET'])
def get_logs(run_id):
    p = pipelines.get(run_id)
    level = request.args.get('level', 'INFO')
    agent = request.args.get('agent')
    logs = p.log.get_filtered(level=level, agent=int(agent) if agent else None)
    return jsonify(logs)

# ── Export ──
@app.route('/api/pipeline/<run_id>/export', methods=['GET'])
def export(run_id):
    p = pipelines.get(run_id)
    path = f'/tmp/exports/{run_id}.xlsx'
    p.export_xlsx(path)
    return send_file(path, as_attachment=True,
                     download_name=f'{p.member.get("name","playbook")}_MODE_Playbook.xlsx')

# ── Settings ──
@app.route('/api/settings/agents', methods=['GET', 'PUT'])
def settings_agents():
    # GET: return current config, PUT: update
    pass

@app.route('/api/settings/prompts', methods=['GET', 'PUT'])
def settings_prompts():
    pass

@app.route('/api/settings/models', methods=['GET', 'PUT'])
def settings_models():
    pass
```

---

# 9. PROMPT TEMPLATES

All prompt files are in the `/prompts` directory:

| File | Tokens | Injected Into | Purpose |
|------|--------|--------------|---------|
| `foundation.txt` | ~4,000 | Agents 1, 2, 3 | Belief system, MODE engine, anti-hallucination, persona |
| `agent1_biomarker_analysis.txt` | ~2,500 | Agent 1 | 25-section analysis + cluster handoff instructions |
| `agent2_system_mapping.txt` | ~2,000 | Agent 2 | 9-system mapping with character ranges |
| `agent3_humanized_roadmap.txt` | ~3,000 | Agent 3 | Combined roadmap + humanized card format |

Placeholder variables in prompt templates:
- `{FOUNDATION_PROMPT}` — replaced with foundation.txt content
- `{BIOMARKER_DATA}` — formatted Sheet 2 data
- `{CLINICAL_HISTORY}` — parsed clinical history text
- `{SYMPTOMS_DATA}` — parsed symptoms text
- `{ADVANCED_INPUTS}` — optional radiology/physio/CT content
- `{AGENT_1_CLUSTER_HANDOFF}` — cluster handoff from approved Agent 1
- `{AGENT_2_SYSTEM_HANDOFF}` — system handoff from approved Agent 2

---

# 10. XLSX BUILDER

```python
# src/builders/xlsx_builder.py

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

STYLES = {
    'title':        Font(name='Arial', bold=True, size=14, color='1F3864'),
    'header':       Font(name='Arial', bold=True, size=11, color='FFFFFF'),
    'header_fill':  PatternFill('solid', fgColor='2F5496'),
    'section':      Font(name='Arial', bold=True, size=12, color='1F3864'),
    'section_fill': PatternFill('solid', fgColor='D6E4F0'),
    'normal':       Font(name='Arial', size=10),
    'wrap':         Alignment(wrap_text=True, vertical='top'),
    'border':       Border(
                        left=Side(style='thin', color='B4C6E7'),
                        right=Side(style='thin', color='B4C6E7'),
                        top=Side(style='thin', color='B4C6E7'),
                        bottom=Side(style='thin', color='B4C6E7')),
    'strained':     PatternFill('solid', fgColor='C00000'),
    'compensating': PatternFill('solid', fgColor='BF8F00'),
    'stable':       PatternFill('solid', fgColor='548235'),
    'component':    Font(name='Arial', bold=True, size=10, color='943634'),
    'comp_fill':    PatternFill('solid', fgColor='FDE9D9'),
    'supp_font':    Font(name='Arial', bold=True, size=10, color='FFFFFF'),
    'supp_fill':    PatternFill('solid', fgColor='C00000'),
}

def build_workbook(pipeline, output_path: str) -> str:
    """Build the complete FOXO Playbook XLSX from pipeline data."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    _build_sheet1_input(wb, pipeline)
    _build_sheet2_raw(wb, pipeline)
    if 'agent1' in pipeline.outputs:
        _build_sheet3_analysis(wb, pipeline.outputs['agent1'])
    if 'agent2' in pipeline.outputs:
        _build_sheet4_systems(wb, pipeline.outputs['agent2'])
    if 'agent3' in pipeline.outputs:
        _build_sheet5_roadmap(wb, pipeline.outputs['agent3'])

    wb.save(output_path)
    return output_path

def _build_sheet1_input(wb, pipeline):
    """Sheet 1: Parsed input summary."""
    ws = wb.create_sheet("Sheet 1 - Input Summary")
    ws['A1'] = f"MODE Playbook — {pipeline.member.get('name', 'Member')}"
    ws['A1'].font = STYLES['title']
    # ... member details, marker counts, file parsing results

def _build_sheet2_raw(wb, pipeline):
    """Sheet 2: Raw biomarker data."""
    ws = wb.create_sheet("Sheet 2 - Raw Biomarkers")
    if 'biomarkers' not in pipeline.data:
        return
    data = pipeline.data['biomarkers']
    # Headers
    headers = ['Biomarker', 'Value', 'Foxo Optimal Range', 'Foxo Severity']
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = STYLES['header']
        cell.fill = STYLES['header_fill']
    # Data rows
    for i, m in enumerate(data['all_markers'], 2):
        ws.cell(row=i, column=1, value=m['biomarker'])
        ws.cell(row=i, column=2, value=m['value'])
        ws.cell(row=i, column=3, value=m['optimal_range'])
        ws.cell(row=i, column=4, value=m['severity'])

def _build_sheet3_analysis(wb, agent1_output):
    """Sheet 3: 25-section analysis with implications."""
    ws = wb.create_sheet("Sheet 3 - Analysis")
    ws.column_dimensions['A'].width = 42
    ws.column_dimensions['B'].width = 18
    ws.column_dimensions['C'].width = 18
    ws.column_dimensions['D'].width = 16
    ws.column_dimensions['E'].width = 95
    row = 1
    for section in agent1_output.get('sections', []):
        # Section header
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
        ws.cell(row=row, column=1, value=section['name']).font = STYLES['section']
        ws.cell(row=row, column=1).fill = STYLES['section_fill']
        row += 1
        # Table header
        for col, h in enumerate(['Biomarker', 'Value', 'Range', 'Status', 'Implication'], 1):
            cell = ws.cell(row=row, column=col, value=h)
            cell.font = STYLES['header']; cell.fill = STYLES['header_fill']
        row += 1
        # Marker rows
        for m in section.get('markers', []):
            for col, val in enumerate([m['biomarker'], m['value_with_units'],
                                        m['optimal_range'], m['status'], m['implication']], 1):
                cell = ws.cell(row=row, column=col, value=val)
                cell.font = STYLES['normal']; cell.alignment = STYLES['wrap']
            ws.row_dimensions[row].height = 80
            row += 1

def _build_sheet4_systems(wb, agent2_output):
    """Sheet 4: 9-system mapping."""
    ws = wb.create_sheet("Sheet 4 - System Mapping")
    ws.column_dimensions['A'].width = 6
    ws.column_dimensions['B'].width = 28
    ws.column_dimensions['C'].width = 18
    ws.column_dimensions['D'].width = 80
    ws.column_dimensions['E'].width = 65
    ws.column_dimensions['F'].width = 50
    ws.column_dimensions['G'].width = 55
    # Headers + system rows
    row = 1
    for col, h in enumerate(['#', 'System', 'State', 'Key Insights', 'Root Cause', 'Clinical', 'Clarity Card'], 1):
        ws.cell(row=row, column=col, value=h).font = STYLES['header']
        ws.cell(row=row, column=col).fill = STYLES['header_fill']
    for sys in agent2_output.get('systems', []):
        row += 1
        state_fill = STYLES.get(sys['state'].lower(), STYLES['strained'])
        ws.cell(row=row, column=1, value=sys['number'])
        ws.cell(row=row, column=2, value=sys['name']).fill = state_fill
        ws.cell(row=row, column=3, value=f"{sys['state']}\n{sys['protocol']}")
        ws.cell(row=row, column=4, value=sys['key_insights'])
        ws.cell(row=row, column=5, value=sys['root_cause'])
        ws.cell(row=row, column=6, value=sys['clinical_implications'])
        ws.cell(row=row, column=7, value=sys['clarity_card'])
        for c in range(1, 8):
            ws.cell(row=row, column=c).alignment = STYLES['wrap']
        ws.row_dimensions[row].height = 450

def _build_sheet5_roadmap(wb, agent3_output):
    """Sheet 5: 3-phase roadmap + 6 biweekly cards."""
    ws = wb.create_sheet("Sheet 5 - Humanized Roadmap")
    # Build from agent3 structured output
    # Phase rows + biweekly card rows follow same pattern as Threads 3+4
    pass
```

---

# 11. QUALITY GATE VALIDATORS

```python
# src/validators/quality_gates.py

import re

def validate_agent1(output: dict, input_biomarkers: dict) -> list[dict]:
    checks = []
    sections = output.get('sections', [])
    all_output_markers = [m for s in sections for m in s.get('markers', [])]

    # 1. Non-optimal markers have personalized implications
    non_opt = input_biomarkers['non_optimal_count']
    personalized = sum(1 for m in all_output_markers
                       if m['status'] != 'Optimal' and len(m.get('implication', '')) > 50)
    checks.append({'name': 'Non-optimal implications', 'pass': personalized >= non_opt * 0.95,
                   'detail': f'{personalized}/{non_opt}'})

    # 2. No invented markers
    input_names = {m['biomarker'] for m in input_biomarkers['all_markers']}
    output_names = {m['biomarker'] for m in all_output_markers}
    invented = output_names - input_names
    checks.append({'name': 'No invented markers', 'pass': len(invented) == 0,
                   'detail': f'Invented: {invented}' if invented else 'Clean'})

    # 3. Cluster handoff present
    handoff = output.get('cluster_handoff', '')
    checks.append({'name': 'Cluster handoff present', 'pass': len(handoff) > 100,
                   'detail': f'{len(handoff)} chars'})

    # 4. All 8 clusters defined
    for i in range(1, 9):
        checks.append({'name': f'C{i} defined', 'pass': f'C{i}' in handoff,
                       'detail': 'Present' if f'C{i}' in handoff else 'MISSING'})

    return checks


def validate_agent2(output: dict) -> list[dict]:
    checks = []
    systems = output.get('systems', [])

    checks.append({'name': '9 systems', 'pass': len(systems) == 9,
                   'detail': f'{len(systems)} found'})

    ranges = {'key_insights': (1200, 1800), 'root_cause': (590, 1450),
              'clinical_implications': (270, 830), 'clarity_card': (730, 850)}

    for sys in systems:
        for field, (lo, hi) in ranges.items():
            length = len(sys.get(field, ''))
            checks.append({
                'name': f'{sys["name"]}: {field}',
                'pass': lo <= length <= hi,
                'detail': f'{length} chars (target: {lo}-{hi})'
            })

    # Jargon check on clarity cards
    jargon = ['pathology', 'etiology', 'sequelae', 'prognosis',
              'contraindicated', 'hematocrit', 'erythropoiesis']
    for sys in systems:
        card = sys.get('clarity_card', '').lower()
        found = [t for t in jargon if t in card]
        checks.append({'name': f'{sys["name"]}: jargon-free', 'pass': len(found) == 0,
                       'detail': f'Found: {found}' if found else 'Clean'})

    return checks


def validate_agent3(output: dict) -> list[dict]:
    checks = []

    # 1. Phase check
    phases = output.get('phases', [])
    checks.append({'name': '3 phases', 'pass': len(phases) == 3, 'detail': str(len(phases))})

    # 2. Card structure
    raw = str(output)
    for element in ['POTENTIAL FOXO SYSTEM IMPACT', 'WHY IT WORKS',
                    'HOW TO PUT IT INTO PRACTICE', 'WHAT TO EXPECT']:
        count = raw.count(element)
        checks.append({'name': f'Cards have "{element}"', 'pass': count >= 25,
                       'detail': f'{count} occurrences'})

    # 3. No technical tags
    tag_count = raw.count('(System:')
    checks.append({'name': 'No (System:...) tags', 'pass': tag_count == 0,
                   'detail': f'{tag_count} remaining'})

    # 4. Correct label
    bad = raw.count('BIOMARKER IMPACT')
    checks.append({'name': 'FOXO SYSTEM IMPACT label', 'pass': bad == 0,
                   'detail': f'{bad} incorrect labels'})

    return checks
```

---

# 12. LOGGING SYSTEM (Complete Code)

```python
# src/pipeline/log_store.py

import uuid
from datetime import datetime

class LogStore:
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.entries = []

    def add(self, level: str, category: str, event: str, message: str,
            data: dict = None, agent: int = None) -> dict:
        entry = {
            'id': str(uuid.uuid4())[:8],
            'timestamp': datetime.now().isoformat(),
            'level': level,
            'category': category,
            'event': event,
            'message': message,
            'data': data or {},
            'agent': agent or data.get('agent') if data else None,
            'run_id': self.run_id
        }
        self.entries.append(entry)
        return entry

    def get_filtered(self, level: str = 'INFO', agent: int = None,
                     category: str = None, search: str = None) -> list:
        levels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
        min_idx = levels.index(level) if level in levels else 0

        filtered = [e for e in self.entries
                    if levels.index(e['level']) >= min_idx]

        if agent is not None:
            filtered = [e for e in filtered if e.get('agent') == agent]
        if category:
            filtered = [e for e in filtered if e['category'] == category]
        if search:
            filtered = [e for e in filtered if search.lower() in e['message'].lower()]

        return filtered

    def get_prompt_for(self, agent_num: int) -> str:
        for e in self.entries:
            if e['event'] == 'agent.prompt_built' and e.get('data', {}).get('agent') == agent_num:
                return e['data'].get('full_prompt', '')
        return ''

    def get_response_for(self, agent_num: int) -> str:
        for e in self.entries:
            if e['event'] == 'agent.api_complete' and e.get('data', {}).get('agent') == agent_num:
                return e['data'].get('full_response', '')
        return ''

    def get_errors(self) -> list:
        return [e for e in self.entries if e['level'] in ('ERROR', 'FATAL')]

    def export_json(self) -> list:
        return self.entries
```

---

# 13. FRONTEND COMPONENT ARCHITECTURE

```
frontend/src/
├── App.tsx                    # Router + layout shell
├── pages/
│   ├── Dashboard.tsx          # Playbook list + new playbook
│   ├── NewPlaybook.tsx        # Member details + file upload
│   ├── Pipeline.tsx           # Per-run: tabs for agents/sheets/logs
│   ├── SettingsAgents.tsx     # Agent configuration
│   ├── SettingsPrompts.tsx    # Prompt editor
│   └── SettingsModels.tsx     # Model + API config
├── components/
│   ├── Layout/
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── Header.tsx         # MODE logo + user
│   │   └── Breadcrumb.tsx
│   ├── Dashboard/
│   │   ├── PlaybookCard.tsx   # Card showing run status
│   │   └── PipelinePills.tsx  # Upload/A1/A2/A3 status pills
│   ├── Pipeline/
│   │   ├── AgentCard.tsx      # Expandable agent card
│   │   ├── PromptViewer.tsx   # Expandable prompt display
│   │   ├── PromptEditor.tsx   # Editable prompt textarea
│   │   ├── StreamingOutput.tsx # Live streaming text display
│   │   ├── ProcessSteps.tsx   # Step checklist (✓/⟳/○)
│   │   ├── ProgressBar.tsx    # Token progress bar
│   │   └── HandoffViewer.tsx  # Handoff block display
│   ├── Sheets/
│   │   ├── SheetTabs.tsx      # 5 sheet tab switcher
│   │   ├── DataTable.tsx      # Sortable, editable table
│   │   ├── SystemCard.tsx     # Sheet 4 system display
│   │   ├── RoadmapCard.tsx    # Sheet 5 biweekly card display
│   │   └── EditableCell.tsx   # Click-to-edit cell
│   ├── Logs/
│   │   ├── LogTimeline.tsx    # Filterable log list
│   │   ├── LogEntry.tsx       # Single log entry with expand
│   │   ├── LogFilters.tsx     # Agent/level/search filters
│   │   └── UploadLogTable.tsx # File parsing results table
│   ├── Upload/
│   │   ├── FileDropZone.tsx   # Drag-and-drop zone
│   │   ├── FileChip.tsx       # Uploaded file indicator
│   │   └── MemberForm.tsx     # Member details form fields
│   └── shared/
│       ├── StatusBadge.tsx    # Done/Running/Waiting/Error badge
│       ├── ToggleSwitch.tsx   # ON/OFF toggle
│       └── ActionButtons.tsx  # Approve/Reject/Re-run buttons
├── hooks/
│   ├── usePipeline.ts         # Pipeline state + API calls
│   ├── useStreaming.ts        # SSE connection for agent streaming
│   ├── usePlaybooks.ts        # Playbook list CRUD
│   └── useLogs.ts             # Log fetching + filtering
├── api/
│   └── client.ts              # Axios/fetch wrapper for all endpoints
├── store/
│   └── pipelineStore.ts       # Zustand store for pipeline state
└── types/
    └── index.ts               # TypeScript interfaces
```

---

# 14. TOKEN OPTIMIZATION

| Agent | Model | Input | Output | Cost | Time |
|-------|-------|-------|--------|------|------|
| Agent 1 | opus-4-6 | ~15K | ~30K | ~$2.50 | 2-4 min |
| Agent 2 | sonnet-4 | ~10K | ~25K | ~$0.25 | 2-3 min |
| Agent 3 | sonnet-4 | ~12K | ~30K | ~$0.30 | 2-3 min |
| OCR | sonnet-4 | ~2K/pg | ~1K/pg | ~$0.03/pg | ~0.2s/pg |
| **Total** | | **~37K** | **~85K** | **~$3.05** | **6-10 min** |

Optimization techniques:
1. Foundation prompt compression: remove redundancy (~1,500 tokens saved)
2. Send only non-optimal markers to Agent 1 context (~3,000 tokens saved)
3. Handoff compression: marker=value only (~800 tokens per handoff)
4. Conditional advanced inputs: only include if provided (~500 tokens)

---

# 15. DEPLOYMENT — CLAUDE CODE

```bash
# One command for Claude Code:

Read the MODE PRD v3 at ./MODE_PRD_v3_FINAL.md and all prompt files in ./prompts/.
Build:

BACKEND (Python + Flask):
1. Pipeline orchestrator (src/pipeline/orchestrator.py)
2. File parsers + OCR pipeline (src/parsers/)
3. REST + SSE streaming API (src/routes/api.py)
4. Logging system (src/pipeline/log_store.py)
5. Quality validators (src/validators/)
6. XLSX builder (src/builders/)

FRONTEND (React + TypeScript + Tailwind):
1. Dashboard page: playbook list + new playbook form
2. Pipeline page: 4 tabs (Agents, Sheets, Process Logs, Upload Logs)
3. Settings pages: Agents, Prompts, Models
4. Use the component architecture from PRD section 13
5. Wire to backend via REST + SSE

Match the wireframe from the downloaded HTML exactly.
```

---

# 16. PROJECT FILE STRUCTURE

```
mode/
├── .env
├── requirements.txt
├── package.json
├── README.md
├── MODE_PRD_v3_FINAL.md
├── prompts/
│   ├── foundation.txt
│   ├── agent1_biomarker_analysis.txt
│   ├── agent2_system_mapping.txt
│   └── agent3_humanized_roadmap.txt
├── src/
│   ├── app.py                    # Flask app entry point
│   ├── pipeline/
│   │   ├── orchestrator.py       # Main pipeline class
│   │   └── log_store.py          # Logging system
│   ├── parsers/
│   │   ├── biomarkers.py         # XLSX parser
│   │   ├── clinical_history.py   # DOCX parser
│   │   ├── ocr_pipeline.py       # OCR with Claude Vision
│   │   └── agent_output.py       # LLM response parsers
│   ├── builders/
│   │   └── xlsx_builder.py       # Output XLSX construction
│   ├── validators/
│   │   └── quality_gates.py      # Post-agent validation
│   └── routes/
│       └── api.py                # REST + SSE endpoints
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/                # (as specified in §13)
│   │   ├── components/           # (as specified in §13)
│   │   ├── hooks/
│   │   ├── api/
│   │   └── store/
│   └── public/
├── data/
│   └── sample/                   # Sample input files for testing
├── uploads/                      # Uploaded files (gitignored)
└── exports/                      # Generated XLSX files (gitignored)
```

---

# 17. ENVIRONMENT CONFIGURATION

```env
# .env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OPUS_MODEL=claude-opus-4-6
SONNET_MODEL=claude-sonnet-4-20250514
AGENT1_MAX_TOKENS=30000
AGENT2_MAX_TOKENS=25000
AGENT3_MAX_TOKENS=30000
OCR_DPI=300
FLASK_PORT=5000
FRONTEND_PORT=3000
UPLOAD_DIR=./uploads
EXPORT_DIR=./exports
```

```txt
# requirements.txt
flask>=3.0
flask-cors>=4.0
anthropic>=0.40
pandas>=2.0
openpyxl>=3.1
python-docx>=1.0
pdfplumber>=0.10
PyMuPDF>=1.24
gunicorn>=22.0
```

---

*MODE — Multiomics Decision Engine | PRD v3.0 Final | April 2026*
