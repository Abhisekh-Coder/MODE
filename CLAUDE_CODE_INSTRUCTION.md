# MODE — Claude Code Build Instructions

## Step 1: Read these files (in order)
1. MODE_PRD_v3_FINAL.md — Complete PRD with all code, architecture, and specs
2. prompts/ — All 4 prompt templates (foundation + 3 agents)

## Step 2: Build command
```
Read MODE_PRD_v3_FINAL.md. Build the complete MODE app:

BACKEND (Python/Flask):
- src/app.py (Flask entry point)
- src/pipeline/orchestrator.py (state machine + agent runner — PRD §7)
- src/pipeline/log_store.py (logging — PRD §12)
- src/parsers/biomarkers.py (XLSX parser — PRD §6)
- src/parsers/clinical_history.py (DOCX parser — PRD §6)
- src/parsers/ocr_pipeline.py (Claude Vision OCR — PRD §5)
- src/parsers/agent_output.py (LLM response parser — PRD §6)
- src/builders/xlsx_builder.py (output XLSX — PRD §10)
- src/validators/quality_gates.py (post-agent checks — PRD §11)
- src/routes/api.py (REST + SSE endpoints — PRD §8)

FRONTEND (React/TypeScript/Tailwind):
- Match the wireframe HTML that was downloaded (9 views)
- Use component architecture from PRD §13
- Use TypeScript types from frontend/src/types/index.ts
- Use Zustand store from frontend/src/store/pipelineStore.ts
- Use API client from frontend/src/api/client.ts
- Use SSE hook from frontend/src/hooks/useStreaming.ts

PAGES (PRD §2):
1. Dashboard — playbook list + new playbook button
2. New Playbook — member form + file upload
3. Pipeline — 4 tabs (Agents, Sheets, Process Logs, Upload Logs)
4. Settings: Agents — model/tokens/temp per agent
5. Settings: Prompts — editable prompt templates
6. Settings: Models — API key + cost tracking

KEY BEHAVIORS:
- Agent 1 uses Opus, Agents 2-3 use Sonnet
- User can view/edit prompts before and after agent runs
- Edits to agent output are applied BEFORE extracting handoff
- Every action logged with full context
- SSE streaming for real-time agent output
- 5 downloadable sheets with view/edit/download
```

## Step 3: Environment
Copy .env.example to .env and add your ANTHROPIC_API_KEY.
