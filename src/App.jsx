import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import Settings from './pages/Settings';
import Members from './pages/Members';
import Activity from './pages/Activity';
import Events from './pages/Events';
import ResetPassword from './pages/ResetPassword';
import MainLayout from './components/MainLayout';

export default function App() {
  const { isValid, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center">
        <span className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></span>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={isValid ? <Navigate to="/" /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes (Wrapped in MainLayout) */}
        <Route element={isValid ? <NotificationsProvider><MainLayout><Outlet /></MainLayout></NotificationsProvider> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/members" element={<Members />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/events" element={<Events />} />
        </Route>

        {/* Redirects */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
