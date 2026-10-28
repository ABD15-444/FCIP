import React, { useState, useEffect } from 'react';
import { alertService } from '../services/api';
import { AlertCircle, AlertTriangle, CheckCircle2, UserPlus, Eye, Clock, X, Search, Filter, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AlertsSystem = ({ onOpenCaseFromAlert }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Detail Modal State
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [closureReason, setClosureReason] = useState('');
  const [investigatorNote, setInvestigatorNote] = useState('');
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, severityFilter]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await alertService.getAlerts({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        search: search || undefined,
      });
      if (data.success) setAlerts(data.alerts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setShowCloseDialog(false);
    setClosureReason('');
    setInvestigatorNote('');
    try {
      const data = await alertService.getAlertDetail(id);
      if (data.success) setSelectedAlert(data.alert);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status, extra = {}) => {
    try {
      await alertService.updateStatus(id, status, extra);
      if (selectedAlert?.id === id) {
        setSelectedAlert({ ...selectedAlert, status, ...extra });
      }
      setShowCloseDialog(false);
      loadAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssign = async (id) => {
    try {
      await alertService.assignAlert(id, user.id);
      if (selectedAlert?.id === id) {
        setSelectedAlert({
          ...selectedAlert,
          assigned_to: user.id,
          assignee_first_name: user.first_name,
          assignee_last_name: user.last_name,
        });
      }
      loadAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Suspicious Alerts Triaging</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 4
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated notifications triggered by rule thresholds. Color-coded by severity level.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search alerts or accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadAlerts()}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
          >
            <option value="all">All Severities</option>
            <option value="high">High (Red)</option>
            <option value="medium">Medium (Orange)</option>
            <option value="low">Low (Yellow)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Alerts Grid */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-500 text-xs">
            {loading ? 'Querying alert repository...' : 'No alerts match current filters.'}
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => openDetail(alert.id)}
              className="glass-card p-4 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={`p-2.5 rounded-xl border mt-0.5 flex-shrink-0 ${
                    alert.severity === 'high'
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : alert.severity === 'medium'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                  }`}
                >
                  <AlertCircle className="w-5 h-5" />
                </span>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-400">ALERT-#{alert.id}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        alert.severity === 'high'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : alert.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      alert.status === 'closed'
                        ? 'bg-slate-800 text-slate-400'
                        : alert.status === 'under_investigation'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : 'bg-slate-800 text-slate-200'
                    }`}>
                      {alert.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="font-bold text-white text-sm">{alert.alert_type}</h4>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{alert.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                {alert.transaction_amount && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase">Tx Amount</span>
                    <span className="font-bold text-white">${parseFloat(alert.transaction_amount).toLocaleString()}</span>
                  </div>
                )}
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase">Generated</span>
                  <span className="text-slate-400">{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedAlert(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2 font-mono text-xs">
              <span className="text-slate-400">ALERT #{selectedAlert.id}</span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  selectedAlert.severity === 'high'
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}
              >
                {selectedAlert.severity} Severity
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {selectedAlert.status.replace('_', ' ')}
              </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{selectedAlert.alert_type}</h3>
            <p className="text-xs text-slate-300 mb-6 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              {selectedAlert.description}
            </p>

            {/* Transaction & Rule Context */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2 font-mono">
                <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">Underlying Transaction</span>
                <div>Amount: <span className="text-white font-bold">${parseFloat(selectedAlert.amount || 0).toLocaleString()} {selectedAlert.currency}</span></div>
                <div>From: <span className="text-cyan-400">{selectedAlert.from_account || 'N/A'}</span></div>
                <div>To: <span className="text-indigo-400">{selectedAlert.to_account || 'N/A'}</span></div>
                <div>Channel: <span className="text-slate-300 capitalize">{selectedAlert.channel}</span></div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">Detection Rule Matched</span>
                <div className="text-white font-semibold text-sm">{selectedAlert.rule_name || 'Standard AML Filter'}</div>
                <div className="text-slate-400 text-[11px]">Condition: <span className="font-mono text-slate-300">{selectedAlert.condition_type}</span></div>
                {selectedAlert.risk_score && (
                  <div className="text-emerald-400 font-mono font-bold mt-2">
                    Risk Score: {selectedAlert.risk_score.score} / 100 ({selectedAlert.risk_score.risk_level})
                  </div>
                )}
              </div>
            </div>

            {/* Contributing Risk Factors */}
            {selectedAlert.risk_factors?.length > 0 && (
              <div className="mb-6">
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                  Why It Was Flagged (Risk Factors)
                </h5>
                <div className="space-y-2">
                  {selectedAlert.risk_factors.map((f, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                      <div className="flex justify-between font-semibold text-white">
                        <span>{f.factor_name}</span>
                        <span className="text-red-400 font-mono">+{f.contribution} pts</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Closure Dialog */}
            {showCloseDialog && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs space-y-3">
                <h5 className="font-bold text-red-400 uppercase font-mono">Confirm Alert Closure</h5>
                <div>
                  <label className="block text-slate-300 mb-1">Closure Reason / Resolution Category</label>
                  <select
                    value={closureReason}
                    onChange={(e) => setClosureReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="">-- Select Reason --</option>
                    <option value="False Positive (Legitimate Business Flow)">False Positive (Legitimate Business Flow)</option>
                    <option value="Duplicate Alert (Covered in Prior Case)">Duplicate Alert (Covered in Prior Case)</option>
                    <option value="Low Risk Variance Resolved">Low Risk Variance Resolved</option>
                    <option value="Case Dossier Created">Case Dossier Created</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Investigator Closure Notes</label>
                  <textarea
                    rows={2}
                    value={investigatorNote}
                    onChange={(e) => setInvestigatorNote(e.target.value)}
                    placeholder="Document investigation conclusion..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCloseDialog(false)}
                    className="px-3 py-1.5 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateStatus(selectedAlert.id, 'closed', {
                        closure_reason: closureReason || 'Resolved by investigator',
                        investigator_notes: investigatorNote,
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold"
                  >
                    Confirm & Close Alert
                  </button>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedAlert.id, 'acknowledged')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => handleAssign(selectedAlert.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-400 border border-slate-700 flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Assign to Me
                </button>
                <button
                  onClick={() => setShowCloseDialog(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-medium text-red-400 border border-red-500/20"
                >
                  Close Alert
                </button>
              </div>

              {onOpenCaseFromAlert && (
                <button
                  onClick={() => {
                    const alert = selectedAlert;
                    setSelectedAlert(null);
                    onOpenCaseFromAlert(alert);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20"
                >
                  Escalate to Case Dossier
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsSystem;
