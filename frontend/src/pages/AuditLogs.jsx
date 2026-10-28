import React, { useState, useEffect } from 'react';
import { auditService } from '../services/api';
import {
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  Calendar
} from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionsList, setActionsList] = useState([]);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Selected Log Event Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadActions();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [actionFilter, outcomeFilter, fromDate, toDate, page]);

  const loadActions = async () => {
    try {
      const res = await auditService.getActions();
      if (res.success) setActionsList(res.actions);
    } catch (e) {
      // silent
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getLogs({
        action: actionFilter !== 'all' ? actionFilter : undefined,
        outcome: outcomeFilter !== 'all' ? outcomeFilter : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        search: search || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });
      if (data.success) {
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setActionFilter('all');
    setOutcomeFilter('all');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Security & Compliance Audit Ledger</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
              Phase 8 • Admin Only
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable tracking of user logins, rule updates, alert triaging, user management, and dossier report compilations.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors self-end md:self-auto"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actor, action, payload..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(0), loadLogs())}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
          >
            <option value="all">All Action Events</option>
            {actionsList.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
          >
            <option value="all">All Outcomes</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
            title="From Date"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-[11px]"
            title="To Date"
          />

          {(search || actionFilter !== 'all' || outcomeFilter !== 'all' || fromDate || toDate) && (
            <button onClick={clearFilters} className="text-cyan-400 hover:text-cyan-300 text-xs underline">
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor & Role</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    {loading ? 'Reading immutable audit ledger...' : 'No audit entries found matching criteria.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-400 font-bold">#{log.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {log.email ? (
                        <div>
                          <div className="font-semibold text-white">{log.first_name} {log.last_name}</div>
                          <div className="text-[10px] text-cyan-400 font-mono capitalize">
                            {log.user_role?.replace('_', ' ') || 'investigator'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-slate-400 font-mono">System / Unauthenticated</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white text-[11px]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                      {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        log.outcome === 'SUCCESS'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}>
                        {log.outcome}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {log.ip_address}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-sans inline-flex items-center gap-1 border border-slate-700"
                      >
                        <Eye className="w-3 h-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Showing {logs.length > 0 ? page * pageSize + 1 : 0} to {Math.min(total, (page + 1) * pageSize)} of {total} audit records
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button
              disabled={(page + 1) * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2 font-mono text-xs">
              <span className="text-slate-400">AUDIT EVENT #{selectedLog.id}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                selectedLog.outcome === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {selectedLog.outcome}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-4">{selectedLog.action}</h3>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-sans">Timestamp</span>
                <span className="text-white">{new Date(selectedLog.timestamp).toLocaleString()}</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-sans">Client IP</span>
                <span className="text-cyan-300">{selectedLog.ip_address}</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-sans">Acting User</span>
                <span className="text-white font-sans">{selectedLog.first_name ? `${selectedLog.first_name} ${selectedLog.last_name}` : 'System Agent'}</span>
                <span className="text-slate-400 block text-[10px]">{selectedLog.email || '—'}</span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block font-sans">Role</span>
                <span className="text-indigo-400 capitalize">{selectedLog.user_role?.replace('_', ' ') || 'None'}</span>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Audit Payload Metadata</span>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="text-[11px] text-slate-500 font-mono text-center pt-2 border-t border-slate-800">
              Immutable Cryptographic Audit Record • FCIP Phase 8
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
