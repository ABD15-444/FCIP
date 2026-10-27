import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { alertService } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardOverview from './pages/DashboardOverview';
import DataManagement from './pages/DataManagement';
import DetectionRules from './pages/DetectionRules';
import AlertsSystem from './pages/AlertsSystem';
import NetworkGraph from './pages/NetworkGraph';
import CaseManagement from './pages/CaseManagement';
import AuditLogs from './pages/AuditLogs';

import {
  ShieldAlert,
  Database,
  Sliders,
  Bell,
  Network,
  Briefcase,
  PieChart,
  ClipboardList,
  LogOut,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard' | 'data' | 'detection' | 'alerts' | 'network' | 'cases' | 'audit'
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [prefillAlertForCase, setPrefillAlertForCase] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadAlertCount();
    const interval = setInterval(loadAlertCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadAlertCount = async () => {
    try {
      const res = await alertService.getAlerts({ status: 'open' });
      if (res.success) setUnreadAlerts(res.count);
    } catch {
      // silent
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard & Reports', icon: PieChart, phases: 'Phases 1 & 7' },
    { id: 'data', label: 'Financial Data & CSV', icon: Database, phases: 'Phase 2' },
    { id: 'detection', label: 'Detection Rules & Risk', icon: Sliders, phases: 'Phase 3' },
    { id: 'alerts', label: 'Suspicious Alerts', icon: Bell, badge: unreadAlerts, phases: 'Phase 4' },
    { id: 'network', label: 'Network Graph Flow', icon: Network, phases: 'Phase 5' },
    { id: 'cases', label: 'Case Dossiers', icon: Briefcase, phases: 'Phase 6' },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'audit', label: 'Audit Trail Logs', icon: ClipboardList, adminOnly: true, phases: 'Phase 8' });
  }

  const handleOpenCaseFromAlert = (alert) => {
    setPrefillAlertForCase(alert);
    setCurrentPage('cases');
  };

  return (
    <div className="min-h-screen flex bg-navy-950 text-slate-100 font-sans">
      {/* Sidebar Navigation (Phase 8 Final Polish) */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-950/90 border-r border-slate-800/80 flex flex-col justify-between transition-all duration-300 z-40 fixed inset-y-0 left-0 md:relative`}
      >
        <div>
          {/* Brand Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              {sidebarOpen && (
                <div>
                  <span className="font-extrabold text-sm tracking-tight text-white block">FCIP PLATFORM</span>
                  <span className="text-[9px] text-cyan-400 font-mono block">ALL 8 PHASES ACTIVE</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              {sidebarOpen ? <X className="w-4 h-4 md:hidden" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    if (item.id !== 'cases') setPrefillAlertForCase(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    {sidebarOpen && <span>{item.label}</span>}
                  </div>

                  {sidebarOpen && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-mono font-bold animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-slate-800/80">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
              {user?.first_name?.[0] || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs text-white truncate">{user?.first_name} {user?.last_name}</p>
                <p className="text-[10px] text-cyan-400 uppercase font-mono truncate">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={logout}
                className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 glass-panel border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 uppercase">
              Workspace &gt; <span className="text-white font-semibold capitalize">{currentPage}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Bell Icon with unread badge */}
            <button
              onClick={() => setCurrentPage('alerts')}
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-mono flex items-center justify-center font-bold">
                  {unreadAlerts}
                </span>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE TELEMETRY
            </div>
          </div>
        </header>

        {/* View Router */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
          {currentPage === 'dashboard' && <DashboardOverview onNavigate={setCurrentPage} />}
          {currentPage === 'data' && <DataManagement />}
          {currentPage === 'detection' && <DetectionRules />}
          {currentPage === 'alerts' && <AlertsSystem onOpenCaseFromAlert={handleOpenCaseFromAlert} />}
          {currentPage === 'network' && <NetworkGraph />}
          {currentPage === 'cases' && (
            <CaseManagement
              prefillAlert={prefillAlertForCase}
              onCaseCreated={() => setPrefillAlertForCase(null)}
            />
          )}
          {currentPage === 'audit' && user?.role === 'admin' && <AuditLogs />}
        </main>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const [authView, setAuthView] = useState('login');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">INITIALIZING SECURITY SYSTEM...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <MainLayout />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between py-8 px-4 bg-navy-950 text-slate-100">
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

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          ENTERPRISE AML SUITE
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
        Financial Crime Intelligence Platform • Full 8-Phase Enterprise Architecture
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
