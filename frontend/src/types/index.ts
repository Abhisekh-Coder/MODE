// types/index.ts — MODE App Type Definitions

// ═══ PIPELINE STATE ═══

export type PipelineState =
  | 'IDLE'
  | 'DATA_UPLOADED'
  | 'AGENT_1_RUNNING' | 'AGENT_1_REVIEW'
  | 'AGENT_2_RUNNING' | 'AGENT_2_REVIEW'
  | 'AGENT_3_RUNNING' | 'AGENT_3_REVIEW'
  | 'COMPLETE'
  | 'ERROR';

export type AgentStatus = 'waiting' | 'running' | 'review' | 'complete' | 'error';

// ═══ MEMBER ═══

export interface Member {
  name: string;
  age: string;
  sex: string;
  location?: string;
  occupation?: string;
  height?: string;
  weight?: string;
}

// ═══ PLAYBOOK ═══

export interface Playbook {
  run_id: string;
  member: Member;
  state: PipelineState;
  created_at: string;
  agents: {
    1: AgentInfo;
    2: AgentInfo;
    3: AgentInfo;
    4: AgentInfo;
  };
  cost_total: number;
  markers_total?: number;
  markers_non_optimal?: number;
}

export interface AgentInfo {
  status: AgentStatus;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  duration_ms?: number;
  cost?: number;
  has_output?: boolean;
}

// ═══ BIOMARKER DATA ═══

export interface Marker {
  biomarker: string;
  value: number | string;
  optimal_range: string;
  severity: string;
  section: string;
}

export interface ParsedBiomarkers {
  sections: Record<string, Marker[]>;
  all_markers: Marker[];
  non_optimal: Marker[];
  status_counts: Record<string, number>;
  total_markers: number;
  non_optimal_count: number;
}

// ═══ AGENT OUTPUTS ═══

export interface Agent1Output {
  sections: {
    name: string;
    markers: {
      biomarker: string;
      value_with_units: string;
      optimal_range: string;
      status: string;
      implication: string;
    }[];
  }[];
  cluster_handoff: string;
}

export interface SystemMapping {
  number: number;
  name: string;
  state: 'STABLE' | 'COMPENSATING' | 'STRAINED' | 'FAILED';
  protocol: string;
  key_insights: string;
  root_cause: string;
  clinical_implications: string;
  clarity_card: string;
}

export interface Agent2Output {
  systems: SystemMapping[];
  system_handoff: string;
}

export interface BiweeklyCard {
  title: string;
  intro: string;
  foxo_system_impact: string;
  why_it_works: string[];
  how_to_practice: string[];
  what_to_expect: string;
}

export interface Agent3Output {
  phases: {
    name: 'Groundwork' | 'Integration' | 'Transformation';
    months: string;
    focus_area: string;
    objective: string;
    nutrition: string;
    physical_activity: string;
    stress: string;
    sleep: string;
  }[];
  biweekly: {
    periods: string[];
    nutrition: BiweeklyCard[];
    physical_activity: BiweeklyCard[];
    stress: BiweeklyCard[];
    sleep: BiweeklyCard[];
    supplements: BiweeklyCard[];
  };
  supplement_safety: string;
  raw_text: string;
}

// ═══ LOGGING ═══

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: string;
  event: string;
  message: string;
  agent?: number;
  data?: {
    full_prompt?: string;
    full_response?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    duration_ms?: number;
    model?: string;
    error_stack?: string;
    validation_results?: ValidationCheck[];
    user_feedback?: string;
    edit_diff?: Record<string, { old: string; new: string }>;
    [key: string]: any;
  };
}

// ═══ VALIDATION ═══

export interface ValidationCheck {
  name: string;
  pass: boolean;
  detail: string;
}

// ═══ SETTINGS ═══

export interface AgentConfig {
  model: string;
  max_tokens: number;
  temperature: number;
  prompt_file: string;
  enabled: boolean;
}

export interface AppSettings {
  api_key: string;
  default_model: string;
  agents: Record<number, AgentConfig>;
}

// ═══ SSE EVENTS ═══

export interface StreamChunkEvent {
  type: 'chunk';
  text: string;
}

export interface StreamCompleteEvent {
  type: 'complete';
  parsed: Agent1Output | Agent2Output | Agent3Output;
}

export type StreamEvent = StreamChunkEvent | StreamCompleteEvent;

// ═══ API REQUEST/RESPONSE ═══

export interface ApproveRequest {
  edits?: Record<string, any>;
}

export interface RejectRequest {
  feedback: string;
}

export interface PromptUpdateRequest {
  prompt: string;
}

export interface CreatePlaybookRequest {
  member: Member;
  files: {
    biomarkers: File;
    clinical_history: File;
    symptoms: File;
    radiology?: File;
    physio?: File;
    ct_scan?: File;
  };
}
