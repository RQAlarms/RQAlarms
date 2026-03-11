/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DriverDashboard from './components/DriverDashboard';
import ProfileSettings from './components/ProfileSettings';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('rq_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('rq_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('rq_user');
    localStorage.removeItem('rq_vehicle');
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-slate-900">
              RQ
            </div>
            <h1 className="text-xl font-semibold tracking-tight">RQ Alarms</h1>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-300">
                Logged in as <strong className="text-white">{user.username}</strong> ({user.role})
              </span>
              <button
                onClick={() => setShowSettings(true)}
                className="text-sm bg-slate-800 hover:bg-slate-700 p-1.5 rounded transition-colors"
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={handleLogout}
                className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </header>

        <main className="p-4 md:p-8 max-w-7xl mx-auto">
          <ProfileSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
          <Routes>
            <Route
              path="/"
              element={
                !user ? (
                  <Login onLogin={handleLogin} />
                ) : ['admin', 'control', 'supervisor', 'technician'].includes(user.role) ? (
                  <Navigate to="/admin" replace />
                ) : (
                  <Navigate to="/driver" replace />
                )
              }
            />
            <Route
              path="/admin"
              element={
                user && ['admin', 'control', 'supervisor', 'technician'].includes(user.role) ? (
                  <AdminDashboard user={user} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/driver"
              element={
                user?.role === 'driver' ? (
                  <DriverDashboard user={user} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

