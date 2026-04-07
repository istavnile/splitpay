import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';

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
        <Route path="/login" element={isValid ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={isValid ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/event/:id" element={isValid ? <EventDetail /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
