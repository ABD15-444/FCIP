import React, { useState, useEffect } from 'react';
import { complianceService } from '../services/api';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Flame,
  Calendar,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  RefreshCw
} from 'lucide-react';

const ComplianceDashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('all');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await complianceService.getStats({ timeRange });
      setStats(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load compliance metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-cyan-400" />
            Compliance Review & Governance Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Regulatory oversight, independent decisioning, and SAR dossier validation telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time range filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            {['7d', '30d', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg font-mono uppercase text-[11px] transition-all ${
                  timeRange === range
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All-Time'}
              </button>
            ))}
          </div>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Grid (Section 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Cases Awaiting Review */}
        <button
          onClick={() => onNavigate && onNavigate('compliance_queue')}
          className="text-left p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono">Awaiting Cases</span>
            <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '-' : stats?.cards?.cases_awaiting_review || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            Submitted by Inv. <ArrowRight className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </button>

        {/* Reports Awaiting Review */}
        <button
          onClick={() => onNavigate && onNavigate('compliance_sars')}
          className="text-left p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono">Pending SARs</span>
            <FileCheck2 className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '-' : stats?.cards?.reports_awaiting_review || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            Dossier sign-offs <ArrowRight className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </button>

        {/* Reports Approved Internally */}
        <button
          onClick={() => onNavigate && onNavigate('compliance_reports')}
          className="text-left p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono">Approved SARs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {loading ? '-' : stats?.cards?.reports_approved || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            Ready for FinCEN <ArrowRight className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </button>

        {/* Reports Returned for Correction */}
        <button
          onClick={() => onNavigate && onNavigate('compliance_reports')}
          className="text-left p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono">Returned Dossiers</span>
            <RotateCcw className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {loading ? '-' : stats?.cards?.reports_returned || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            Remediating evidence <ArrowRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </button>

        {/* Overdue Reviews */}
        <button
          onClick={() => onNavigate && onNavigate('compliance_queue')}
          className="text-left p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-red-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono">Overdue Reviews</span>
            <AlertTriangle className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">
            {loading ? '-' : stats?.cards?.overdue_reviews || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            Past statutory SLA <ArrowRight className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </button>

        {/* Escalated Cases */}
        <button
          onClick={() => onNavigate && onNavigate('compliance_queue')}
          className="text-left p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-mono">Escalations</span>
            <Flame className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {loading ? '-' : stats?.cards?.cases_escalated || 0}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            Executive review <ArrowRight className="w-3 h-3 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        </button>
      </div>

      {/* Two Column Layout: Workload & High Priority Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Workload Distribution */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Workload Status Distribution
            </h2>
            <span className="text-[10px] font-mono text-slate-500">Live Breakdown</span>
          </div>

          <div className="space-y-3 pt-2">
            {[
              { label: 'Submitted for Review', count: stats?.workload?.submitted || 0, color: 'bg-amber-400' },
              { label: 'Under Active Review', count: stats?.workload?.under_review || 0, color: 'bg-cyan-400' },
              { label: 'Returned for Correction', count: stats?.workload?.returned || 0, color: 'bg-orange-400' },
              { label: 'Compliance Accepted', count: stats?.workload?.accepted || 0, color: 'bg-emerald-400' },
              { label: 'Formally Escalated', count: stats?.workload?.escalated || 0, color: 'bg-rose-500' },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-mono font-bold text-white">{item.count}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color}`}
                    style={{
                      width: `${
                        Math.max(
                          (item.count /
                            Math.max(
                              1,
                              (stats?.workload?.submitted || 0) +
                                (stats?.workload?.under_review || 0) +
                                (stats?.workload?.returned || 0) +
                                (stats?.workload?.accepted || 0) +
                                (stats?.workload?.escalated || 0)
                            )) * 100,
                          item.count > 0 ? 5 : 0
                        )
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Report Review Clearance</span>
              <span className="font-mono text-cyan-400 font-semibold">
                {stats?.cards?.reports_approved && (stats?.cards?.reports_approved + stats?.cards?.reports_awaiting_review > 0)
                  ? `${Math.round(
                      (stats.cards.reports_approved /
                        (stats.cards.reports_approved + stats.cards.reports_awaiting_review + stats.cards.reports_returned)) *
                        100
                    )}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (2 spans): Pending High-Priority Reviews */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Pending High-Priority Review Items
            </h2>
            <button
              onClick={() => onNavigate && onNavigate('compliance_queue')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              Open Full Queue <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="pb-2.5">Case Title</th>
                  <th className="pb-2.5">Priority</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Deadline</th>
                  <th className="pb-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                      Loading queue telemetry...
                    </td>
                  </tr>
                ) : !stats?.pendingHighPriority || stats.pendingHighPriority.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                      No high-priority cases currently awaiting compliance review.
                    </td>
                  </tr>
                ) : (
                  stats.pendingHighPriority.map((item) => {
                    const isOverdue = item.review_deadline && new Date(item.review_deadline) < new Date();
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 pr-2 font-medium text-white max-w-[200px] truncate">
                          {item.title}
                          <span className="block text-[10px] text-slate-500 font-mono">
                            Case #{item.id} • {item.alert_count || 0} Alerts
                          </span>
                        </td>
                        <td className="py-3 pr-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                              item.priority === 'critical'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td className="py-3 pr-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 pr-2 font-mono text-[11px]">
                          {item.review_deadline ? (
                            <span className={isOverdue ? 'text-red-400 font-bold flex items-center gap-1' : 'text-slate-400'}>
                              {isOverdue && <AlertTriangle className="w-3 h-3 text-red-400" />}
                              {new Date(item.review_deadline).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-500">None set</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => onNavigate && onNavigate('compliance_cases', { caseId: item.id })}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 font-mono text-[11px] transition-all"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Compliance Activity Table */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            Recent Compliance Activity Ledger
          </h2>
          <button
            onClick={() => onNavigate && onNavigate('compliance_reports')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
          >
            Governance Reports <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                <th className="pb-2.5">Timestamp</th>
                <th className="pb-2.5">Reviewer</th>
                <th className="pb-2.5">Action</th>
                <th className="pb-2.5">Target Case</th>
                <th className="pb-2.5">Compliance Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    Loading activity telemetry...
                  </td>
                </tr>
              ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    No compliance review actions recorded in this window.
                  </td>
                </tr>
              ) : (
                stats.recentActivity.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-2 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(act.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-2 font-medium text-white whitespace-nowrap">
                      {act.first_name ? `${act.first_name} ${act.last_name || ''}` : 'Compliance Officer'}
                    </td>
                    <td className="py-3 pr-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                          act.action.includes('ACCEPT') || act.action.includes('APPROV')
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : act.action.includes('RETURN')
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : act.action.includes('ESCALAT')
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {act.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-slate-300 max-w-[200px] truncate">
                      {act.case_title || `Case #${act.case_id}`}
                    </td>
                    <td className="py-3 text-slate-400 max-w-[300px] truncate">
                      {act.comments || 'No comment provided.'}
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

export default ComplianceDashboard;
