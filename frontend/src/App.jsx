import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import { ShieldCheck, Activity } from 'lucide-react';

const AppContent = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">VERIFYING INTELLIGENCE CREDENTIALS...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Dashboard />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4 relative overflow-hidden">
      {/* Background radial effects */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between mb-8 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white block">FCIP</span>
            <span className="text-[10px] text-slate-400 font-mono block">FINANCIAL CRIME PLATFORM</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          SYSTEM ONLINE • 256-BIT ENCRYPTION
        </div>
      </div>

      <div className="my-auto py-6">
        {authView === 'login' ? (
          <Login onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>

      <footer className="text-center text-xs text-slate-500 font-mono py-4">
        Financial Crime Intelligence Platform • Phase 1 Core Setup
      </footer>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
