import React, { useState, useEffect } from 'react';
import { dashboardService, reportService, caseService } from '../services/api';
import { Activity, ShieldAlert, AlertTriangle, Layers, FileText, Download, ArrowUpRight, TrendingUp, PieChart as PieIcon, RefreshCw } from 'lucide-react';

const DashboardOverview = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [riskChart, setRiskChart] = useState(null);
  const [volume, setVolume] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reports
  const [reports, setReports] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' | 'reports'

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [sRes, rRes, vRes, aRes, repRes, cRes] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRiskChart(),
        dashboardService.getTransactionVolume(),
        dashboardService.getRecentAlerts(),
        reportService.getReports(),
        caseService.getCases(),
      ]);

      if (sRes.success) setStats(sRes.stats);
      if (rRes.success) setRiskChart(rRes.distribution);
      if (vRes.success) setVolume(vRes.volume);
      if (aRes.success) setRecentAlerts(aRes.alerts);
      if (repRes.success) setReports(repRes.reports);
      if (cRes.success) setCases(cRes.cases);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    if (!selectedCaseId) return;
    setGeneratingReport(true);
    try {
      const res = await reportService.generateReport(parseInt(selectedCaseId, 10));
      if (res.success) {
        const repRes = await reportService.getReports();
        if (repRes.success) setReports(repRes.reports);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Intelligence Telemetry & Dossier Reports</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 7
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Aggregate transaction volumes, risk distributions, and automated SAR compliance exports.
          </p>
        </div>

        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'metrics' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dashboard Analytics
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'reports' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Compliance Dossiers ({reports.length})
          </button>
        </div>
      </div>

      {activeTab === 'metrics' ? (
        <>
          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Transactions</span>
              <div className="text-2xl font-black text-white font-mono mt-1">
                {stats?.totalTransactions?.toLocaleString() || 0}
              </div>
              <div className="text-[11px] text-cyan-400 mt-2 font-mono flex items-center gap-1">
                <span>{stats?.flaggedTransactions || 0} Flagged</span>
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Active Alerts</span>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                {stats?.openAlerts || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-mono">
                Awaiting Investigator Triage
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Active Cases</span>
              <div className="text-2xl font-black text-indigo-400 font-mono mt-1">
                {stats?.openCases || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-mono">
                Under Surveillance
              </div>
            </div>

            <div className="glass-card p-5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">High-Risk Entities</span>
              <div className="text-2xl font-black text-red-400 font-mono mt-1">
                {stats?.highRiskEntities || 0}
              </div>
              <div className="text-[11px] text-red-400/80 mt-2 font-mono">
                Escalated Thresholds
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk Distribution Breakdown */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800">
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono mb-4 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-cyan-400" />
                Risk Tier Distribution
              </h3>

              {riskChart ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-red-400 font-bold">High Risk (71 - 100)</span>
                      <span className="text-white font-bold">{riskChart.High || 0}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${((riskChart.High || 0) / (stats?.totalTransactions || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-amber-400 font-bold">Medium Risk (41 - 70)</span>
                      <span className="text-white font-bold">{riskChart.Medium || 0}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${((riskChart.Medium || 0) / (stats?.totalTransactions || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1.5">
                      <span className="text-emerald-400 font-bold">Low Risk (0 - 40)</span>
                      <span className="text-white font-bold">{riskChart.Low || 0}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${((riskChart.Low || 0) / (stats?.totalTransactions || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">No risk data recorded.</p>
              )}
            </div>

            {/* Daily Transaction Volume */}
            <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-800">
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Transaction Volume Over Time
              </h3>

              <div className="space-y-3">
                {volume.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No transactions recorded for chart.</p>
                ) : (
                  volume.slice(-7).map((v, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">{v.date}</span>
                        <span className="text-white font-bold">${parseFloat(v.total_volume || 0).toLocaleString()} ({v.count} txs)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(15, (parseFloat(v.total_volume || 0) / 150000) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Alerts Table */}
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase font-mono">Recent High-Priority Alerts</h4>
              <button
                onClick={() => onNavigate && onNavigate('alerts')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                View All Alerts &rarr;
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Alert</th>
                    <th className="py-2.5 px-4">Severity</th>
                    <th className="py-2.5 px-4">Rule Matched</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentAlerts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 text-cyan-400 font-bold">ALERT-#{a.id}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-white font-sans">{a.rule_name || a.alert_type}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-200">
                        ${parseFloat(a.amount || 0).toLocaleString()} {a.currency}
                      </td>
                      <td className="py-2.5 px-4 uppercase text-slate-400 text-[10px]">{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Reports Section */
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800 max-w-xl mx-auto">
            <h3 className="text-sm font-bold text-white mb-2 uppercase font-mono">Compile Official SAR Dossier</h3>
            <p className="text-xs text-slate-400 mb-4">
              Select an open or in-progress case to compile all linked alerts, transactions, and risk matrices into an official report.
            </p>

            <form onSubmit={handleGenerateReport} className="flex gap-2">
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="">-- Choose Case --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    CASE #{c.id} - {c.title} ({c.priority})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={generatingReport || !selectedCaseId}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-bold text-xs disabled:opacity-50"
              >
                {generatingReport ? 'Compiling...' : 'Generate Dossier'}
              </button>
            </form>
          </div>

          {/* Reports Table */}
          <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Report ID</th>
                  <th className="py-3 px-4">Dossier Title</th>
                  <th className="py-3 px-4">Compiled By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">REP-#{r.id}</td>
                    <td className="py-3 px-4 text-white font-semibold">{r.title}</td>
                    <td className="py-3 px-4 text-slate-300">{r.first_name} {r.last_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={reportService.getExportUrl(r.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export / Print PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
