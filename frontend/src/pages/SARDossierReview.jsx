import React, { useState, useEffect } from 'react';
import { complianceService, reportService } from '../services/api';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  AlertTriangle,
  History,
  FileText,
  Clock,
  ShieldCheck,
  Search,
  ExternalLink
} from 'lucide-react';

const SARDossierReview = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'approve', 'return', 'reject'
  const [filterStatus, setFilterStatus] = useState('all');
  const [feedback, setFeedback] = useState({ text: '', type: '' });
  // Prevent double-click and track download state
  const [downloadingExport, setDownloadingExport] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await complianceService.getReports({ status: filterStatus });
      setReports(data.reports || []);
      if (data.reports?.length > 0 && !selectedReport) {
        setSelectedReport(data.reports[0]);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ text: 'Failed to load compliance reports.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filterStatus]);

  const handleDecision = async (statusDecision) => {
    if (!selectedReport) return;
    try {
      setActionLoading(true);
      setFeedback({ text: '', type: '' });

      const res = await complianceService.makeReportDecision(selectedReport.id, {
        decision: statusDecision,
        comments: decisionNotes,
      });

      setFeedback({ text: res.message || 'Report review decision recorded.', type: 'success' });
      setActiveModal(null);
      setDecisionNotes('');
      await fetchReports();
    } catch (err) {
      console.error(err);
      setFeedback({ text: err.response?.data?.error || 'Failed to submit report decision.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedReport || downloadingExport) return;
    try {
      setDownloadingExport(true);
      setFeedback({ text: '', type: '' });
      const safeTitle = (selectedReport.title || `sar-dossier-${selectedReport.id}`)
        .replace(/[^a-z0-9\-_. ]/gi, '_')
        .trim();
      await reportService.downloadExport(selectedReport.id, `${safeTitle}.html`);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.status === 401
        ? 'Your session has expired. Please log in again.'
        : err?.response?.status === 403
        ? 'You do not have permission to download this report.'
        : err?.message || 'Failed to download report.';
      setFeedback({ text: msg, type: 'error' });
    } finally {
      setDownloadingExport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="w-6 h-6 text-cyan-400" />
            SAR & Dossier Validation Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official regulatory reporting review, version tracking, sign-offs, and compliance return workflows.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Dossier Statuses</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="draft">Drafts</option>
            <option value="approved">Approved Dossiers</option>
            <option value="returned">Returned for Correction</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {feedback.text && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Main Grid: Reports List (4 cols) & Detail/Review (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Reports Navigation Roster */}
        <div className="lg:col-span-4 rounded-2xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-mono uppercase text-slate-400">Dossiers Roster ({reports.length})</span>
            <button onClick={fetchReports} className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300">
              Refresh
            </button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">Loading dossiers...</div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">No dossiers found.</div>
            ) : (
              reports.map((rep) => {
                const isSelected = selectedReport?.id === rep.id;
                const statusColor =
                  rep.review_status === 'approved'
                    ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30'
                    : rep.review_status === 'returned'
                    ? 'text-amber-400 bg-amber-500/20 border-amber-500/30'
                    : rep.review_status === 'rejected'
                    ? 'text-red-400 bg-red-500/20 border-red-500/30'
                    : 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';

                return (
                  <button
                    key={rep.id}
                    onClick={() => setSelectedReport(rep)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-500">
                        {rep.is_official_sar ? 'FINCEN SAR' : 'DOSSIER'} #{rep.id}
                      </span>
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${statusColor}`}>
                        {rep.review_status || 'draft'}
                      </span>
                    </div>

                    <h4 className="font-semibold text-xs text-slate-200 mt-1 truncate">{rep.title}</h4>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono">
                      <span className="text-slate-400">Case #{rep.case_id}</span>
                      <span className="text-slate-500">v{rep.version || 1}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Report Inspection & Decision Deck */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedReport ? (
            <div className="p-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 font-mono">
              Select a SAR dossier to inspect documentation and record compliance review sign-offs.
            </div>
          ) : (
            <>
              {/* Dossier Header */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono uppercase font-bold">
                        {selectedReport.is_official_sar ? 'OFFICIAL SAR FILING' : 'CASE COMPLIANCE DOSSIER'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                        Version {selectedReport.version || 1}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                        Case #{selectedReport.case_id}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white mt-2">{selectedReport.title}</h2>
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={downloadingExport}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono inline-flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-wait"
                  >
                    <Download className={`w-3.5 h-3.5 ${downloadingExport ? 'animate-bounce' : ''}`} />
                    <span>{downloadingExport ? 'Downloading...' : 'Export / Print PDF'}</span>
                  </button>
                </div>

                {/* Review status strip */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 uppercase">Review Status: </span>
                    <span className="font-bold text-white uppercase">{selectedReport.review_status || 'draft'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase">Generated By: </span>
                    <span className="text-slate-300">{selectedReport.author_name || 'System Operator'}</span>
                  </div>
                  {selectedReport.reviewed_by_name && (
                    <div>
                      <span className="text-slate-500 uppercase">Audited By: </span>
                      <span className="text-cyan-400 font-semibold">{selectedReport.reviewed_by_name}</span>
                    </div>
                  )}
                </div>

                {/* Return comments if any */}
                {selectedReport.review_comments && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                    <span className="font-bold font-mono uppercase text-[10px] block">
                      Prior Review Audit Feedback:
                    </span>
                    <p className="text-slate-200">{selectedReport.review_comments}</p>
                  </div>
                )}
              </div>

              {/* Dossier Body Content View */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Report Narrative & Case Synthesis
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">Official Filing Record</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[350px] overflow-y-auto">
                  {renderNarrative(selectedReport)}
                </div>
              </div>

              {/* Compliance Adjudication Action Box */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Compliance Officer Decision Action</h3>
                  </div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    Regulatory Attestation
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Approved reports lock this version for external regulatory submission. Returned reports prompt the investigator to revise specific findings.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => setActiveModal('approved')}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve SAR Dossier</span>
                  </button>

                  <button
                    onClick={() => setActiveModal('returned')}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Return for Correction</span>
                  </button>

                  <button
                    onClick={() => setActiveModal('rejected')}
                    disabled={actionLoading}
                    className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-mono text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Filing</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Decision Comment Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white capitalize flex items-center gap-2">
                {activeModal === 'approved' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {activeModal === 'returned' && <RotateCcw className="w-5 h-5 text-amber-400" />}
                {activeModal === 'rejected' && <XCircle className="w-5 h-5 text-rose-400" />}
                Decision: {activeModal}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white text-xs font-mono">
                Cancel
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-slate-300">
                Compliance Officer Attestation & Review Notes *
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={
                  activeModal === 'returned'
                    ? 'Explain required evidence or documentation corrections...'
                    : 'Provide justification and compliance audit sign-off...'
                }
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
                onClick={() => handleDecision(activeModal)}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-50 ${
                  activeModal === 'approved'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                    : activeModal === 'returned'
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'bg-rose-600 text-white hover:bg-rose-500'
                }`}
              >
                {actionLoading ? 'Recording Sign-Off...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SARDossierReview;
