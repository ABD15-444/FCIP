# Financial Crime Intelligence Platform (FCIP) 🛡️💼

An enterprise-grade Anti-Money Laundering (AML), Counter-Terrorist Financing (CFT), and Financial Crime Surveillance web application built with a modern React.js frontend, Node.js + Express backend, and a high-performance PostgreSQL relational database.

[![Repository](https://img.shields.io/badge/GitHub-FCIP-blue?style=flat-square&logo=github)](https://github.com/ABD15-444/FCIP.git)
[![Node](https://img.shields.io/badge/Node.js-v18%2B-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-cyan?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

---

## 🌟 Key Capabilities & Architecture

FCIP provides role-separated operational and governance workspaces:

### 1. Dedicated Role-Based Workspaces & RBAC
- **Investigator Workspace (`investigator`)**:
  - Operational alerts triage, transaction investigation, fund flow tracing, case management.
  - Case submission to compliance review with SLA deadlines.
- **Administrator Console (`admin`)**:
  - User Directory and account lifecycle management (create, update, reset password, status toggle).
  - RBAC Policy Matrix with granular role permissions.
  - Detection Configuration and threshold calibrations with historical change logs.
  - Data Administration and dataset ingest vault tracking.
  - System Health telemetry (database latency, connection pool, memory metrics).
  - System-wide immutable Audit Trail Logs with action/user/date filtering and export.
- **Compliance Officer Workspace (`compliance_officer`)**:
  - **Compliance Dashboard**: Workload statistics, SLA deadlines, pending high-priority reviews, review velocity.
  - **Review Queue**: Filterable intake list for cases and dossiers awaiting compliance action.
  - **Case Reviews**: Adjudication suite (`START_REVIEW`, `ACCEPT_CASE`, `RETURN_FOR_CORRECTION`, `ESCALATE`) with feedback notes.
  - **SAR & Dossier Review**: Regulatory filing review, version tracking, and sign-offs (`approved`, `returned`, `rejected`).
  - **Compliance Risk Oversight**: High-exposure cases, documentation quality assurance (e.g. uncorroborated alerts), rule frequency.
  - **Compliance Reports**: Approval vs. return rate diagnostics, turnaround telemetry, disposition distribution.
  - **Audit History**: Immutable audit history of all compliance decisions and reviews.

### 2. Financial Data Management & CSV Ingestion
- High-throughput CSV parsing feed (`POST /api/upload`) utilizing `multer` and stream pipes.
- Relational schema managing customer dossiers, bank accounts, and transactional ledgers.
- Interactive transaction ledger with instantaneous date ranges, monetary bounds, and account search filters.

### 3. Detection Engine & Risk Scoring Matrix
- Heuristic automated detection engine:
  - **Large Amount Rule**: Detects transactions breaching high-value thresholds ($10,000+).
  - **Rapid Transfer Rule**: Detects velocity bursts (> 3 transactions sent within 10 minutes).
  - **Circular Transaction Rule**: Recursive Common Table Expression (CTE) tracing money loops returning to the origin sender within 5 hops.
- Dynamic Risk Scoring algorithm evaluating composite risks (0–100) classified into `Low`, `Medium`, and `High` tiers.

### 4. Automated Alerts System
- Real-time triaging of automated rule matches with color-coded severity badges (`High`, `Medium`, `Low`).
- Detailed modal inspection explaining matched rule heuristics, underlying transactions, and factor breakdown.
- Immediate alert lifecycle management (`open`, `acknowledged`, `closed`) and direct escalation into formal case dossiers.

### 5. Network Graph & Multi-Hop Money Flow
- Interactive canvas topology visualizing accounts, counterparties, and directional fund transfers.
- Multi-hop recursive path tracing highlighting intermediary flow routes and capital dispersion hops.
- Node styling reflecting live risk scores and edge weight scaling dynamically by transaction volume.

### 6. Case Dossier & Evidence Management
- Formal case tracking supporting priority categorization (`low`, `medium`, `high`) and statuses (`open`, `in_progress`, `submitted_for_review`, `under_compliance_review`, `returned_for_correction`, `compliance_accepted`, `escalated`, `closed`).
- Collaborative investigator intelligence notes feed.
- Chronological immutable case audit timeline tracking every investigator assignment, note, and status change.
- **Compliance Review Submission**: Investigators can submit completed cases with an SLA deadline for formal compliance review.

### 7. Dashboard Analytics & Authenticated Printable SAR Reports
- Executive telemetry cards: Total Transactions, Flagged Volumes, Open Alerts, Active Cases, and High-Risk Entities.
- Risk distribution tier charts and chronological transaction volume tracking with date-range filters.
- **Authenticated PDF/HTML Dossier Export**:
  - Secure binary blob download using JWT Bearer authentication headers.
  - Comprehensive report view with printable styling (`@page { size: A4; }`) and instant print-to-PDF export.
  - Full case narrative, matched detection rules, transaction records, risk scores, and chain of custody.

### 8. Immutable Security Audit Trail
- Automated middleware recording user authentication, case updates, compliance adjudications, rule calibrations, and dataset imports.
- Search, filter, and review capabilities with pagination and JSON/CSV export.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Axios.
- **Backend**: Node.js, Express.js, PostgreSQL (`pg` connection pool), Multer, CSV-Parser, JSON Web Tokens (`jsonwebtoken`), Bcrypt.
- **Database**: PostgreSQL with indexing on emails, roles, account numbers, and transaction dates.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher) running locally on port `5432`
- [Git](https://git-scm.com/)

---

### 1. Clone the Repository
```bash
git clone https://github.com/ABD15-444/FCIP.git
cd FCIP
```

---

### 2. Backend Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables in `.env` (refer to `.env.example`):
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_NAME=fcip_db
   JWT_SECRET=your_super_secret_jwt_key
   JWT_EXPIRES_IN=24h
   ```
4. Create the PostgreSQL database:
   ```sql
   CREATE DATABASE fcip_db;
   ```
5. Start the backend server (all core tables, migrations, compliance schemas, and detection rules initialize automatically):
   ```bash
   npm start
   ```
   *Backend running at `http://localhost:5000`.*
   *Health Check endpoint: `http://localhost:5000/api/health`.*

---

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   *Frontend running at `http://localhost:5173` (with `/api` proxied to backend port 5000).*

---

### 4. Default Seed Accounts for Testing

Once initialized, test accounts can be registered or accessed using the seed roles:

| Role | Default Email Format | Workspace |
| :--- | :--- | :--- |
| **Investigator** | `test.investigator@fcip.agency` | Alert triage, case dossiers, transactions, network graphs, submit cases |
| **Compliance Officer** | `test.compliance@fcip.agency` | Review queue, case adjudication, SAR validation, compliance risk oversight |
| **Administrator** | `test.adminstrator@fcip.agency` | User management, RBAC policy matrix, detection rule calibration, audit logs |

---

## 📂 Sample Dataset Ingestion

A sample financial crime feed with circular structuring patterns and rapid velocity transactions is included at `backend/sample_dataset.csv`.

To ingest via the platform:
1. Log in to the web interface as an **Investigator** or **Administrator**.
2. Navigate to **Financial Data & CSV** (or **Data Administration** in Admin console).
3. Select `backend/sample_dataset.csv` and click **Parse & Ingest Dataset**.
4. Switch to **Detection Rules & Risk** and click **Execute Detection Run** to trigger rule heuristics and populate the Alerts dashboard.

---

## 🧪 Testing & Verification

Run the automated integration test suites from the root repository:

```bash
# Report download & authentication tests
node backend/src/tests/test_report_download.js

# Compliance Officer review workflow & RBAC tests
node backend/src/tests/test_compliance.js

# Frontend production build verification
cd frontend && npm run build
```

---

## 🔒 Security & Data Integrity
- Passwords are salted and hashed using `bcrypt` (never stored in plaintext).
- Protected API routes require a valid `Bearer <JWT>` authorization token in the `Authorization` header.
- Dedicated role isolation at both the backend middleware layer (`authorizeRoles`) and frontend route tree.
- Report downloads authenticate via Bearer token blobs, preventing unauthorized direct URL access.
- Sensitive environment files (`.env`, `.env.local`) and `node_modules` are permanently ignored from source control.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
