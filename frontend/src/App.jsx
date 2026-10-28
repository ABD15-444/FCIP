import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { alertService, dashboardService } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';

// Investigator Operational Pages
import DashboardOverview from './pages/DashboardOverview';
import DataManagement from './pages/DataManagement';
import DetectionRules from './pages/DetectionRules';
import AlertsSystem from './pages/AlertsSystem';
import NetworkGraph from './pages/NetworkGraph';
import CaseManagement from './pages/CaseManagement';

// Administrator Dedicated Pages
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import RolesPermissions from './pages/RolesPermissions';
import DetectionConfig from './pages/DetectionConfig';
import DataAdmin from './pages/DataAdmin';
import SystemHealth from './pages/SystemHealth';
import AuditLogs from './pages/AuditLogs';

// Compliance Officer Dedicated Pages
import ComplianceDashboard from './pages/ComplianceDashboard';
import ReviewQueue from './pages/ReviewQueue';
import CaseReviews from './pages/CaseReviews';
import SARDossierReview from './pages/SARDossierReview';
import ComplianceRiskOversight from './pages/ComplianceRiskOversight';
import ComplianceReports from './pages/ComplianceReports';

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
  Users,
  ShieldCheck,
  Server,
  Layers,
  Activity,
  Menu,
  X,
  Inbox,
  FileCheck2,
  AlertTriangle
} from 'lucide-react';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCompliance = user?.role === 'compliance_officer';

  // Default page depends on authenticated role
  const getInitialPage = () => {
    if (user?.role === 'admin') return 'admin_dashboard';
    if (user?.role === 'compliance_officer') return 'compliance_dashboard';
    return 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [selectedCaseParam, setSelectedCaseParam] = useState(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [prefillAlertForCase, setPrefillAlertForCase] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [systemHealthy, setSystemHealthy] = useState(true);

  // Sync default starting page when user role loads
  useEffect(() => {
    if (isAdmin && !currentPage.startsWith('admin') && currentPage !== 'audit') {
      setCurrentPage('admin_dashboard');
    } else if (isCompliance && !currentPage.startsWith('compliance')) {
      setCurrentPage('compliance_dashboard');
    }
  }, [user?.role]);

  useEffect(() => {
    loadAlertCount();
    checkHealth();
    const interval = setInterval(() => {
      loadAlertCount();
      checkHealth();
    }, 15000);
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

  const checkHealth = async () => {
    try {
      const res = await dashboardService.getSystemHealth();
      setSystemHealthy(res.status === 'healthy');
    } catch {
      setSystemHealthy(false);
    }
  };

  // Dedicated Compliance Officer Navigation (Section 3 Requirements)
  const complianceNavItems = [
    { id: 'compliance_dashboard', label: 'Compliance Dashboard', icon: Activity, subtitle: 'Oversight Telemetry' },
    { id: 'compliance_queue', label: 'Review Queue', icon: Inbox, subtitle: 'Intake Worklist' },
    { id: 'compliance_cases', label: 'Case Reviews', icon: Briefcase, subtitle: 'Adjudication Suite' },
    { id: 'compliance_sars', label: 'SAR & Dossier Review', icon: FileCheck2, subtitle: 'Validation Hub' },
    { id: 'compliance_oversight', label: 'Compliance Risk Oversight', icon: ShieldAlert, subtitle: 'QA & Efficacy' },
    { id: 'compliance_reports', label: 'Compliance Reports', icon: PieChart, subtitle: 'Regulatory Analytics' },
  ];

  // Dedicated Administrator Navigation
  const adminNavItems = [
    { id: 'admin_dashboard', label: 'Admin Dashboard', icon: Activity, subtitle: 'Operations Telemetry' },
    { id: 'admin_users', label: 'User Management', icon: Users, subtitle: 'Account Directory' },
    { id: 'admin_roles', label: 'Roles & Permissions', icon: ShieldCheck, subtitle: 'RBAC Policy Matrix' },
    { id: 'admin_detection', label: 'Detection Configuration', icon: Sliders, subtitle: 'Rule Calibrations' },
    { id: 'admin_data', label: 'Data Administration', icon: Database, subtitle: 'Dataset Ingest Vault' },
    { id: 'admin_health', label: 'System Health', icon: Server, subtitle: 'Diagnostic Latency' },
    { id: 'audit', label: 'Audit Trail Logs', icon: ClipboardList, subtitle: 'Security Ledger' },
  ];

  // Dedicated Investigator Navigation
  const investigatorNavItems = [
    { id: 'dashboard', label: 'Dashboard & Reports', icon: PieChart, subtitle: 'Phases 1 & 7' },
    { id: 'data', label: 'Financial Data & CSV', icon: Database, subtitle: 'Phase 2' },
    { id: 'detection', label: 'Detection Rules & Risk', icon: Sliders, subtitle: 'Phase 3' },
    { id: 'alerts', label: 'Suspicious Alerts', icon: Bell, badge: unreadAlerts, subtitle: 'Phase 4' },
    { id: 'network', label: 'Network Graph Flow', icon: Network, subtitle: 'Phase 5' },
    { id: 'cases', label: 'Case Dossiers', icon: Briefcase, subtitle: 'Phase 6' },
  ];

  const currentNavItems = isAdmin
    ? adminNavItems
    : isCompliance
    ? complianceNavItems
    : investigatorNavItems;

  const handleOpenCaseFromAlert = (alert) => {
    setPrefillAlertForCase(alert);
    setCurrentPage('cases');
  };

  const handleNavigateCompliance = (pageId, params = {}) => {
    if (params?.caseId) {
      setSelectedCaseParam(params.caseId);
    }
    setCurrentPage(pageId);
  };

  return (
    <div className="min-h-screen flex bg-navy-950 text-slate-100 font-sans">
      {/* Sidebar Navigation */}
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
                  <span className="text-[9px] text-cyan-400 font-mono block">
                    {isAdmin
                      ? 'ADMINISTRATOR CONSOLE'
                      : isCompliance
                      ? 'COMPLIANCE OVERSIGHT'
                      : 'INVESTIGATOR WORKSPACE'}
                  </span>
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
            {currentNavItems.map((item) => {
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
                    {sidebarOpen && (
                      <div className="text-left">
                        <span className="block leading-tight">{item.label}</span>
                        {item.subtitle && <span className="text-[9px] text-slate-500 font-mono font-normal block">{item.subtitle}</span>}
                      </div>
                    )}
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
              {isAdmin ? 'System Operations' : 'Workspace'} &gt;{' '}
              <span className="text-white font-semibold capitalize">
                {currentPage.replace('admin_', '').replace('_', ' ')}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Bell Icon with unread badge */}
            <button
              onClick={() => setCurrentPage(isAdmin ? 'audit' : 'alerts')}
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
              title={isAdmin ? 'Audit Events' : 'Alerts'}
            >
              <Bell className="w-4 h-4" />
              {unreadAlerts > 0 && !isAdmin && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-mono flex items-center justify-center font-bold">
                  {unreadAlerts}
                </span>
              )}
            </button>

            {/* Actual Live Database Health Telemetry */}
            <div
              className={`hidden sm:flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border ${
                systemHealthy
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-red-400 bg-red-500/10 border-red-500/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${systemHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {systemHealthy ? 'DATABASE ONLINE' : 'DATABASE DISCONNECTED'}
            </div>
          </div>
        </header>

        {/* View Router with Strict RBAC Isolation */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
          {/* Administrator Views */}
          {isAdmin && currentPage === 'admin_dashboard' && <AdminDashboard onNavigate={setCurrentPage} />}
          {isAdmin && currentPage === 'admin_users' && <UserManagement />}
          {isAdmin && currentPage === 'admin_roles' && <RolesPermissions />}
          {isAdmin && currentPage === 'admin_detection' && <DetectionConfig />}
          {isAdmin && currentPage === 'admin_data' && <DataAdmin />}
          {isAdmin && currentPage === 'admin_health' && <SystemHealth />}
          {isAdmin && currentPage === 'audit' && <AuditLogs />}

          {/* Access Denied Guard for Non-Admin trying to access audit */}
          {!isAdmin && (currentPage === 'audit' || currentPage === 'compliance_audit') && (
            <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-center max-w-xl mx-auto my-12 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white font-mono">Access Denied: Administrator Privilege Required</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Security Policy Enforcement: The Security & Audit Trail Ledger contains sensitive platform infrastructure events and is strictly restricted to users with the Administrator role. Your current role is <strong className="text-cyan-400 font-mono">{user?.role}</strong>.
              </p>
              <button
                onClick={() => setCurrentPage(isCompliance ? 'compliance_dashboard' : 'dashboard')}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono hover:bg-slate-800 transition-all inline-flex items-center gap-2"
              >
                Return to Authorized Workspace
              </button>
            </div>
          )}

          {/* Compliance Officer Views */}
          {isCompliance && currentPage === 'compliance_dashboard' && (
            <ErrorBoundary moduleName="Compliance Dashboard" onFallback={() => setCurrentPage('compliance_dashboard')}>
              <ComplianceDashboard onNavigate={handleNavigateCompliance} />
            </ErrorBoundary>
          )}
          {isCompliance && currentPage === 'compliance_queue' && (
            <ErrorBoundary moduleName="Review Queue" onFallback={() => setCurrentPage('compliance_dashboard')}>
              <ReviewQueue
                onSelectCase={(item) => handleNavigateCompliance('compliance_cases', { caseId: item.id })}
              />
            </ErrorBoundary>
          )}
          {isCompliance && currentPage === 'compliance_cases' && (
            <ErrorBoundary moduleName="Case Reviews & Adjudication" onFallback={() => setCurrentPage('compliance_queue')}>
              <CaseReviews
                initialCaseId={selectedCaseParam}
                onBack={() => setCurrentPage('compliance_queue')}
              />
            </ErrorBoundary>
          )}
          {isCompliance && currentPage === 'compliance_sars' && (
            <ErrorBoundary moduleName="SAR & Dossier Validation Hub" onFallback={() => setCurrentPage('compliance_dashboard')}>
              <SARDossierReview />
            </ErrorBoundary>
          )}
          {isCompliance && currentPage === 'compliance_oversight' && (
            <ErrorBoundary moduleName="Compliance Risk Oversight & QA" onFallback={() => setCurrentPage('compliance_dashboard')}>
              <ComplianceRiskOversight onNavigate={handleNavigateCompliance} />
            </ErrorBoundary>
          )}
          {isCompliance && currentPage === 'compliance_reports' && (
            <ErrorBoundary moduleName="Compliance Governance Reports" onFallback={() => setCurrentPage('compliance_dashboard')}>
              <ComplianceReports />
            </ErrorBoundary>
          )}

          {/* Investigator Views */}
          {!isAdmin && !isCompliance && currentPage === 'dashboard' && <DashboardOverview onNavigate={setCurrentPage} />}
          {!isAdmin && !isCompliance && currentPage === 'data' && <DataManagement />}
          {!isAdmin && !isCompliance && currentPage === 'detection' && <DetectionRules />}
          {!isAdmin && !isCompliance && currentPage === 'alerts' && <AlertsSystem onOpenCaseFromAlert={handleOpenCaseFromAlert} />}
          {!isAdmin && !isCompliance && currentPage === 'network' && <NetworkGraph />}
          {!isAdmin && !isCompliance && currentPage === 'cases' && (
            <CaseManagement
              prefillAlert={prefillAlertForCase}
              onCaseCreated={() => setPrefillAlertForCase(null)}
            />
          )}
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
        Financial Crime Intelligence Platform • Full Enterprise Architecture with Dedicated Admin Console
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
