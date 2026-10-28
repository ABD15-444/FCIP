import React, { useState, useEffect } from 'react';
import { complianceService } from '../services/api';
import {
  ShieldAlert,
  AlertTriangle,
  FileQuestion,
  Sliders,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Flame,
  Activity
} from 'lucide-react';

const ComplianceRiskOversight = ({ onNavigate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOversight = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await complianceService.getRiskOversight();
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch compliance risk oversight metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOversight();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-cyan-400" />
          Compliance Risk Oversight & Quality Assurance
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          High-risk exposure monitoring, investigative documentation hygiene, and rule efficacy oversight.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top 3 High-Level Metric Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>High-Exposure Cases</span>
            <Flame className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white">
            {loading ? '-' : data?.highRiskCases?.length || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cases with Critical or High severity profile</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Documentation Warnings</span>
            <FileQuestion className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-amber-400">
            {loading ? '-' : data?.documentationIssues?.length || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cases submitted with zero linked alerts</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Calibrated AML Rules</span>
            <Sliders className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-cyan-400">
            {loading ? '-' : data?.rules?.length || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Active regulatory detection triggers</p>
        </div>
      </div>

      {/* Two Column Layout: High-Risk Cases & Documentation Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High-Risk Exposure Cases */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400" />
              Highest-Exposure Active Cases
            </h2>
            <span className="text-[10px] font-mono text-slate-500">Regulatory Focus</span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">Loading cases...</div>
            ) : !data?.highRiskCases || data.highRiskCases.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">
                No high-risk cases currently open.
              </div>
            ) : (
              data.highRiskCases.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">CASE #{c.id}</span>
                      <span className="font-semibold text-xs text-white truncate">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                      <span>Status: {c.status.replace(/_/g, ' ')}</span>
                      <span>Alerts: {c.alert_count || 0}</span>
                      <span>Agent: {c.investigator_name || 'Assigned'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate && onNavigate('compliance_cases', { caseId: c.id })}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono transition-all flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Documentation Completeness Warnings */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileQuestion className="w-4 h-4 text-amber-400" />
              Documentation QA & Completeness Warnings
            </h2>
            <span className="text-[10px] font-mono text-amber-400">Quality Flaws</span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs font-mono text-slate-500">Loading quality audit...</div>
            ) : !data?.documentationIssues || data.documentationIssues.length === 0 ? (
              <div className="py-8 text-center text-emerald-400 text-xs font-mono flex flex-col items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span>All submitted cases contain corroborating alert evidence.</span>
              </div>
            ) : (
              data.documentationIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-amber-400 font-bold">WARNING: ZERO EVIDENCE</span>
                      <span className="font-semibold text-xs text-white truncate">{issue.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Investigator: <span className="text-slate-200">{issue.investigator_name || 'Agent'}</span> • Case #{issue.id}
                    </p>
                  </div>

                  <button
                    onClick={() => onNavigate && onNavigate('compliance_cases', { caseId: issue.id })}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-mono transition-all flex items-center gap-1"
                  >
                    <span>Remediate</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detection Rules Performance & Frequency Oversight */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Detection Rules Efficacy & Calibration Matrix
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Read-Only Telemetry</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                <th className="pb-2.5">Rule Name & Code</th>
                <th className="pb-2.5">Severity</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5">Alerts Generated</th>
                <th className="pb-2.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    Loading rule matrix...
                  </td>
                </tr>
              ) : !data?.rules || data.rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    No active rules found.
                  </td>
                </tr>
              ) : (
                data.rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-2 font-medium text-white max-w-[200px] truncate">
                      {rule.name}
                      <span className="block text-[10px] text-cyan-400 font-mono">
                        {rule.rule_code || `RULE-${rule.id}`}
                      </span>
                    </td>
                    <td className="py-3 pr-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                          rule.severity === 'critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {rule.severity}
                      </span>
                    </td>
                    <td className="py-3 pr-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                          rule.is_active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {rule.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 pr-2 font-mono text-white font-bold">
                      {rule.alert_count || 0}
                    </td>
                    <td className="py-3 text-slate-400 max-w-[320px] truncate">
                      {rule.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComplianceRiskOversight;
