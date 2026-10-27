# Financial Crime Intelligence Platform (FCIP) 🛡️💼

An enterprise-grade Anti-Money Laundering (AML), Counter-Terrorist Financing (CFT), and Financial Crime Surveillance web application built with a modern React.js frontend, Node.js + Express backend, and a high-performance PostgreSQL relational database.

[![Repository](https://img.shields.io/badge/GitHub-FCIP-blue?style=flat-square&logo=github)](https://github.com/ABD15-444/FCIP.git)
[![Node](https://img.shields.io/badge/Node.js-v18%2B-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-cyan?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

---

## 🌟 Key Capabilities & 8-Phase Architecture

FCIP was designed and delivered across 8 comprehensive architectural phases:

1. **Phase 1: Project Setup & Authentication**
   - Role-Based Access Control (RBAC) with 3 specialized security clearance tiers: `investigator`, `admin`, `compliance_officer`.
   - Cryptographic password hashing using `bcrypt` (10 rounds) and stateless session verification using JSON Web Tokens (JWT).
   - Cyber-themed dark mode glassmorphism UI with live authentication state synchronization.

2. **Phase 2: Financial Data Management & CSV Ingestion**
   - High-throughput CSV parsing feed (`POST /api/upload`) utilizing `multer` and stream pipes.
   - Relational database schema managing customer dossiers, bank accounts, and transactional ledgers.
   - Interactive transaction ledger with instantaneous date ranges, monetary bounds, and account search filters.

3. **Phase 3: Detection Engine & Risk Scoring Matrix**
   - Heuristic automated detection engine:
     - **Large Amount Rule**: Detects transactions breaching high-value thresholds ($10,000+).
     - **Rapid Transfer Rule**: Detects velocity bursts (> 3 transactions sent within 10 minutes).
     - **Circular Transaction Rule**: Recursive Common Table Expression (CTE) tracing money loops returning to the origin sender within 5 hops.
   - Dynamic Risk Scoring algorithm evaluating composite risks (0–100) classified into `Low`, `Medium`, and `High` tiers.

4. **Phase 4: Automated Alerts System**
   - Real-time triaging of automated rule matches with color-coded severity badges (`High` = Red, `Medium` = Orange, `Low` = Yellow).
   - Detailed modal inspection explaining matched rule heuristics, underlying transactions, and factor breakdown.
   - Immediate alert lifecycle management (`open`, `acknowledged`, `closed`) and direct escalation into formal case dossiers.

5. **Phase 5: Network Graph & Multi-Hop Money Flow**
   - Interactive canvas topology visualizing accounts, counterparties, and directional fund transfers.
   - Multi-hop recursive path tracing highlighting intermediary flow routes and capital dispersion hops.
   - Node styling reflecting live risk scores and edge weight scaling dynamically by transaction volume.

6. **Phase 6: Case Dossier & Evidence Management**
   - Formal case tracking supporting priority categorization (`low`, `medium`, `high`) and statuses (`open`, `in_progress`, `escalated`, `closed`).
   - Collaborative investigator intelligence notes feed.
   - Chronological immutable case audit timeline tracking every investigator assignment and status change.

7. **Phase 7: Dashboard Analytics & Printable SAR Reports**
   - Executive telemetry cards: Total Transactions, Flagged Volumes, Open Alerts, Active Cases, and High-Risk Entities.
   - Risk distribution tier charts and historical 30-day transaction volume tracking.
   - Automated Suspicious Activity Report (SAR) compiler producing exportable/printable HTML and PDF compliance reports.

8. **Phase 8: Security Audit Logs & Final Polish**
   - Automatic audit logging middleware recording user logins, status modifications, detection adjustments, and case exports.
   - Role-restricted administrator audit trail inspection interface.
   - Responsive collapsible sidebar navigation, live notifications bell badge, and route protection.

---

## 🛠️ Technology Stack

- **Frontend**: React.js, Vite, Tailwind CSS, Lucide Icons, Axios, D3.js / Canvas.
- **Backend**: Node.js, Express.js, PostgreSQL (`pg` connection pool), Multer, CSV-Parser, JSON Web Tokens, Bcrypt.
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
5. Start the backend server (tables and default detection rules will automatically initialize):
   ```bash
   npm start
   ```
   *Backend running at `http://localhost:5000`.*

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
   *Frontend running at `http://localhost:3000`.*

---

## 📂 Sample Dataset Ingestion

A sample financial crime feed with circular structuring patterns and rapid velocity transactions is included at `backend/sample_dataset.csv`.

To ingest via the platform:
1. Log in to the web interface.
2. Navigate to **Financial Data & CSV** in the sidebar.
3. Select `backend/sample_dataset.csv` and click **Parse & Ingest Dataset**.
4. Switch to **Detection Rules & Risk** and click **Execute Detection Run** to trigger rule heuristics and populate the Alerts dashboard.

---

## 🔒 Security & Data Integrity
- Passwords are salted and hashed using `bcrypt` (never stored in plaintext).
- Protected API routes require a valid `Bearer <JWT>` authorization token.
- Sensitive environment files (`.env`, `.env.local`) and `node_modules` are permanently ignored from source control.
- Administrative operations (such as rule modifications and audit review) are guarded with strict server-side RBAC middleware.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
