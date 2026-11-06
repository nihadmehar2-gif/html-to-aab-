import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Download,
  FolderKanban,
  HelpCircle,
  Home,
  KeyRound,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import clsx from 'clsx';
import { Modal } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Home, mobile: true },
  { to: '/new', label: 'New Build', icon: Plus, mobile: true, primary: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, mobile: true },
  { to: '/downloads', label: 'Downloads', icon: Download, mobile: true },
  { to: '/signing', label: 'Signing', icon: KeyRound, mobile: false },
  { to: '/help', label: 'Help & FAQ', icon: HelpCircle, mobile: false },
];

export default function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/10 bg-navy-900/60 backdrop-blur-xl fixed inset-y-0 z-40">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent flex items-center justify-center text-white font-extrabold shadow-glow">
            &lt;/&gt;
          </div>
          <div>
            <div className="font-bold text-white leading-tight">Web2APK</div>
            <div className="text-[11px] text-slate-400 font-medium tracking-wide">STUDIO</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                  isActive ? 'bg-gradient-to-r from-brand-500/20 to-accent/10 text-white border border-brand-400/25' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                )
              }
            >
              <item.icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 pb-5 space-y-3">
          <div className="glass p-3 text-xs text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Builds run on GitHub Actions. Tokens &amp; keystores never touch the browser.</span>
          </div>
          <button className="btn-ghost w-full text-xs" onClick={() => navigate('/about')}>
            <Smartphone className="w-4 h-4" /> About · v1.0.0
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 z-40 flex items-center gap-3 px-4 border-b border-white/10 bg-navy-900/80 backdrop-blur-xl">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent flex items-center justify-center text-white text-xs font-extrabold">
          &lt;/&gt;
        </div>
        <span className="font-bold text-white">Web2APK Studio</span>
      </header>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 pb-24 md:pb-10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-navy-900/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => n.mobile).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', isActive ? 'text-brand-300' : 'text-slate-500')
              }
            >
              {item.primary ? (
                <span className="w-9 h-9 -mt-4 rounded-2xl bg-gradient-to-br from-brand-500 to-accent flex items-center justify-center text-white shadow-glow">
                  <item.icon className="w-5 h-5" />
                </span>
              ) : (
                <item.icon className="w-5 h-5" />
              )}
              {item.label}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-slate-500">
            <MoreHorizontal className="w-5 h-5" />
            More
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="space-y-1">
          {[
            { to: '/signing', label: 'Signing & Keystore', icon: KeyRound },
            { to: '/help', label: 'Help & FAQ', icon: HelpCircle },
            { to: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
            { to: '/terms', label: 'Terms of Service', icon: ShieldCheck },
            { to: '/about', label: 'About', icon: Smartphone },
          ].map((item) => (
            <button
              key={item.to}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              onClick={() => {
                setMoreOpen(false);
                navigate(item.to);
              }}
            >
              <item.icon className="w-4 h-4 text-brand-300" />
              {item.label}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
