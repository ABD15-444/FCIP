import React, { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  Layers,
  ShieldAlert
} from 'lucide-react';

const DataAdmin = () => {
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminService.getDataHistory();
      if (res.success) {
        setHistory(res.history || []);
        setSummary(res.summary);
      }
    } catch (err) {
      console.error(err);
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
            <span>Data Ingestion & Dataset Administration</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 8 Data Operations
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Audit batch feed history, duplicate suppression rates, rejected row reasons, and data quality health.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors self-end md:self-auto"
          title="Refresh History"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Rows Processed</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {parseInt(summary?.total_rows || 0, 10).toLocaleString()}
          </div>
          <div className="text-[11px] text-cyan-400 mt-2 font-mono">Across All Ingest Batches</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Transactions Created</span>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {parseInt(summary?.total_txs_created || 0, 10).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">Committed to Database</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Duplicates Suppressed</span>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {parseInt(summary?.total_duplicates_suppressed || 0, 10).toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-2 font-mono">Idempotent Protection</div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Rejected Malformed Rows</span>
          <div className="text-2xl font-black text-red-400 font-mono mt-1">
            {parseInt(summary?.total_rejected_rows || 0, 10).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">Validation Failures</div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-900/60 border-b border-slate-800">
          <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Ingestion Batch Audit Ledger
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Batch ID</th>
                <th className="py-2.5 px-4">File Source</th>
                <th className="py-2.5 px-4">Operator</th>
                <th className="py-2.5 px-4">Rows Parsed</th>
                <th className="py-2.5 px-4">New Txs</th>
                <th className="py-2.5 px-4">Duplicates Ignored</th>
                <th className="py-2.5 px-4">Rejected</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                    No dataset ingestion history records found.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-4 font-mono text-cyan-400 font-bold">BATCH-#{h.id}</td>
                    <td className="py-2.5 px-4 font-mono text-white">{h.filename || 'dataset.csv'}</td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {h.first_name ? `${h.first_name} ${h.last_name}` : 'Automated Ingest'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-white">{h.rows_parsed}</td>
                    <td className="py-2.5 px-4 font-mono text-emerald-400 font-bold">{h.transactions_created}</td>
                    <td className="py-2.5 px-4 font-mono text-amber-400">{h.duplicates_ignored}</td>
                    <td className="py-2.5 px-4 font-mono text-red-400">{h.rejected_count}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">{new Date(h.ingested_at).toLocaleString()}</td>
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

export default DataAdmin;

