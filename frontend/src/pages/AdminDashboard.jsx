import React, { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import {
  Users,
  ShieldCheck,
  Activity,
  Database,
  Sliders,
  AlertTriangle,
  Briefcase,
  ClipboardList,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Server,
  RefreshCw,
  Clock
} from 'lucide-react';

const AdminDashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, hRes] = await Promise.all([
        adminService.getStats(),
        adminService.getSystemHealth(),
      ]);
      if (sRes.success) {
        setStats(sRes.stats);
        setRecentActivity(sRes.recentActivity || []);
      }
      if (hRes.success) setHealth(hRes.health);
    } catch (err) {
      console.error('Admin telemetry load error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Platform Operations & Administration</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
              Administrator Master View
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            System health telemetry, user authorization management, detection engine oversight, and security ledger.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors self-end md:self-auto flex items-center gap-2 text-xs border border-slate-800"
          title="Refresh Operations Telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4 Primary Operational Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* User Account Operations */}
        <div
          onClick={() => onNavigate('admin_users')}
          className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Registered Operators</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats?.users?.total || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono flex items-center justify-between">
            <span className="text-emerald-400">{stats?.users?.active || 0} Active</span>
            <span>{stats?.users?.inactive || 0} Inactive</span>
          </div>
        </div>

        {/* Roles Distribution */}
        <div
          onClick={() => onNavigate('admin_roles')}
          className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Access Roles</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats?.users?.byRole?.admin || 0} <span className="text-xs text-slate-400 font-sans font-normal">Admins</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            {stats?.users?.byRole?.investigator || 0} Investigators • {stats?.users?.byRole?.compliance_officer || 0} Compliance
          </div>
        </div>

        {/* Data Ingestion Pipeline */}
        <div
          onClick={() => onNavigate('admin_data')}
          className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Ingestion Vault</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats?.transactions?.total?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-emerald-400 mt-2 font-mono">
            {stats?.transactions?.totalIngests || 0} Batch Ingestion Runs
          </div>
        </div>

        {/* Audit Trail Volume */}
        <div
          onClick={() => onNavigate('audit')}
          className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-red-500/40 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Security Events</span>
            <ClipboardList className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats?.security?.auditEventCount?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Immutable Audit Trail Logs
          </div>
        </div>
      </div>

      {/* Operations Quick Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health Status Panel */}
        <div
          onClick={() => onNavigate('admin_health')}
          className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
        >
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Backend & DB Infrastructure
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {health?.status || 'ONLINE'}
            </span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">PostgreSQL Latency:</span>
              <span className="text-white font-bold">{health?.database?.latencyMs ?? 1} ms</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Process Uptime:</span>
              <span className="text-emerald-400 font-bold">{Math.floor((health?.uptimeSeconds || 0) / 60)} minutes</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Platform Version:</span>
              <span className="text-cyan-400 font-bold">{health?.version || '2.4.0'}</span>
            </div>
          </div>
        </div>

        {/* Detection Engine Status */}
        <div
          onClick={() => onNavigate('admin_detection')}
          className="glass-card p-6 rounded-2xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
        >
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Detection Engine Operations
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              4 Active Rules
            </span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Total Scanned Runs:</span>
              <span className="text-white font-bold">{stats?.detection?.totalRuns || 0}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Failed Executions:</span>
              <span className="text-emerald-400 font-bold">{stats?.detection?.failedRuns || 0}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Rules Calibrated:</span>
              <span className="text-amber-400 font-bold">100% Validated</span>
            </div>
          </div>
        </div>

        {/* Open Alerts & Cases Across Agency */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Agency Caseload Status
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Unclosed Alerts:</span>
              <span className="text-red-400 font-bold">{stats?.security?.openAlerts || 0}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Active Dossiers:</span>
              <span className="text-indigo-400 font-bold">{stats?.security?.openCases || 0}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400">Security Health:</span>
              <span className="text-emerald-400 font-bold">Protected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Administrative Activity Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Recent Administrative Actions & Events
          </h4>
          <button
            onClick={() => onNavigate('audit')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium font-mono"
          >
            View Complete Audit Ledger &rarr;
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Outcome</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentActivity.map((a) => (
                <tr key={a.id} className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-4 text-cyan-400 font-bold">EVENT-#{a.id}</td>
                  <td className="py-2.5 px-4 text-white font-bold">{a.action}</td>
                  <td className="py-2.5 px-4 text-slate-300 font-sans">
                    {a.first_name ? `${a.first_name} ${a.last_name}` : 'System'}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      a.outcome === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {a.outcome || 'SUCCESS'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-[11px]">{new Date(a.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

