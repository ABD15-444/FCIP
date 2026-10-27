import React, { useState, useEffect } from 'react';
import { detectionService } from '../services/api';
import { Play, ShieldAlert, Plus, CheckCircle2, AlertTriangle, Sliders, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DetectionRules = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  // New Rule Modal / State (Admin only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_name: '',
    condition_type: 'large_amount',
    threshold_value: 10000,
    risk_level: 'high',
    status: 'active',
  });

  // Risk Score Detail Viewer
  const [inspectEntity, setInspectEntity] = useState({ type: 'transaction', id: 1 });
  const [riskDetail, setRiskDetail] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  useEffect(() => {
    loadRules();
    inspectRisk(1);
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await detectionService.getRules();
      if (data.success) setRules(data.rules);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDetection = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await detectionService.runDetection();
      setRunResult(res);
      loadRules();
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const res = await detectionService.createRule(newRule);
      if (res.success) {
        setShowAddModal(false);
        setNewRule({ rule_name: '', condition_type: 'large_amount', threshold_value: 10000, risk_level: 'high', status: 'active' });
        loadRules();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const inspectRisk = async (entityId) => {
    setInspectLoading(true);
    try {
      const res = await detectionService.getRiskScore('transaction', entityId);
      if (res.success) setRiskDetail(res.score);
    } catch (err) {
      console.error(err);
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Trigger Controls */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Detection Engine & Risk Matrix</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 3
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time rule heuristics: Large Amount ($10K+), Rapid Transfers (&gt;3 in 10 mins), and Circular Hop Cycles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              New Detection Rule
            </button>
          )}

          <button
            onClick={handleRunDetection}
            disabled={running}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
            Execute Detection Run
          </button>
        </div>
      </div>

      {runResult && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{runResult.message}</span>
          </div>
          <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded">
            Alerts Generated: {runResult.newAlertsCount}
          </span>
        </div>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
            Active Detection Rules ({rules.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <div key={rule.id} className="glass-card p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">
                      <Sliders className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-sm">{rule.rule_name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">{rule.condition_type}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      rule.risk_level === 'high'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {rule.risk_level}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">Trigger Threshold:</span>
                  <span className="font-mono font-bold text-white">
                    {rule.condition_type === 'large_amount' ? `$${parseFloat(rule.threshold_value).toLocaleString()}` : `${rule.threshold_value} units`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Score & Contributing Factor Breakdown */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            Risk Factor Breakdown
          </h3>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="number"
              min="1"
              value={inspectEntity.id}
              onChange={(e) => setInspectEntity({ ...inspectEntity, id: parseInt(e.target.value, 10) || 1 })}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white w-24 font-mono"
            />
            <button
              onClick={() => inspectRisk(inspectEntity.id)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
            >
              Inspect Tx #{inspectEntity.id}
            </button>
          </div>

          {riskDetail ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Composite Score</span>
                  <div className="text-3xl font-extrabold text-white font-mono mt-0.5">
                    {riskDetail.score} <span className="text-sm text-slate-400 font-sans">/ 100</span>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${
                    riskDetail.risk_level === 'High'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : riskDetail.risk_level === 'Medium'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {riskDetail.risk_level} Risk
                </span>
              </div>

              <div>
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                  Contributing Factors ({riskDetail.factors?.length || 0})
                </h5>
                <div className="space-y-2">
                  {riskDetail.factors?.length > 0 ? (
                    riskDetail.factors.map((f, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-white">{f.factor_name}</span>
                          <span className="font-mono text-cyan-400 font-bold">+{f.contribution} pts</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{f.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">No risk factors triggered for this entity.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">Enter transaction ID to view risk telemetry.</p>
          )}
        </div>
      </div>

      {/* Admin New Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create Detection Heuristic</h3>
            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                  placeholder="e.g., Sanctioned Jurisdiction Influx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Condition Type</label>
                <select
                  value={newRule.condition_type}
                  onChange={(e) => setNewRule({ ...newRule, condition_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="large_amount">Large Amount Threshold</option>
                  <option value="rapid_transfer">Rapid Transfer Frequency</option>
                  <option value="circular_transaction">Circular Money Loop</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Threshold Value</label>
                <input
                  type="number"
                  required
                  value={newRule.threshold_value}
                  onChange={(e) => setNewRule({ ...newRule, threshold_value: parseFloat(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Severity Risk Level</label>
                <select
                  value={newRule.risk_level}
                  onChange={(e) => setNewRule({ ...newRule, risk_level: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-bold"
                >
                  Deploy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetectionRules;
