import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Users, Activity,
  Settings, LogOut, X, MoreHorizontal, Moon, Sun
} from 'lucide-react';
import Sidebar from './Sidebar';
import Onboarding from './Onboarding';
import { MobileNotificationBell } from './NotificationsPanel';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const BOTTOM_NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Inicio'     },
  { to: '/events',   icon: Calendar,        label: 'Eventos'    },
  { to: '/members',  icon: Users,           label: 'Miembros'   },
  { to: '/activity', icon: Activity,        label: 'Actividad'  },
];

const MainLayout = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const seen = localStorage.getItem('splitpay_onboarding_seen');
    if (!seen) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-brushed-metal dark:bg-gray-950 transition-colors duration-500">
      <style>{`
        @keyframes sp-page-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        .sp-page-transition { animation: sp-page-in 0.25s ease-out forwards; }

        @keyframes sp-sheet-in {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .sp-sheet { animation: sp-sheet-in 0.22s cubic-bezier(0.32, 0.72, 0, 1) both; }
      `}</style>

      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 glass px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-gray-900">
        <Logo />
        <div className="flex items-center gap-1">
          <MobileNotificationBell />
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            {menuOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Settings Sheet */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          style={{ animation: 'sp-page-in 0.15s ease-out both' }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="sp-sheet absolute bottom-16 left-3 right-3 bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { navigate('/settings'); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors border-b border-slate-100 dark:border-gray-800"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                <Settings size={14} className="text-slate-500 dark:text-gray-400" />
              </div>
              <span className="font-black text-xs uppercase tracking-wide">{t('nav.settings')}</span>
            </button>
            <button
              onClick={() => { toggleTheme(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors border-b border-slate-100 dark:border-gray-800"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-500" />}
              </div>
              <span className="font-black text-xs uppercase tracking-wide">
                {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              </span>
            </button>
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                <LogOut size={14} className="text-rose-500" />
              </div>
              <span className="font-black text-xs uppercase tracking-wide">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="lg:ml-72 relative z-10 px-4 pt-3 pb-24 lg:pb-10 lg:p-10">
        <div key={location.pathname} className="max-w-7xl mx-auto sp-page-transition">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-950/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-gray-800 flex items-stretch h-16 px-2">
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl mx-0.5 transition-all duration-200 ${
                isActive
                  ? 'text-emerald-500'
                  : 'text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 ${isActive ? 'bg-emerald-500/10' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-wide leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default MainLayout;
