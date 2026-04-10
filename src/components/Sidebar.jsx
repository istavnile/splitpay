import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Activity,
  Settings,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Logo from './Logo';
import { NotificationBell } from './NotificationsPanel';
import pb from '../lib/pocketbase';

const SidebarItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
      ${isActive 
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' 
        : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/50 hover:text-emerald-600 dark:hover:text-emerald-400'}
    `}
  >
    <Icon size={20} className="group-hover:scale-110 transition-transform" />
    <span className="text-sm tracking-wide">{label}</span>
    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-0 group-[.active]:opacity-100 transition-opacity"></div>
  </NavLink>
);

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-72 h-screen fixed left-0 top-0 bg-white dark:bg-gray-950 border-r border-slate-100 dark:border-gray-900 flex flex-col p-6 z-40 transition-colors duration-500">
      <div className="mb-10 px-2 mt-2">
        <Logo />
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-600 mb-2 px-4">
          Navegación
        </div>
        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
        <SidebarItem to="/events" icon={Calendar} label="Eventos" />
        <SidebarItem to="/members" icon={Users} label="Miembros" />
        <SidebarItem to="/activity" icon={Activity} label="Actividad" />
        <NotificationBell />

        <div className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-gray-600 mb-2 px-4">
          Sistema
        </div>
        <SidebarItem to="/settings" icon={Settings} label="Ajustes" />
      </nav>

      <div className="mt-auto flex flex-col gap-4 pt-6 border-t border-slate-100 dark:border-gray-900">
        {/* Theme Toggle in Sidebar */}
        <button 
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/50 transition-colors"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span className="text-sm tracking-wide">{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-gray-900/50 rounded-2xl border border-slate-100 dark:border-gray-800">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-md">
            {user?.avatar ? (
              <img 
                src={`${pb.baseUrl}/api/files/users/${user.id}/${user.avatar}`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold dark:text-white truncate">{user?.name || 'Usuario'}</p>
            <p className="text-[10px] text-slate-500 dark:text-gray-500 truncate uppercase tracking-tighter">Premium User</p>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
