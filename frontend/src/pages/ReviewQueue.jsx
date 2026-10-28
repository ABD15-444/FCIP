import React, { useState, useEffect } from 'react';
import { complianceService } from '../services/api';
import {
  Inbox,
  Filter,
  Search,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  RefreshCw,
  Eye,
  Play
} from 'lucide-react';

const ReviewQueue = ({ onSelectCase }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, cases, reports
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('deadline');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await complianceService.getQueue({
        priority: filterPriority,
        type: filterType,
        search,
        sortBy,
        page,
        limit: 15,
      });
      setItems(data.items || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch review queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [filterPriority, filterType, sortBy, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchQueue();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-cyan-400" />
            Compliance Review Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Consolidated intake of investigator case referrals, pending dossiers, and regulatory review items.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          disabled={loading}
          className="self-start md:self-auto p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2 text-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by title, investigator, or case ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => {
              setFilterPriority(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Items</option>
            <option value="cases">Cases Only</option>
            <option value="reports">SAR Reports Only</option>
          </select>

          {/* Sort order */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="deadline">Sort: Deadline</option>
            <option value="submission">Sort: Submission Date</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Queue Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                <th className="py-3 px-4">Item & Identifier</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Current Status</th>
                <th className="py-3 px-3">Submitting Investigator</th>
                <th className="py-3 px-3">Submitted At</th>
                <th className="py-3 px-3">Review Deadline</th>
                <th className="py-3 px-4 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    Loading review queue telemetry...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    No review items matching the selected criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isOverdue = item.review_deadline && new Date(item.review_deadline) < new Date();
                  return (
                    <tr key={`${item.item_type}-${item.id}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white max-w-[220px] truncate">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: #{item.id} • Alerts: {item.alert_count || 0}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                            item.item_type === 'report'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {item.item_type === 'report' ? 'SAR Dossier' : 'Case File'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                            item.priority === 'critical'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : item.priority === 'high'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.priority || 'medium'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800/80 text-slate-300 border border-slate-700">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {item.investigator_name || 'Assigned Agent'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {item.review_deadline ? (
                          <span
                            className={
                              isOverdue
                                ? 'text-red-400 font-bold flex items-center gap-1'
                                : 'text-slate-300'
                            }
                          >
                            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                            {new Date(item.review_deadline).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectCase && onSelectCase(item)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-semibold font-mono text-xs transition-all inline-flex items-center gap-1.5"
                        >
                          {item.status === 'under_compliance_review' ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Resume Review</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Start Review</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-mono text-white">{items.length}</span> of{' '}
            <span className="font-mono text-white">{totalCount}</span> items
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-50 hover:text-white"
            >
              Previous
            </button>
            <span className="font-mono text-white px-2">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={items.length < 15}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-50 hover:text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewQueue;
