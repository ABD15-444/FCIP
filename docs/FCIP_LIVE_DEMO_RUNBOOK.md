# Financial Crime Intelligence Platform (FCIP) — College Live Demonstration Runbook

**Audience:** Academic Evaluation Committee / Presentation Panel  
**Platform Version:** FCIP v2.4.0 (Full Enterprise Architecture)  
**Database:** PostgreSQL 18 (`fcip_db`)  
**Backend:** Node.js / Express (Port 5000)  
**Frontend:** React / Vite / Tailwind CSS (Port 5173)  
**Demonstration Mode:** Isolated Synthetic Dataset (10 Entities, 18 Transactions, 6 Distinct Governance Cases)  

---

## 1. Quick Start Commands

### 1.1. Start Database Service
```powershell
# Verify PostgreSQL 18 service status
Get-Service postgresql*

# If not running, start service
Start-Service postgresql-x64-18
```

### 1.2. Reset and Reseed Demo Dataset (Idempotent)
Run the automated safety-checked reset command from the root directory:
```powershell
npm run demo:reset
```
*Creates 10 synthetic entities, 10 accounts, 18 calibrated transactions, triggers the detection engine, seeds 6 lifecycle cases, 2 SAR dossiers, and 8 baseline audit events.*

### 1.3. Start Backend & Frontend Servers
In two separate terminal windows:
```powershell
# Terminal 1 — Backend API
npm run dev:backend

# Terminal 2 — Frontend UI
npm run dev:frontend
```
- Open Frontend: **`http://localhost:5173`**
- API Health Check: **`http://localhost:5000/api/health`**

---

## 2. Demonstration User Accounts & Credentials

All demo accounts use the standard demo credential: `Password123!`

| Role | Name | Email (Username) | Default Password | Primary Workspace / Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Investigator** | Abraham David | `test.investigator@fcip.agency` | `Password123!` | Operational intelligence, alert triage, transaction graph flow, case dossiers, compliance referral. |
| **Compliance Officer** | Arahat Gaikwad | `test.compliance@fcip.agency` | `Password123!` | Oversight telemetry, intake review queue, adjudication (Accept / Return / Escalate), SAR validation hub, risk oversight matrix, immutable audit ledger. |
| **Administrator** | Admin Supervisor | `admin@fcip.agency` | `Password123!` | System operations, user directory & RBAC matrix, AML rule calibration, data vault, diagnostic health ping. |
| **Administrator** | Roshan Bilal | `test.adminstrator@fcip.agency` | `Password123!` | Secondary admin account. |

---

## 3. Recommended Live Presentation Sequence

### Act 1 — The Investigator Workflow (Operational Detection & Case Creation)
**Goal:** Show how an investigator detects suspicious patterns, inspects graph relationships, documents findings, and submits a case to compliance.

1. **Login:** Log in as `test.investigator@fcip.agency` / `Password123!`.
2. **Dashboard Overview:** Point out real surveillance telemetry (18 Transactions, 18 Triaged Alerts, High-Risk Volume).
3. **Suspicious Alerts:**
   - Navigate to **Suspicious Alerts** in the left sidebar.
   - Show how the rule engine flagged **High Frequency Rapid Velocity** (4 transfers within 8 minutes from Kasper Thorne) and **Exorbitant Transaction Amount** ($75,000 EUR wire).
4. **Interactive Network Graph Flow (Phase 5):**
   - Click **Network Graph Flow** in the sidebar.
   - Select **Pivot Account:** `ACC-1001-VORTEX`.
   - Click **Highlight Circular Loops**: Show the glowing red 3-hop loop between `ACC-1001-VORTEX` &rarr; `ACC-1002-APEX` &rarr; `ACC-1006-BEACON` &rarr; `ACC-1001-VORTEX`.
   - Click any node or edge to show the live inspector card with amount and composite risk scores.
5. **Live Schema Architecture (ERD View):**
   - In the Network Graph header, click the toggle button: **Database Schema (ERD)**.
   - Show the panel of live PostgreSQL schema cards (`customers`, `accounts`, `transactions`, `alerts`, `cases`, `reports`, `audit_logs`).
   - Click **Refresh Counts** to prove real database communication.
6. **Live Case Submission:**
   - Navigate to **Case Dossiers** in sidebar.
   - Click on **`Case #1: Investigation: Rapid Structuring Velocity Burst`** (Status: `in_progress`).
   - Show the linked alert and investigative timeline.
   - In the action bar, click **Submit for Compliance Review**.
   - Enter SLA deadline: `7` days.
   - Confirm the success popup! Notice the case immediately updates to `submitted_for_review`.
7. **Logout** from Investigator.

---

### Act 2 — The Compliance Officer Workflow (Adjudication & Governance)
**Goal:** Show how the compliance officer reviews investigator referrals, enforces SLAs, makes independent determinations, and exports regulatory reports.

1. **Login:** Log in as `test.compliance@fcip.agency` / `Password123!`.
2. **Compliance Dashboard:**
   - Show the live oversight telemetry tiles:
     - **Awaiting Cases:** Real-time count of submitted investigations.
     - **Pending SARs:** Regulatory dossiers awaiting sign-off.
     - **Overdue Reviews:** Highlight the red badge showing **1 Overdue Item**.
3. **Intake Review Queue:**
   - Navigate to **Review Queue**.
   - Show **Case #1** (the case just submitted in Act 1) now present at the top of the queue.
   - Point out **Case #5** (`Unregistered Offshore Liquidity Pool`), which displays a red **Overdue SLA Warning** because its statutory deadline elapsed 2 days ago.
4. **Adjudication Suite (Case Reviews):**
   - Click **Case Reviews** in sidebar.
   - Select **`Case #2: Investigation: Swiss-Dubai Circular Laundering Syndicate`**.
   - Show the loaded dossier, transaction amounts ($25k, $24k), linked circular alert, and investigator timeline.
   - Click **Accept Case**: Case transitions to `compliance_accepted` and prompts SAR compilation.
   - Select **`Case #4: Maritime Freight Invoice Discrepancy`** (Status: `returned_for_correction`):
     - Show the mandatory feedback: *"Investigator must attach bill of lading and export customs declaration before compliance board sign-off."*
5. **SAR & Dossier Validation Hub:**
   - Click **SAR & Dossier Review** in sidebar.
   - Select **`SAR Report #1: Formal Structuring & Layering Dossier`** (Status: `approved`).
   - Point out the **Report Narrative & Case Synthesis** box showing executive summary, corroborating alerts, and transaction details.
   - Click **Download Dossier (PDF/HTML)**: Notice the instant, authenticated download of the printable regulatory report!
6. **Compliance Risk Oversight & Quality Assurance:**
   - Click **Compliance Risk Oversight** in sidebar.
   - Show the **Detection Rules Efficacy & Calibration Matrix** table displaying all 4 active AML rules with their condition types, severity badges, and triggered alert counts.
7. **Audit History (Immutable Security Ledger):**
   - Click **Audit History** in sidebar.
   - Show the chronological ledger recording every action taken: logins, case creation, compliance referral, acceptances, returns, and report downloads.
8. **Logout** from Compliance Officer.

---

### Act 3 — The Administrator Workflow (Platform Operations)
**Goal:** Show security administration, role-based user management, and dynamic rule calibrations.

1. **Login:** Log in as `admin@fcip.agency` / `Password123!`.
2. **Admin Dashboard:** Review platform metrics (Active Users, Transactions Scanned, Storage Health).
3. **User Management:** Show role directory (`investigator`, `compliance_officer`, `admin`) with user creation modal.
4. **Roles & Permissions Matrix:** Demonstrate visual RBAC policy matrix across operational domains.
5. **Detection Configuration:** View and adjust threshold calibrations on the 4 canonical rules.
6. **System Health:** Run live diagnostic database latency ping (returns 0–1ms).

---

## 4. Synthetic Scenarios Reference Table

| Scenario # | Focus | Involved Entities & Accounts | Triggered Heuristics | Associated Case |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Circular Laundering Loop** | Vortex Global (`ACC-1001`), Apex Horizon (`ACC-1002`), Beacon FZE (`ACC-1006`) | `Circular Transaction Rule`, `Suspicious Round Number Flow` ($25k, $24.5k, $24k) | Case #2 (`submitted_for_review`) |
| **2** | **Exorbitant Wire Transfer** | Dr. Julian Sterling (`ACC-1003`), Aura Digital (`ACC-1008`) | `Large Amount Rule` (> $10k), threshold exceeded ($75,000 EUR) | Case #3 (`under_compliance_review`) |
| **3** | **Rapid Structuring Velocity** | Kasper Thorne (`ACC-1005`) to Vance, Cruz, & Zhang | `Rapid Transfer Rule` (> 3 transfers within 10-minute window) | Case #1 (`in_progress` &rarr; live demo submission) |
| **4** | **Round Number Denominations** | Solomon Cruz (`ACC-1007`) to Seraphina Zhang (`ACC-1009`) | `Suspicious Round Number Flow` ($10,000.00 & $15,000.00 USD) | Case #4 (`returned_for_correction`) |
| **5** | **Overdue Review SLA** | Unregistered Offshore Liquidity Pool | Statutory deadline elapsed 2 days ago | Case #5 (`submitted_for_review` [Overdue]) |
| **6** | **Benign Operational Baseline** | Vance, Cruz, Nautical Prime, Aura Digital | Normal amounts ($120.00, $345.50, $890.25). Zero alerts triggered. | Control baseline |

---

## 5. Troubleshooting & Demo Recovery

### If You Need to Reset Data Right Before the Presentation
Run:
```powershell
npm run demo:reset
```
This takes under 3 seconds, leaves no duplicate records, restarts ID sequences, and restores all 6 demo cases to their exact presentation starting states.

### If Port 5000 or 5173 is Busy or Not Responding
```powershell
# Check listening processes
Get-NetTCPConnection -LocalPort 5000, 5173 -State Listen

# Kill orphaned Node processes if necessary
Stop-Process -Name node -Force

# Restart backend and frontend
npm run dev:backend
npm run dev:frontend
```

### If You Need to Restore the Pre-Reset Database Backup
A complete SQL dump was saved before changes were made:
- File: `backend/backups/fcip_db_pre_demo_backup_latest.sql`
To restore:
```powershell
psql -U postgres -d fcip_db -f "backend/backups/fcip_db_pre_demo_backup_latest.sql"
```

---

## 6. Verification Evidence Summary

- **Master Audit Suite:** 29 / 29 Tests Passed (`npm run test:master`)
- **Compliance Review Suite:** 7 / 7 Tests Passed (`npm run test:compliance`)
- **Report Download & Auth Suite:** 7 / 7 Tests Passed (`npm run test:download`)
- **Frontend Build:** Compiled with 0 errors (`npm run build:frontend`)
