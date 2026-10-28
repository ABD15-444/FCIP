import React, { useState, useEffect } from 'react';
import { complianceService, caseService } from '../services/api';
import {
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Flame,
  Clock,
  Shield,
  FileText,
  User,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

const CaseReviews = ({ initialCaseId, onBack }) => {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId || null);
  const [caseDetails, setCaseDetails] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'accept', 'return', 'escalate'
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });

  // Load cases eligible for compliance review
  const loadReviewCases = async () => {
    try {
      setLoadingList(true);
      const res = await caseService.getCases();
      const list = Array.isArray(res) ? res : (res?.cases || res?.data || []);
      const reviewable = list.filter((c) =>
        ['submitted_for_review', 'under_compliance_review', 'returned_for_correction', 'compliance_accepted', 'escalated'].includes(c.status)
      );
      const targetList = reviewable.length > 0 ? reviewable : list;
      setCases(targetList);

      setSelectedCaseId(prev => {
        if (prev && targetList.some(c => c.id === prev)) return prev;
        if (initialCaseId && targetList.some(c => c.id === initialCaseId)) return initialCaseId;
        return targetList.length > 0 ? targetList[0].id : null;
      });
    } catch (err) {
      console.error('Error loading review cases:', err);
      setFeedbackMsg({ text: err.response?.data?.message || 'Failed to retrieve cases for compliance roster.', type: 'error' });
    } finally {
      setLoadingList(false);
    }
  };

  // Fetch full details of selected case
  const loadCaseDetail = async (id) => {
    if (!id) return;
    try {
      setLoadingDetail(true);
      setFeedbackMsg({ text: '', type: '' });
      const res = await caseService.getCaseDetail(id);
      const detail = res.case || res.data || res;
      setCaseDetails(detail);
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ text: err.response?.data?.message || 'Failed to load case dossier.', type: 'error' });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadReviewCases();
  }, []);

  useEffect(() => {
    if (initialCaseId) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialCaseId]);

  useEffect(() => {
    if (selectedCaseId) {
      loadCaseDetail(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleDecision = async (actionType) => {
    try {
      setActionLoading(true);
      setFeedbackMsg({ text: '', type: '' });

      const payload = {
        action: actionType,
        comments: actionNotes,
        return_reason: actionType === 'RETURN_FOR_CORRECTION' ? returnReason : undefined,
      };

      const res = await complianceService.makeCaseDecision(selectedCaseId, payload);
      setFeedbackMsg({ text: res.message || 'Action executed successfully.', type: 'success' });
      setActiveModal(null);
      setActionNotes('');
      setReturnReason('');

      // Refresh data
      await loadCaseDetail(selectedCaseId);
      await loadReviewCases();
    } catch (err) {
      console.error(err);
      setFeedbackMsg({ text: err.response?.data?.error || 'Failed to submit decision.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const startReviewSession = async () => {
    await handleDecision('START_REVIEW');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-cyan-400" />
              Compliance Case Review & Adjudication
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Independent evaluation of investigator findings, alert corroboration, and evidence integrity.
            </p>
          </div>
        </div>
      </div>

      {feedbackMsg.text && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Case Navigator (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-mono uppercase text-slate-400">Review Roster ({cases.length})</span>
            <button
              onClick={loadReviewCases}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {loadingList ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">Loading cases...</div>
            ) : cases.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">No cases found.</div>
            ) : (
              cases.map((c) => {
                const isSelected = c.id === selectedCaseId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-500">CASE #{c.id}</span>
                      <span
                        className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                          c.priority === 'critical'
                            ? 'bg-red-500/20 text-red-400'
                            : c.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {c.priority}
                      </span>
                    </div>

                    <h4 className="font-semibold text-xs text-slate-200 mt-1 truncate">{c.title}</h4>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono">
                      <span className="text-slate-400 uppercase">{c.status.replace(/_/g, ' ')}</span>
                      <span className="text-cyan-400">{c.alert_count || 0} Alerts</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Case Dossier & Adjudication Controls (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {loadingDetail ? (
            <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 font-mono">
              Loading dossier records...
            </div>
          ) : !caseDetails ? (
            <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 font-mono">
              Select a case from the roster to inspect and adjudicate.
            </div>
          ) : (
            <>
              {/* Dossier Header & Overview */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono uppercase font-bold">
                        Case #{caseDetails.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                        Status: {caseDetails.status.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono uppercase font-bold">
                        Priority: {caseDetails.priority}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white mt-2">{caseDetails.title}</h2>
                  </div>

                  {/* Submission & Review Meta */}
                  <div className="text-right text-xs font-mono text-slate-400 space-y-1">
                    <div>
                      Submitting Agent:{' '}
                      <span className="text-slate-200 font-medium">
                        {caseDetails.investigator_name || 'Assigned Agent'}
                      </span>
                    </div>
                    {caseDetails.review_deadline && (
                      <div>
                        Review SLA:{' '}
                        <span className="text-cyan-400 font-bold">
                          {new Date(caseDetails.review_deadline).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Return Reason Warning Banner if returned previously */}
                {caseDetails.return_reason && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 font-mono uppercase">
                      <RotateCcw className="w-3.5 h-3.5" /> Previous Return Feedback:
                    </div>
                    <p>{caseDetails.return_reason}</p>
                  </div>
                )}

                {/* Case Narrative */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                  <span className="text-slate-400 font-mono uppercase text-[10px]">
                    Investigator Summary & Case Narrative
                  </span>
                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {caseDetails.description || 'No detailed investigator narrative attached.'}
                  </p>
                </div>
              </div>

              {/* Linked Alerts & Evidence Section */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Corroborating Suspicious Alerts ({caseDetails.alerts?.length || 0})
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">Read-Only Evidence Vault</span>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                  {!caseDetails.alerts || caseDetails.alerts.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-mono">
                      No specific alerts linked directly to this case file.
                    </div>
                  ) : (
                    caseDetails.alerts.map((al) => (
                      <div
                        key={al.id}
                        className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-cyan-400 font-bold">ALERT #{al.id}</span>
                            <span className="font-medium text-slate-200">{al.rule_name}</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">{al.description}</p>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 pt-1">
                            <span>Amount: ${Number(al.amount || 0).toLocaleString()}</span>
                            <span>Score: {al.severity_score || al.risk_score || 0}</span>
                            <span>Date: {new Date(al.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold whitespace-nowrap ${
                            al.severity === 'critical'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {al.severity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Compliance Adjudication Action Panel (Section 6 Requirements) */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Compliance Officer Adjudication Decision</h3>
                  </div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    Mandatory Audit Recorded
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Select an adjudication outcome. Formal reasons and audit notes are permanently signed to the compliance review history.
                </p>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  {caseDetails.status === 'submitted_for_review' && (
                    <button
                      onClick={startReviewSession}
                      disabled={actionLoading}
                      className="px-3 py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Start Review</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveModal('accept')}
                    disabled={actionLoading}
                    className="px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept Case</span>
                  </button>

                  <button
                    onClick={() => setActiveModal('return')}
                    disabled={actionLoading}
                    className="px-3 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return for Correction</span>
                  </button>

                  <button
                    onClick={() => setActiveModal('escalate')}
                    disabled={actionLoading}
                    className="px-3 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Escalate Case</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Decision Modal: Accept / Return / Escalate */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white capitalize flex items-center gap-2">
                {activeModal === 'accept' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {activeModal === 'return' && <RotateCcw className="w-5 h-5 text-amber-400" />}
                {activeModal === 'escalate' && <Flame className="w-5 h-5 text-rose-400" />}
                {activeModal === 'accept' && 'Accept Case for Filing'}
                {activeModal === 'return' && 'Return Case for Correction'}
                {activeModal === 'escalate' && 'Escalate Case to Legal / MLRO'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
            </div>

            {activeModal === 'return' && (
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-slate-300">
                  Required Return Reason (Visible to Investigator) *
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Specify missing transactional documents, uncorroborated alerts, or flawed assumptions..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-slate-300">
                Compliance Review Findings & Decision Notes *
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Enter independent compliance notes and rationale..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleDecision(
                    activeModal === 'accept'
                      ? 'ACCEPT_CASE'
                      : activeModal === 'return'
                      ? 'RETURN_FOR_CORRECTION'
                      : 'ESCALATE'
                  )
                }
                disabled={actionLoading || (activeModal === 'return' && !returnReason.trim())}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-50 ${
                  activeModal === 'accept'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : activeModal === 'return'
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'bg-rose-600 text-white hover:bg-rose-500'
                }`}
              >
                {actionLoading ? 'Recording...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseReviews;
