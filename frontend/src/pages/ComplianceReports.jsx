import React, { useState, useEffect } from 'react';
import { complianceService } from '../services/api';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Calendar,
  Layers
} from 'lucide-react';

const ComplianceReports = () => {
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
      setError(err.response?.data?.error || 'Failed to fetch compliance report analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const cards = stats?.cards || {};
  const workload = stats?.workload || {};

  const totalPipelineCases = Math.max(
    1,
    (workload.submitted || 0) +
      (workload.under_review || 0) +
      (workload.returned || 0) +
      (workload.accepted || 0) +
      (workload.escalated || 0)
  );

  const totalReviewsDecided =
    (cards.reports_approved || 0) + (cards.reports_returned || 0) + (cards.reports_awaiting_review || 0);

  const approvalRate =
    totalReviewsDecided > 0
      ? Math.round(((cards.reports_approved || 0) / totalReviewsDecided) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <PieChart className="w-6 h-6 text-cyan-400" />
            Compliance Governance & Performance Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated audit performance, approval velocity, return rate diagnostics, and regulatory disposition tracking.
          </p>
        </div>

        {/* Date Filter */}
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
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top 4 Compliance Intelligence Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Overall Approval Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400">
            {loading ? '-' : `${approvalRate}%`}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Dossiers cleared on review</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Return / Defect Rate</span>
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-amber-400">
            {loading
              ? '-'
              : `${
                  totalReviewsDecided > 0
                    ? Math.round(((cards.reports_returned || 0) / totalReviewsDecided) * 100)
                    : 0
                }%`}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Dossiers requiring reinvestigation</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>SLA Overdue Items</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-red-400">
            {loading ? '-' : cards.overdue_reviews || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Items exceeding review timeframe</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase mb-2">
            <span>Escalation Volume</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-rose-400">
            {loading ? '-' : cards.cases_escalated || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Referred to Legal / Executive</p>
        </div>
      </div>

      {/* Analytical Detail Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review Outcome Distribution */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Dossier Review Disposition Breakdown
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Live Totals</span>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Formally Approved SARs</span>
                <span className="font-mono font-bold text-emerald-400">{cards.reports_approved || 0}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(100, ((cards.reports_approved || 0) / Math.max(1, totalReviewsDecided)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Returned for Deficiencies</span>
                <span className="font-mono font-bold text-amber-400">{cards.reports_returned || 0}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500"
                  style={{
                    width: `${Math.min(100, ((cards.reports_returned || 0) / Math.max(1, totalReviewsDecided)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Pending Compliance Review</span>
                <span className="font-mono font-bold text-cyan-400">{cards.reports_awaiting_review || 0}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500"
                  style={{
                    width: `${Math.min(100, ((cards.reports_awaiting_review || 0) / Math.max(1, totalReviewsDecided)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Investigative Pipeline Stage Telemetry */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Investigation Case Pipeline Status
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Cross-Platform Status</span>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Submitted by Investigators</span>
                <span className="font-mono font-bold text-white">{workload.submitted || 0}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.min(100, ((workload.submitted || 0) / totalPipelineCases) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Under Active Compliance Review</span>
                <span className="font-mono font-bold text-white">{workload.under_review || 0}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400"
                  style={{ width: `${Math.min(100, ((workload.under_review || 0) / totalPipelineCases) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Accepted for Regulatory Action</span>
                <span className="font-mono font-bold text-white">{workload.accepted || 0}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${Math.min(100, ((workload.accepted || 0) / totalPipelineCases) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceReports;
