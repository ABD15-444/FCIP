import React, { useState, useEffect } from 'react';
import { auditService } from '../services/api';
import { FileSpreadsheet, Filter, Search, ShieldAlert, Clock, UserCheck, RefreshCw } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getLogs({
        action: actionFilter || undefined,
        limit: 100,
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
            Immutable tracking of user logins, rule updates, alert triaging, and dossier report compilations.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="Filter by action name..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
          />
          <button
            onClick={loadLogs}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Log ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4">Audit Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    {loading ? 'Reading audit trail...' : 'No audit entries recorded.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-mono text-slate-400">#{log.id}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {log.email ? (
                        <div>
                          <div className="font-semibold text-white">{log.first_name} {log.last_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{log.email}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-mono">System Service</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {log.entity_type ? `${log.entity_type} #${log.entity_id || 'N/A'}` : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {log.ip_address}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px] max-w-xs truncate">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
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

export default AuditLogs;
