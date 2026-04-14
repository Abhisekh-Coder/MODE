import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Cpu, FileText, BarChart3, Zap, Users } from 'lucide-react';

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #fef3e2 0%, #fce4ec 30%, #e8d5f5 60%, #f3e5f5 100%)' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold tracking-[3px]" style={{ background: 'linear-gradient(135deg, #7c3aed, #2C5F2D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MODE</div>
          <span className="text-[9px] text-gray-400 tracking-wider mt-1">by FOXO</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-[13px] text-gray-600 hover:text-gray-900 transition">Features</a>
          <a href="#how" className="text-[13px] text-gray-600 hover:text-gray-900 transition">How it works</a>
          <button onClick={() => nav('/login')} className="px-5 py-2 text-[12px] font-medium text-white rounded-xl transition hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 pt-16 pb-24 grid grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-medium mb-6" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', color: '#666' }}>
            Trusted by Functional Medicine Practitioners
          </div>
          <h1 className="text-[48px] font-bold leading-[1.1] tracking-tight text-gray-900 mb-6">
            Redefining<br />
            <span style={{ background: 'linear-gradient(135deg, #7c3aed, #2C5F2D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Biomarker Intelligence</span><br />
            for Longevity
          </h1>
          <p className="text-[15px] text-gray-500 leading-[1.7] mb-8 max-w-md">
            Upload biomarker data, clinical history, and symptoms. Three AI agents analyze, map systems, and generate a personalized health roadmap — all in one intelligent pipeline.
          </p>
          <div className="flex items-center gap-4 mb-10">
            <button onClick={() => nav('/login')} className="flex items-center gap-2 px-6 py-3 text-[13px] font-medium text-white rounded-xl transition hover:scale-[1.02] shadow-lg shadow-purple-500/20" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
              Get Started <ArrowRight size={15} />
            </button>
            <a href="#how" className="flex items-center gap-2 px-6 py-3 text-[13px] font-medium text-gray-600 rounded-xl border border-gray-200 hover:bg-white/50 transition">
              See how it works
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-[14px]">★</span>
            <span className="text-[13px] font-semibold text-gray-800">4.9/5</span>
            <span className="text-[11px] text-gray-400 ml-1">"Transformed how we build health roadmaps"</span>
          </div>
        </div>

        {/* Hero cards */}
        <div className="relative">
          {/* Biomarker card */}
          <div className="absolute top-0 right-0 w-[220px] rounded-2xl p-4 shadow-xl" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><BarChart3 size={16} className="text-purple-600" /></div>
              <span className="text-[10px] text-gray-400">Biomarker Status</span>
            </div>
            <div className="text-[28px] font-bold text-gray-800">248</div>
            <div className="text-[11px] text-gray-500">markers analyzed</div>
            <div className="flex gap-1 mt-2">
              {['#22c55e','#22c55e','#f59e0b','#f59e0b','#ef4444'].map((c,i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: c, opacity: 0.6 }} />)}
            </div>
          </div>

          {/* Systems card */}
          <div className="absolute top-[140px] right-[180px] w-[200px] rounded-2xl p-4 shadow-xl" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <div className="text-[10px] text-gray-400 mb-1">FOXO Systems</div>
            <div className="text-[22px] font-bold text-gray-800">9 Systems</div>
            <div className="text-[11px] text-gray-500">mapped & analyzed</div>
            <div className="flex gap-1.5 mt-2">
              {[1,2,3,4,5,6,7,8,9].map(n => <div key={n} className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-[7px] font-bold text-red-500">{n}</div>)}
            </div>
          </div>

          {/* Member card */}
          <div className="absolute top-[280px] right-[40px] w-[240px] rounded-2xl p-4 shadow-xl" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <div className="text-[10px] text-gray-400 mb-2">Member Profile</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-300 flex items-center justify-center text-white text-[14px] font-bold">AT</div>
              <div>
                <div className="text-[13px] font-semibold text-gray-800">Abhay Tandon</div>
                <div className="text-[10px] text-gray-400">29M · 248 markers · $2.83</div>
              </div>
            </div>
          </div>

          {/* Spacer for absolute positioning */}
          <div className="h-[420px]" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-[32px] font-bold text-gray-900 mb-3">Three Agents. One Pipeline.</h2>
          <p className="text-[14px] text-gray-500 max-w-lg mx-auto">Each agent builds on the previous one's analysis, creating a comprehensive health playbook from raw biomarker data.</p>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {[
            { icon: Cpu, title: 'Agent 1: Analysis', desc: '25-section biomarker analysis with personalized implications. MODE cluster classification across 8 biological systems.', color: '#7c3aed', cost: '~$2.50' },
            { icon: FileText, title: 'Agent 2: Systems', desc: '9 FOXO health systems mapped with key insights, root cause analysis, clinical implications, and clarity cards.', color: '#2C5F2D', cost: '~$0.25' },
            { icon: Zap, title: 'Agent 3: Roadmap', desc: '3-phase health roadmap with 30 biweekly protocol cards covering nutrition, exercise, stress, sleep, supplements.', color: '#d97706', cost: '~$0.30' },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl p-6 transition hover:scale-[1.02]" style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.6)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}15` }}>
                <f.icon size={20} style={{ color: f.color }} />
              </div>
              <h3 className="text-[15px] font-semibold text-gray-800 mb-2">{f.title}</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed mb-3">{f.desc}</p>
              <span className="text-[11px] font-medium" style={{ color: f.color }}>{f.cost} per run</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-8 py-20">
        <h2 className="text-[32px] font-bold text-gray-900 text-center mb-14">How It Works</h2>
        <div className="flex gap-4">
          {[
            { step: '01', title: 'Upload', desc: 'Biomarker XLSX, clinical history, symptoms PDF' },
            { step: '02', title: 'Analyze', desc: 'Agent 1 runs biomarker analysis with MODE clusters' },
            { step: '03', title: 'Map', desc: 'Agent 2 maps 9 health systems with clarity cards' },
            { step: '04', title: 'Plan', desc: 'Agent 3 builds personalized 12-month roadmap' },
            { step: '05', title: 'Export', desc: 'Download complete 5-sheet XLSX playbook' },
          ].map((s, i) => (
            <div key={i} className="flex-1 text-center rounded-2xl p-5 transition" style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(12px)' }}>
              <div className="text-[24px] font-bold mb-2" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.step}</div>
              <div className="text-[13px] font-semibold text-gray-800 mb-1">{s.title}</div>
              <div className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-8 py-10 border-t border-gray-200/50">
        <div className="flex justify-between items-center">
          <div className="text-[11px] text-gray-400">MODE by FOXO · Multiomics Decision Engine</div>
          <button onClick={() => nav('/login')} className="px-5 py-2 text-[12px] font-medium text-white rounded-xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
            Sign In →
          </button>
        </div>
      </footer>
    </div>
  );
}
