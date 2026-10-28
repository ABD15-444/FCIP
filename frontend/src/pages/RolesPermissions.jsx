import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Lock,
  UserCheck,
  FileText,
  Sliders,
  Database,
  Briefcase
} from 'lucide-react';

const RolesPermissions = () => {
  const roles = [
    {
      id: 'admin',
      name: 'Administrator',
      badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
      description: 'System master authorization: provisions users, modifies detection rules, views audit ledger, monitors system infrastructure.',
      permissions: [
        { resource: 'User Management', level: 'Full Access (Create, Edit, Deactivate, Reset PW)', allowed: true },
        { resource: 'Detection Rules Configuration', level: 'Full Access (Tune Thresholds & Calibration)', allowed: true },
        { resource: 'Security Audit Ledger', level: 'Full Access (View Immutable Logs)', allowed: true },
        { resource: 'System Health & Metrics', level: 'Full Access (Hardware & Latency Telemetry)', allowed: true },
        { resource: 'Data Vault & CSV Ingest', level: 'Full Ingest & Batch Quality Oversight', allowed: true },
        { resource: 'Investigation Dossiers', level: 'Read-Only Administrative Oversight', allowed: true },
        { resource: 'Official SAR Generation', level: 'Authorized Approval & Audit Review', allowed: true },
      ],
    },
    {
      id: 'investigator',
      name: 'Investigator',
      badgeClass: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
      description: 'Core intelligence operator: triages suspicious alerts, evaluates financial transactions, traces money flows, and compiles dossiers.',
      permissions: [
        { resource: 'Suspicious Alerts System', level: 'Full Triage (Acknowledge, Escalate, Close)', allowed: true },
        { resource: 'Case Dossiers & Evidence', level: 'Full Case Management & Intelligence Notes', allowed: true },
        { resource: 'Network Graph Topology', level: 'Interactive Multi-Hop Fund Flow Tracing', allowed: true },
        { resource: 'Transaction Evaluation', level: 'On-demand Risk Scoring & Factor Inspection', allowed: true },
        { resource: 'Financial Data Vault', level: 'Upload Datasets & Search Ledger Records', allowed: true },
        { resource: 'User & Role Administration', level: 'Restricted (Admin Required)', allowed: false },
        { resource: 'System Audit Ledger', level: 'Restricted (Admin Required)', allowed: false },
        { resource: 'Detection Rule Thresholds', level: 'View Heuristics Only (No Editing)', allowed: false },
      ],
    },
    {
      id: 'compliance_officer',
      name: 'Compliance Officer',
      badgeClass: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
      description: 'Regulatory oversight: reviews case dossier findings, verifies risk factor evidence, and compiles official Suspicious Activity Reports (SAR).',
      permissions: [
        { resource: 'Compliance Dossiers & SAR', level: 'Full Compilation & PDF Export', allowed: true },
        { resource: 'Case Dossiers Review', level: 'Read & Append Compliance Findings', allowed: true },
        { resource: 'Alerts Surveillance', level: 'Read-Only Regulatory Inspection', allowed: true },
        { resource: 'Detection Heuristics', level: 'View Rule Policies & Threshold Semantics', allowed: true },
        { resource: 'Network Topology Flow', level: 'Read-Only Evidence Verification', allowed: true },
        { resource: 'User & Role Administration', level: 'Restricted (Admin Required)', allowed: false },
        { resource: 'Rule Configuration Editing', level: 'Restricted (Admin Required)', allowed: false },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>Security Clearance & Access Control Matrix</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            Phase 5 RBAC
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Enforced by backend token verification and route middleware (`authorizeRoles`). Least-privilege separation of duties.
        </p>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded ${role.badgeClass}`}>
                  {role.name}
                </span>
                <span className="text-xs font-mono text-slate-500">{role.id}</span>
              </div>

              <p className="text-xs text-slate-300 mb-6 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                {role.description}
              </p>

              <div className="space-y-3">
                <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Permissions & Capabilities
                </h4>
                <div className="space-y-2">
                  {role.permissions.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-start gap-2.5 text-xs"
                    >
                      {p.allowed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className={`font-semibold ${p.allowed ? 'text-white' : 'text-slate-500'}`}>
                          {p.resource}
                        </div>
                        <div className={`text-[11px] ${p.allowed ? 'text-slate-400' : 'text-slate-600'}`}>
                          {p.level}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>Policy: Strict RBAC</span>
              <span>Enforced: API Middleware</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RolesPermissions;

