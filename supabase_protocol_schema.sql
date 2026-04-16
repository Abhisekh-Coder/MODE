-- ═══════════════════════════════════════════════════════
-- MODE — Protocol Goals Schema (Agent 3 structured output)
-- Run AFTER supabase_schema.sql
-- ═══════════════════════════════════════════════════════

-- 1. PROTOCOL PHASES (12-month roadmap phases)
CREATE TABLE protocol_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  title TEXT NOT NULL,                    -- "Baseline Restoration"
  description TEXT,
  start_date TIMESTAMPTZ,
  target_date TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',            -- draft, active, completed
  themes TEXT,
  goals TEXT,
  nutrition TEXT,                          -- prose summary
  movement TEXT,                           -- prose summary
  sleep TEXT,
  stress TEXT,
  supplements TEXT,
  weeks INTEGER[] DEFAULT '{}',           -- [1,2,3,4...]
  generated_by TEXT DEFAULT 'playbook_ai',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_protocol_phases_playbook ON protocol_phases(playbook_id);

-- 2. PROTOCOL GUIDELINES (general guides like "12hr eating window")
CREATE TABLE protocol_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  title TEXT NOT NULL,                    -- "Start 12-Hour Overnight Fast Daily"
  category TEXT NOT NULL,                 -- "general_guides_12_hr_eating_window"
  sequence INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  generated_by TEXT DEFAULT 'playbook_ai',
  weeks INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_guidelines_playbook ON protocol_guidelines(playbook_id);

-- 3. SUPPLEMENT GOALS
CREATE TABLE supplement_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  goal_id UUID,
  title TEXT NOT NULL,                    -- "Take Multi-strain Probiotic VSL3"
  category TEXT,                          -- "supplements_capsules"
  dosage TEXT,
  dosage_unit TEXT,
  time_of_day TEXT,                       -- "morning", "evening", "afternoon"
  frequency INTEGER DEFAULT 1,
  frequency_unit TEXT,                    -- "capsule", "tablet", "scoop"
  intake_timing TEXT,                     -- "pre_meal", "post_meal", "with_meal", "empty_stomach"
  notes TEXT,                             -- "30 min before dinner, empty stomach"
  sequence INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  generated_by TEXT DEFAULT 'playbook_ai',
  weeks INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_supplement_goals_playbook ON supplement_goals(playbook_id);

-- 4. NUTRITION GOALS
CREATE TABLE nutrition_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  goal_id UUID,
  title TEXT NOT NULL,                    -- "Amla Chutney Three Times Weekly"
  nutrition_group TEXT,                   -- "addition", "elimination", "food_base", "hydration", "meal_framework", "digestive_support"
  category TEXT,                          -- "nutrition_liver_function"
  range_start TEXT,
  range_end TEXT,
  range_unit TEXT,
  samples JSONB,                          -- [{"title":"Amla Chutney"}] or [{section,items}]
  notes TEXT,
  sequence INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  generated_by TEXT DEFAULT 'playbook_ai',
  weeks INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_nutrition_goals_playbook ON nutrition_goals(playbook_id);

-- 5. SLEEP GOALS
CREATE TABLE sleep_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  goal_id UUID,
  title TEXT NOT NULL,                    -- "No Caffeine After 1 PM"
  category TEXT,                          -- "screen_curfew", "temperature", "other"
  note TEXT,
  sequence INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  generated_by TEXT DEFAULT 'playbook_ai',
  weeks INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_sleep_goals_playbook ON sleep_goals(playbook_id);

-- 6. STRESS GOALS
CREATE TABLE stress_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  goal_id UUID,
  title TEXT NOT NULL,                    -- "Breathwork and Meditation Combined"
  category TEXT,                          -- "stress_box_breathing", "stress_meditation"
  time_of_day TEXT,                       -- "morning", "evening"
  range_start TEXT,
  range_end TEXT,
  range_unit TEXT,                        -- "mins"
  frequency INTEGER DEFAULT 1,
  recurrence TEXT DEFAULT 'daily',        -- "daily", "weekly"
  notes TEXT,
  sequence INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  generated_by TEXT DEFAULT 'playbook_ai',
  weeks INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_stress_goals_playbook ON stress_goals(playbook_id);

-- 7. ACTIVITY GOALS
CREATE TABLE activity_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  goal_id UUID,
  title TEXT NOT NULL,                    -- "Daily Steps"
  category TEXT,                          -- "activities_walking", "activities_yoga", "activities_strength"
  activity_group TEXT,                    -- "neat", "cardio", "strength", "mobility"
  range_start TEXT,
  range_end TEXT,
  range_unit TEXT,                        -- "steps", "mins"
  frequency INTEGER DEFAULT 1,
  recurrence TEXT DEFAULT 'daily',
  notes TEXT,
  sequence INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft',
  generated_by TEXT DEFAULT 'playbook_ai',
  weeks INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_activity_goals_playbook ON activity_goals(playbook_id);

-- 8. SYSTEM INSIGHTS (Agent 2 output structured)
CREATE TABLE system_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  member_id UUID,
  functional_system_id UUID,
  insights TEXT,                           -- Key Insights text
  key_abnormalities TEXT,
  root_cause_analysis TEXT,
  clinical_implications TEXT,
  clarity_card TEXT,
  actionable_recommendations TEXT,
  functional_system_score REAL,
  functional_system_score_description TEXT,
  functional_system_score_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_for TEXT
);
CREATE INDEX idx_system_insights_playbook ON system_insights(playbook_id);

-- RLS policies
ALTER TABLE protocol_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON protocol_phases FOR ALL USING (true);
CREATE POLICY "Allow all" ON protocol_guidelines FOR ALL USING (true);
CREATE POLICY "Allow all" ON supplement_goals FOR ALL USING (true);
CREATE POLICY "Allow all" ON nutrition_goals FOR ALL USING (true);
CREATE POLICY "Allow all" ON sleep_goals FOR ALL USING (true);
CREATE POLICY "Allow all" ON stress_goals FOR ALL USING (true);
CREATE POLICY "Allow all" ON activity_goals FOR ALL USING (true);
CREATE POLICY "Allow all" ON system_insights FOR ALL USING (true);
