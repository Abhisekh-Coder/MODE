import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, GitBranch, FileText, Server, LogOut } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: GitBranch, label: 'Pipeline', match: '/pipeline' },
];
const settingsItems = [
  { to: '/settings/prompts', icon: FileText, label: 'Prompts' },
  { to: '/settings/models', icon: Server, label: 'Models' },
];

function SideLink({ to, icon: Icon, label, match }: { to: string; icon: any; label: string; match?: string }) {
  const loc = useLocation();
  const active = match ? loc.pathname.startsWith(match) : loc.pathname === to;
  return (
    <NavLink to={to} className={clsx(
      'flex items-center gap-2.5 px-4 py-2 text-[12px] rounded-xl mx-2 mb-0.5 transition-all duration-200',
      active ? 'glass-active text-white font-medium' : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
    )}>
      <Icon size={15} strokeWidth={1.5} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: 'linear-gradient(135deg, #0c0a13 0%, #1a1525 50%, #0c0a13 100%)' }}>
      {/* Sidebar */}
      <nav className="w-[190px] flex flex-col flex-shrink-0 border-r border-white/[0.04]">
        <div className="px-5 pt-6 pb-5">
          <div className="text-[20px] font-bold tracking-[4px]" style={{ background: 'linear-gradient(135deg, #a882ff, #d4b8ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MODE</div>
          <div className="text-[8px] text-white/20 tracking-[1.5px] mt-1 uppercase">multiomics decision engine</div>
        </div>
        <div className="flex-1 py-1">
          {navItems.map(i => <SideLink key={i.to} {...i} />)}
          <div className="text-[8px] font-semibold text-white/15 px-4 pt-5 pb-1.5 tracking-[1.5px] uppercase">Settings</div>
          {settingsItems.map(i => <SideLink key={i.to} {...i} />)}
        </div>
        <div className="px-4 py-4 border-t border-white/[0.04]">
          <div className="text-[10px] text-white/20 mb-2">{sessionStorage.getItem('mode_user') || 'admin'}</div>
          <button onClick={() => { sessionStorage.clear(); window.location.href = '/landing'; }} className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/50 transition">
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </nav>
      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-5 page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
