import React, { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  X,
  Clock,
  ShieldCheck,
  RefreshCw,
  Plus
} from 'lucide-react';

const DetectionConfig = () => {
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    threshold_value: '',
    risk_level: '',
    status: '',
    change_reason: '',
  });

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await adminService.getRulesWithHistory();
      if (res.success) {
        setRules(res.rules);
        setHistory(res.history || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (rule) => {
    setSelectedRule(rule);
    setEditForm({
      threshold_value: rule.threshold_value,
      risk_level: rule.risk_level,
      status: rule.status,
      change_reason: '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });
    try {
      const res = await adminService.updateRule(selectedRule.id, editForm);
      if (res.success) {
        setShowEditModal(false);
        setStatusMessage({ type: 'success', text: res.message });
        loadRules();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Error updating detection rule.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Detection Engine Configuration & Calibration</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 6 Configuration
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Recalibrate threshold parameters, toggle active status, and maintain immutable parameter change audit history.
          </p>
        </div>

        <button
          onClick={loadRules}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors self-end md:self-auto"
          title="Refresh Rules"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {statusMessage.text && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <div key={rule.id} className="glass-card p-5 rounded-2xl border border-slate-800 relative flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">
                    <Sliders className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-sm">{rule.rule_name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{rule.condition_type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      rule.risk_level === 'high'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {rule.risk_level}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      rule.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {rule.status}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs font-mono mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Parameter:</span>
                  <span className="text-white font-bold">
                    {rule.condition_type === 'large_amount' && `$${parseFloat(rule.threshold_value).toLocaleString()}`}
                    {rule.condition_type === 'round_number' && `$${parseFloat(rule.threshold_value).toLocaleString()} (Rounded Sum)`}
                    {rule.condition_type === 'rapid_transfer' && `> ${parseInt(rule.threshold_value, 10)} tx in 10 mins`}
                    {rule.condition_type === 'circular_transaction' && `<= ${parseInt(rule.threshold_value, 10)} hops cycle`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-[10px] font-mono text-slate-500">RULE ID #{rule.id}</span>
              <button
                onClick={() => openEdit(rule)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-semibold flex items-center gap-1.5 transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Configure Rule
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Rule Calibration Change History */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 bg-slate-900/60 border-b border-slate-800">
          <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Parameter Change & Version History
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Operator</th>
                <th className="py-2.5 px-4">Rule Ref</th>
                <th className="py-2.5 px-4">Previous Value</th>
                <th className="py-2.5 px-4">Calibrated Value</th>
                <th className="py-2.5 px-4">Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No parameter changes recorded yet. Default baseline rules active.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">{new Date(h.changed_at).toLocaleString()}</td>
                    <td className="py-2.5 px-4 font-sans text-white">{h.first_name} {h.last_name}</td>
                    <td className="py-2.5 px-4 text-cyan-400 font-bold">RULE #{h.rule_id}</td>
                    <td className="py-2.5 px-4 text-slate-400">{parseFloat(h.previous_threshold).toLocaleString()} ({h.previous_status})</td>
                    <td className="py-2.5 px-4 text-emerald-400 font-bold">{parseFloat(h.new_threshold).toLocaleString()} ({h.new_status})</td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">{h.change_reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rule Modal */}
      {showEditModal && selectedRule && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowEditModal(false)} className="absolute right-5 top-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-2">Calibrate {selectedRule.rule_name}</h3>
            <p className="text-xs text-slate-400 mb-4">
              All threshold updates are validated and committed to the immutable parameter audit ledger.
            </p>
            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Trigger Threshold Value</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editForm.threshold_value}
                  onChange={(e) => setEditForm({ ...editForm, threshold_value: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Risk Severity</label>
                  <select
                    value={editForm.risk_level}
                    onChange={(e) => setEditForm({ ...editForm, risk_level: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white capitalize"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Rule Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white capitalize"
                  >
                    <option value="active">Active (Enforcing)</option>
                    <option value="inactive">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Policy Justification / Change Reason</label>
                <textarea
                  rows={2}
                  required
                  value={editForm.change_reason}
                  onChange={(e) => setEditForm({ ...editForm, change_reason: e.target.value })}
                  placeholder="e.g. Adjusted large amount threshold per annual compliance review"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-3 py-1.5 text-slate-400 hover:text-white">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-bold"
                >
                  {saving ? 'Persisting...' : 'Apply Calibration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetectionConfig;

