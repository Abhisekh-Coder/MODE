import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';

interface PromptEntry {
  key: string;
  name: string;
  file: string;
  description: string;
  content: string;
  originalContent: string;
  chars: number;
  dirty: boolean;
}

export default function SettingsPrompts() {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const data: any = await api.getSettings('prompts');
      // Backend returns {key: {file, content, chars}} format
      const entries: PromptEntry[] = Object.entries(data).map(([key, val]: [string, any]) => {
        const names: Record<string, string> = {
          foundation: 'Foundation Prompt',
          agent1: 'Agent 1: Biomarker Analysis',
          agent2: 'Agent 2: System Mapping',
          agent3: 'Agent 3: Humanized Roadmap',
        };
        const descs: Record<string, string> = {
          foundation: 'FOXO system, MODE engine, anti-hallucination rules. Injected into all 3 agents.',
          agent1: 'Builds Sheet 3 — 25 clinical sections with implications + MODE cluster analysis.',
          agent2: 'Builds Sheet 4 — 9 FOXO systems with key insights, root cause, clarity cards.',
          agent3: 'Builds Sheet 5 — 3-phase roadmap + 30 biweekly protocol cards.',
        };
        return {
          key,
          name: names[key] || key,
          file: val.file || '',
          description: descs[key] || '',
          content: val.content || '',
          originalContent: val.content || '',
          chars: val.chars || 0,
          dirty: false,
        };
      });
      setPrompts(entries);
      if (entries.length > 0) setActivePrompt(entries[0].key);
    } catch (err) {
      console.error('Failed to load prompts:', err);
    }
    setLoading(false);
  };

  const updateContent = (key: string, content: string) => {
    setPrompts(prev => prev.map(p =>
      p.key === key ? { ...p, content, chars: content.length, dirty: content !== p.originalContent } : p
    ));
  };

  const resetPrompt = (key: string) => {
    setPrompts(prev => prev.map(p =>
      p.key === key ? { ...p, content: p.originalContent, chars: p.originalContent.length, dirty: false } : p
    ));
  };

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updates: Record<string, string> = {};
      for (const p of prompts) {
        if (p.dirty) {
          updates[p.key] = p.content;
        }
      }
      if (Object.keys(updates).length > 0) {
        await api.updateSettings('prompts', updates);
        setPrompts(prev => prev.map(p => ({ ...p, originalContent: p.content, dirty: false })));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save prompts. Check console for details.');
    }
    setSaving(false);
  };

  const hasDirty = prompts.some(p => p.dirty);
  const active = prompts.find(p => p.key === activePrompt);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] text-white/30 mb-4">
        <span className="text-purple-400 cursor-pointer hover:underline" onClick={() => navigate('/')}>Dashboard</span>
        <span className="mx-1.5">/</span> Settings <span className="mx-1.5">/</span> Prompts
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Prompt Editor</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Edit base prompt templates. Per-run overrides are in the pipeline view.</p>
        </div>
        {saveSuccess && <span className="text-[11px] text-emerald-600 font-medium">Saved successfully!</span>}
        <button
          className={clsx(
            'px-4 py-2 text-[12px] rounded-lg flex items-center gap-1.5 transition',
            saveSuccess ? 'bg-emerald-600 text-white' :
            hasDirty ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-white/5 text-white/30 cursor-not-allowed'
          )}
          disabled={!hasDirty || saving}
          onClick={handleSave}
        >
          <Save size={13} />
          {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save All'}
        </button>
      </div>

      <div className="flex gap-4">
        {/* Prompt list sidebar */}
        <div className="w-[220px] flex-shrink-0 space-y-1">
          {prompts.map((p) => (
            <button
              key={p.key}
              className={clsx(
                'w-full text-left px-3 py-2.5 rounded-lg transition text-[12px]',
                activePrompt === p.key
                  ? 'bg-purple-500/10 text-blue-700 border border-purple-500/30'
                  : 'text-white/60 hover:bg-white/[0.02] border border-transparent'
              )}
              onClick={() => setActivePrompt(p.key)}
            >
              <div className="font-medium flex items-center gap-1.5">
                {p.name}
                {p.dirty && <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />}
              </div>
              <div className="text-[10px] text-white/30 mt-0.5">{p.file}</div>
              <div className="text-[10px] text-white/20 mt-0.5">{p.chars.toLocaleString()} chars, ~{Math.round(p.chars/4).toLocaleString()} tokens</div>
            </button>
          ))}
        </div>

        {/* Editor */}
        {active && (
          <div className="flex-1 min-w-0">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                <div>
                  <span className="text-[12px] font-semibold text-white/80">{active.name}</span>
                  <span className="text-[10px] text-white/30 ml-2">{active.file}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30">
                    {active.chars.toLocaleString()} chars / ~{Math.round(active.chars/4).toLocaleString()} tokens
                  </span>
                  {active.dirty && (
                    <button
                      className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1"
                      onClick={() => resetPrompt(active.key)}
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  )}
                </div>
              </div>
              <div className="px-3 py-2 text-[11px] text-white/50 bg-white/[0.02]/50 border-b border-white/[0.04]">
                {active.description}
              </div>
              <textarea
                className="w-full min-h-[500px] p-4 font-mono text-[11px] leading-relaxed border-0 focus:ring-0 resize-y"
                value={active.content}
                onChange={(e) => updateContent(active.key, e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
