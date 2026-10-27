import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  ShieldAlert,
  Search,
  Activity,
  FileText,
  Users,
  Database,
  Lock,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Server,
  Layers
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [protectedData, setProtectedData] = useState(null);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [endpointResult, setEndpointResult] = useState('');

  // Determine role theme and badges
  const getRoleDetails = () => {
    switch (user?.role) {
      case 'admin':
        return {
          title: 'Administrator Control Command',
          badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
          testZone: '/auth/admin-zone',
          features: [
            'Full System Administration & User Management',
            'Rule Engine Configuration & Threshold Definition',
            'Audit Trail Inspection & Immutable Logs',
            'Direct Database Management & Pipeline Orchestration',
          ],
        };
      case 'compliance_officer':
        return {
          title: 'Compliance & Regulatory Vault',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          testZone: '/auth/compliance-zone',
          features: [
            'AML / CFT Regulatory Reporting',
            'Risk Scoring Matrix Analysis',
            'Threshold Breach Inspection',
            'Audit Trail Review & Exporter',
          ],
        };
      case 'investigator':
      default:
        return {
          title: 'Intelligence Investigation Workspace',
          badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          testZone: '/auth/investigator-zone',
          features: [
            'Transaction Anomaly Detection & Rapid Triaging',
            'Entity Link Analysis & Money Flow Network Graphing',
            'Case Dossier & Evidence Note Aggregation',
            'Automated Suspicious Activity Report (SAR) Generation',
          ],
        };
    }
  };

  const roleDetails = getRoleDetails();

  const handleTestProtectedRoleAccess = async (targetEndpoint) => {
    setTestingEndpoint(true);
    setEndpointResult('');
    try {
      const res = await api.get(targetEndpoint);
      setEndpointResult({ success: true, message: res.data.message });
    } catch (err) {
      setEndpointResult({
        success: false,
        message: err.response?.data?.message || 'Access Forbidden / Error',
      });
    } finally {
      setTestingEndpoint(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-navy-950 text-slate-100">
      {/* Top Navigation */}
      <header className="glass-panel border-b border-slate-800/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                FCIP <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono">Phase 1 Live</span>
              </span>
              <p className="text-[10px] text-slate-400 font-mono -mt-0.5">FINANCIAL CRIME INTELLIGENCE PLATFORM</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                {user?.first_name?.[0] || 'U'}
              </div>
              <div className="text-left text-xs">
                <p className="font-medium text-slate-200">{user?.first_name} {user?.last_name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>

            <button
              id="logout-btn"
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {/* Welcome Banner */}
        <div className="glass-card rounded-2xl p-6 mb-8 border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 via-cyan-500/5 to-transparent pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-mono uppercase tracking-wider border ${roleDetails.badgeColor}`}>
                  {user?.role?.replace('_', ' ')}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Authenticated Session
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {roleDetails.title}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Connected to PostgreSQL database <span className="font-mono text-cyan-400">fcip_db</span>. Security tokens active.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-right">
                <span className="text-[11px] text-slate-400 block uppercase tracking-wider font-mono">User ID #</span>
                <span className="font-mono text-cyan-400 text-sm font-semibold">{user?.id}</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-right">
                <span className="text-[11px] text-slate-400 block uppercase tracking-wider font-mono">Role Status</span>
                <span className="font-mono text-emerald-400 text-sm font-semibold uppercase">{user?.status || 'Active'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Role Overview */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-base">Authorized Capabilities</h3>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {roleDetails.features.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Card 2: Security & Session Context */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-base">Security & Cryptography</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Password Hashing</span>
                <span className="font-mono text-slate-200">bcrypt (10 rounds)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Token Protocol</span>
                <span className="font-mono text-slate-200">JWT (RS256 / HS256)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Session Window</span>
                <span className="font-mono text-slate-200">24 Hours</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Access Control</span>
                <span className="font-mono text-emerald-400">RBAC Middleware Active</span>
              </div>
            </div>
          </div>

          {/* Card 3: RBAC Live Route Verification */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-base">RBAC Live Verification</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Test server-side Role-Based Access Control middleware for your current token.
            </p>
            <div className="space-y-2">
              <button
                id="test-my-role-btn"
                onClick={() => handleTestProtectedRoleAccess(roleDetails.testZone)}
                disabled={testingEndpoint}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 border border-cyan-500/20 transition-all flex items-center justify-between"
              >
                <span>Test My Zone ({roleDetails.testZone})</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                id="test-admin-role-btn"
                onClick={() => handleTestProtectedRoleAccess('/auth/admin-zone')}
                disabled={testingEndpoint}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-red-300 border border-red-500/20 transition-all flex items-center justify-between"
              >
                <span>Test Admin Zone (/auth/admin-zone)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {endpointResult && (
              <div
                className={`mt-3 p-2.5 rounded-xl text-xs flex items-start gap-2 border ${
                  endpointResult.success
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                {endpointResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{endpointResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Next Roadmap Phases Preview */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800">
          <h3 className="font-semibold text-white text-base mb-1">FCIP Roadmap Progression</h3>
          <p className="text-xs text-slate-400 mb-4">
            Phase 1 provides the foundational authentication and PostgreSQL user management framework.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-mono text-emerald-400 uppercase">Phase 1 • Complete</span>
              <p className="font-semibold text-white mt-1">Auth & Setup</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Phase 2 • Up Next</span>
              <p className="font-semibold text-slate-300 mt-1">Financial Data & CSV</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Phase 3</span>
              <p className="font-semibold text-slate-300 mt-1">Detection Rules</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Phase 4 - 8</span>
              <p className="font-semibold text-slate-300 mt-1">Alerts, Graphs & Cases</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
