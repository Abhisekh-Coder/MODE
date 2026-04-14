import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const VALID_ID = 'Abhisekh_2026';
const VALID_PW = '12345@abhi';

export default function Login() {
  const nav = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError('');
    setLoading(true);
    setTimeout(() => {
      if (userId === VALID_ID && password === VALID_PW) {
        sessionStorage.setItem('mode_auth', 'true');
        sessionStorage.setItem('mode_user', userId);
        nav('/');
      } else {
        setError('Invalid credentials. Please try again.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #fef3e2 0%, #fce4ec 30%, #e8d5f5 60%, #f3e5f5 100%)' }}>
      {/* Decorative blobs */}
      <div className="absolute top-[-100px] right-[-50px] w-[400px] h-[400px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-80px] left-[-60px] w-[350px] h-[350px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }} />

      <div className="w-[420px] rounded-3xl p-8 relative" style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 25px 50px rgba(0,0,0,0.08)' }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-[28px] font-bold tracking-[4px] mb-1" style={{ background: 'linear-gradient(135deg, #7c3aed, #2C5F2D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MODE</div>
          <div className="text-[10px] text-gray-400 tracking-[2px] uppercase">Multiomics Decision Engine</div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1.5">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your User ID"
              className="w-full px-4 py-3 rounded-xl text-[13px] text-gray-800 transition"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(10px)' }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-500 block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl text-[13px] text-gray-800 pr-10 transition"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(10px)' }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="text-[11px] text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</div>}

          <button
            onClick={handleLogin}
            disabled={loading || !userId || !password}
            className="w-full py-3 rounded-xl text-[13px] font-medium text-white flex items-center justify-center gap-2 transition hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 8px 25px rgba(124,58,237,0.25)' }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <div className="text-center mt-6">
          <button onClick={() => nav('/landing')} className="text-[11px] text-gray-400 hover:text-gray-600 transition">← Back to home</button>
        </div>
      </div>
    </div>
  );
}
