-- ═══════════════════════════════════════════════════════
-- MODE — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL)
-- ═══════════════════════════════════════════════════════

-- 1. PLAYBOOKS (core pipeline runs)
CREATE TABLE playbooks (
  id TEXT PRIMARY KEY,                    -- run_id e.g. "run-a3f82177"
  member JSONB NOT NULL DEFAULT '{}',     -- {name, age, sex, location, occupation, height, weight}
  state TEXT NOT NULL DEFAULT 'IDLE',     -- IDLE, DATA_UPLOADED, AGENT_1_RUNNING, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  markers_total INTEGER,
  markers_non_optimal INTEGER,
  cost_total_usd REAL DEFAULT 0,
  cost_total_inr REAL DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  last_error_agent INTEGER,              -- which agent failed (for resume)
  approved_agents INTEGER[] DEFAULT '{}' -- array of approved agent numbers
);

-- 2. AGENT RUNS (one row per agent execution attempt)
CREATE TABLE agent_runs (
  id SERIAL PRIMARY KEY,
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  agent_num INTEGER NOT NULL CHECK (agent_num BETWEEN 1 AND 10),
  attempt INTEGER NOT NULL DEFAULT 1,    -- re-run attempt number
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, running, review, complete, error
  model TEXT,
  prompt_chars INTEGER,
  prompt_tokens INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  cost_inr REAL,
  duration_ms INTEGER,
  feedback TEXT,                          -- user feedback for re-runs
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_runs_playbook ON agent_runs(playbook_id, agent_num);

-- 3. AGENT OUTPUTS (raw + parsed output per agent)
CREATE TABLE agent_outputs (
  id SERIAL PRIMARY KEY,
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  agent_num INTEGER NOT NULL,
  raw_output TEXT,                        -- full LLM response text
  parsed_output JSONB,                    -- structured parsed JSON
  handoff_text TEXT,                      -- compressed handoff block for next agent
  handoff_chars INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(playbook_id, agent_num)
);

-- 4. UPLOAD FILES (tracking each uploaded file)
CREATE TABLE upload_files (
  id SERIAL PRIMARY KEY,
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,                 -- biomarkers, clinical_history, symptoms, radiology, etc.
  filename TEXT NOT NULL,
  file_type TEXT,                         -- Biomarker, Clinical Hx, Symptoms, etc.
  file_size INTEGER,                      -- bytes
  parse_method TEXT,                      -- pandas parse, python-docx, Claude Vision OCR, etc.
  result_summary TEXT,                    -- "262 markers", "2,340 words", "55 pages, $0.14"
  parse_time_ms INTEGER,
  ocr_cost_usd REAL,
  ocr_pages INTEGER,
  ocr_tokens INTEGER,
  parsed_data JSONB,                      -- parsed content (biomarker sections, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_upload_files_playbook ON upload_files(playbook_id);

-- 5. PIPELINE LOGS (every event during pipeline execution)
CREATE TABLE pipeline_logs (
  id TEXT PRIMARY KEY,                    -- uuid
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'INFO',     -- TRACE, DEBUG, INFO, WARN, ERROR, FATAL
  category TEXT NOT NULL DEFAULT 'general', -- pipeline, agent, parser, validate, user, export
  event TEXT NOT NULL,                    -- event code e.g. "agent.start", "parse.biomarkers.complete"
  message TEXT NOT NULL,
  agent INTEGER,                          -- which agent (1-3), null for pipeline-level events
  data JSONB,                             -- extra data (full_prompt, full_response, cost, validation, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_logs_playbook ON pipeline_logs(playbook_id, created_at);
CREATE INDEX idx_logs_level ON pipeline_logs(playbook_id, level);
CREATE INDEX idx_logs_category ON pipeline_logs(playbook_id, category);

-- 6. PIPELINE DATA (parsed input data for prompt building)
CREATE TABLE pipeline_data (
  id SERIAL PRIMARY KEY,
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  data_key TEXT NOT NULL,                 -- biomarkers, sheet2_text, clinical_history, symptoms, etc.
  content TEXT,                           -- text content
  content_json JSONB,                     -- structured content (biomarker sections, status_counts)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(playbook_id, data_key)
);
CREATE INDEX idx_pipeline_data_playbook ON pipeline_data(playbook_id);

-- 7. SETTINGS (global app settings)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,                   -- 'agents', 'models', etc.
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══ HELPER FUNCTION: auto-update updated_at ═══
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER playbooks_updated_at
  BEFORE UPDATE ON playbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══ ROW LEVEL SECURITY (enable but allow all for now) ═══
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (tighten later with auth)
CREATE POLICY "Allow all" ON playbooks FOR ALL USING (true);
CREATE POLICY "Allow all" ON agent_runs FOR ALL USING (true);
CREATE POLICY "Allow all" ON agent_outputs FOR ALL USING (true);
CREATE POLICY "Allow all" ON upload_files FOR ALL USING (true);
CREATE POLICY "Allow all" ON pipeline_logs FOR ALL USING (true);
CREATE POLICY "Allow all" ON pipeline_data FOR ALL USING (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true);
