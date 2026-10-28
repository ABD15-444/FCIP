import React, { useState, useEffect } from 'react';
import { caseService, alertService, complianceService } from '../services/api';
import {
  Briefcase,
  Plus,
  MessageSquare,
  Clock,
  ShieldCheck,
  CheckCircle2,
  User,
  ChevronRight,
  Send,
  AlertTriangle,
  RotateCcw,
  Search,
  UploadCloud,
  FileCheck2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CaseManagement = ({ prefillAlert, onCaseCreated }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState(prefillAlert ? 'create' : 'list'); // 'list' | 'create' | 'detail'
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Create Case Form
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState(prefillAlert?.id || '');
  const [title, setTitle] = useState(prefillAlert ? `Investigation: ${prefillAlert.alert_type}` : '');
  const [description, setDescription] = useState(prefillAlert?.description || '');
  const [priority, setPriority] = useState('medium');
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Case Detail State
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    loadCases();
    alertService.getAlerts().then((res) => {
      if (res.success) setAlerts(res.alerts);
    });
  }, [statusFilter, priorityFilter]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const data = await caseService.getCases({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: search || undefined,
      });
      if (data.success) setCases(data.cases);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (id) => {
    setSelectedCaseId(id);
    setActiveView('detail');
    setDetailLoading(true);
    try {
      const res = await caseService.getCaseDetail(id);
      if (res.success) setCaseDetail(res.case);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    setCreating(true);
    setErrorMessage('');
    try {
      const res = await caseService.createCase({
        title,
        description,
        priority,
        alert_id: selectedAlertId ? parseInt(selectedAlertId, 10) : null,
      });
      if (res.success) {
        setTitle('');
        setDescription('');
        setSelectedAlertId('');
        loadCases();
        handleOpenDetail(res.case.id);
        if (onCaseCreated) onCaseCreated();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Error creating case dossier.');
    } finally {
      setCreating(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedCaseId) return;
    setSubmittingNote(true);
    try {
      await caseService.addNote(selectedCaseId, newNote.trim());
      setNewNote('');
      const updated = await caseService.getCaseDetail(selectedCaseId);
      if (updated.success) setCaseDetail(updated.case);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    try {
      await caseService.updateCase(selectedCaseId, { status });
      const updated = await caseService.getCaseDetail(selectedCaseId);
      if (updated.success) setCaseDetail(updated.case);
      loadCases();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Case Dossier & Evidence Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Phase 6
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Conduct formal financial crime investigations, append evidence notes, and maintain immutable case histories.
          </p>
        </div>

        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveView('list')}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
              activeView === 'list' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cases Ledger ({cases.length})
          </button>
          <button
            onClick={() => {
              setActiveView('create');
              setErrorMessage('');
            }}
            className={`px-3.5 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeView === 'create' ? 'bg-cyan-500 text-navy-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Open New Case
          </button>
        </div>
      </div>

      {/* View 1: Cases List */}
      {activeView === 'list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search case title or overview..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCases()}
                className="bg-transparent border-none text-white text-xs placeholder-slate-500 focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="escalated">Escalated</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cases.length === 0 ? (
              <div className="col-span-full glass-card p-12 text-center text-slate-500 text-xs">
                No active cases matching current filters.
              </div>
            ) : (
              cases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleOpenDetail(c.id)}
                  className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">CASE-#{c.id}</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                            c.priority === 'high'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {c.priority} Priority
                        </span>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded ${
                          c.status === 'closed' ? 'bg-slate-800 text-slate-400' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <h4 className="font-bold text-white text-sm mb-1 line-clamp-1">{c.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{c.description || 'No summary entered.'}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      {c.note_count || 0} Notes
                    </span>
                    <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* View 2: Create Case */}
      {activeView === 'create' && (
        <div className="glass-card p-8 rounded-2xl border border-slate-800 max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-white mb-2">Initiate Formal Case Dossier</h3>
          <p className="text-xs text-slate-400 mb-6">
            Link an automated alert to an official investigation and assign priority. Duplicate case creation is prevented.
          </p>

          {errorMessage && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleCreateCase} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Select Triggering Alert</label>
              <select
                value={selectedAlertId}
                onChange={(e) => {
                  setSelectedAlertId(e.target.value);
                  const a = alerts.find((x) => x.id === parseInt(e.target.value, 10));
                  if (a) {
                    setTitle(`Investigation: ${a.alert_type}`);
                    setDescription(a.description);
                    setPriority(a.severity === 'high' ? 'high' : 'medium');
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              >
                <option value="">-- Standalone Case (No Direct Alert) --</option>
                {alerts.map((a) => (
                  <option key={a.id} value={a.id}>
                    ALERT #{a.id} - {a.alert_type} (${parseFloat(a.transaction_amount || 0).toLocaleString()} {a.transaction_currency}) [{a.status}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Dossier Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unexplained High Velocity Rapid Wire Layering"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Investigation Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white capitalize"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority (Urgent AML Report)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Dossier Overview / Hypothesis</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail suspicious account behaviors, suspected structuring, or related counterparties..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 text-white font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {creating ? 'Registering Case...' : 'Open Case Dossier'}
            </button>
          </form>
        </div>
      )}

      {/* View 3: Case Detail */}
      {activeView === 'detail' && caseDetail && (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-cyan-400 font-bold text-xs">CASE-#{caseDetail.id}</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded border ${
                      caseDetail.priority === 'high'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {caseDetail.priority}
                  </span>
                  <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded ${
                    caseDetail.status === 'closed' ? 'bg-slate-800 text-slate-400' : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                  }`}>
                    {caseDetail.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">{caseDetail.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{caseDetail.description}</p>
              </div>

              {/* Status Update Controls */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {caseDetail.status !== 'submitted_for_review' && caseDetail.status !== 'under_compliance_review' && (
                  <button
                    onClick={async () => {
                      const days = prompt('Enter Compliance Review SLA Deadline (days):', '7');
                      if (days !== null) {
                        try {
                          await complianceService.submitCase(caseDetail.id, {
                            deadline_days: parseInt(days) || 7,
                            notes: 'Submitted from Investigator Case Dossier view.',
                          });
                          alert('Case successfully submitted for formal Compliance Review!');
                          handleOpenDetail(caseDetail.id);
                          loadCases();
                        } catch (err) {
                          alert(err.response?.data?.message || err.response?.data?.error || 'Failed to submit case for compliance review.');
                        }
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 font-bold"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Submit for Compliance Review
                  </button>
                )}

                {caseDetail.status === 'closed' ? (
                  <button
                    onClick={() => handleUpdateStatus('open')}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reopen Case Dossier
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleUpdateStatus('in_progress')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    >
                      In Progress
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('escalated')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    >
                      Escalate
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('closed')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    >
                      Close Case
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Linked Alert & Transaction Context */}
            {caseDetail.alert_id && (
              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Trigger Alert</span>
                  <span className="font-semibold text-white">ALERT #{caseDetail.alert_id} ({caseDetail.alert_severity})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Surveillance Amount</span>
                  <span className="font-semibold text-emerald-400">${parseFloat(caseDetail.transaction_amount || 0).toLocaleString()} {caseDetail.transaction_currency}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Channel / Route</span>
                  <span className="text-slate-300">{caseDetail.from_account} &rarr; {caseDetail.to_account}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-sans">Assignee</span>
                  <span className="font-semibold text-cyan-300">{caseDetail.assignee_first_name ? `${caseDetail.assignee_first_name} ${caseDetail.assignee_last_name}` : 'Unassigned'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Notes Section */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="text-sm font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                Investigator Notes ({caseDetail.notes?.length || 0})
              </h4>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {caseDetail.notes?.map((n) => (
                  <div key={n.id} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mb-1">
                      <span className="text-cyan-400 font-semibold">{n.first_name} {n.last_name} ({n.role})</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-200">{n.note_text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Record an intelligence finding or note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  disabled={submittingNote || !newNote.trim()}
                  className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Audit History Timeline */}
            <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="text-sm font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Case Audit Timeline
              </h4>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 font-mono text-xs">
                {caseDetail.history?.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium font-sans text-xs">{h.action}</p>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        By {h.first_name} {h.last_name} • {new Date(h.changed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseManagement;
