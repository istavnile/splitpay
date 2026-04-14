import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Button } from './UI';
import Onboarding from './Onboarding';
import { MobileNotificationBell } from './NotificationsPanel';
import Logo from './Logo';

const MainLayout = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const seen = localStorage.getItem('splitpay_onboarding_seen');
    if (!seen) {
      setShowOnboarding(true);
    }
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors duration-500">
      <style>{`
        @keyframes sp-page-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sp-page-transition {
          animation: sp-page-in 0.25s ease-out both;
        }
        @keyframes sp-drawer-in {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        .sp-drawer {
          animation: sp-drawer-in 0.28s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
      `}</style>

      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}

      {/* Background Orbs (Decorative) */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 glass px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-gray-900">
        <div className="flex items-center gap-2">
          <Logo />
        </div>
        <div className="flex items-center gap-1">
          <MobileNotificationBell />
          <Button variant="ghost" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          style={{ animation: 'sp-page-in 0.2s ease-out both' }}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div className="w-72 h-full sp-drawer" onClick={e => e.stopPropagation()}>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="lg:ml-72 relative z-10 px-4 pt-3 pb-6 lg:p-10">
        <div key={location.pathname} className="max-w-7xl mx-auto sp-page-transition">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
