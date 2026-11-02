# DealFlow AI — CRM Hygiene & Voice-to-Action Auto-Logger

> **Production-Grade MERN Multi-Tenant Architecture (Phases 1, 2, 3, 4 & 5 Complete — Production Ready)**
> DealFlow AI is an autonomous CRM hygiene and voice-to-action auto-logger platform that ingests recorded sales conversations from Zoom, Gong, and manual uploads, runs audio transcription via OpenAI Whisper, extracts structured intelligence with traceable transcript evidence, evaluates explainable deal health, presents proposed CRM updates and Jira tickets in a Human Approval Center, and safely executes verified deliverables into HubSpot CRM and Atlassian Jira.

---

## 🏛️ System Architecture

- **Frontend**: React 18 + Vite (SPA) with pure CSS Design Tokens & Scoped Components (Zero Tailwind). Optimized with Route-Level Code Splitting (`React.lazy` / `Suspense`).
- **Backend API Gateway**: Node.js + Express under `/api/v1` with Helmet, CORS, Rate-Limiter, Gzip Compression, Request Tracing (`X-Request-Id`), and Liveness/Readiness Probes (`/health`, `/ready`).
- **Standalone Background Worker**: Decoupled BullMQ worker process (`server/worker.js`) listening on Redis for scalable asynchronous queue processing.
- **Database**: MongoDB + Mongoose with compound tenancy indexing on `organizationId` and connection pooling (maxPoolSize: 50).
- **Audio Storage**: Storage Abstraction Layer (`LocalStorageProvider` & `S3StorageProvider`) with MIME and magic byte validation; audio binaries are never stored inside MongoDB documents.
- **Transcription**: OpenAI Whisper (`whisper-1`) with timing bounds, speaker labeling, and segment persistence.
- **AI Intelligence & Cost Control**: Structured JSON analysis with prompt injection defense, token usage tracking (`promptTokens`, `completionTokens`), and real-time model cost estimation.
- **Data Privacy & Governance**: Configurable data retention policies, GDPR/CCPA full data takeout exports, and secure audio file purging.
- **External Integrations (Phase 3)**:
  - **Zoom**: Real-Time Media Streams (RTMS) and official webhook verification (`x-zm-signature` HMAC-SHA256 & URL challenge handling).
  - **Gong**: API v2 call import with date filters, cursor pagination, and monologue-to-segment normalization.
  - **HubSpot CRM**: OAuth 2.0 authorization, token auto-refresh, deal & pipeline synchronization, and `DealMapping` persistence.
  - **Atlassian Jira Cloud**: 3LO OAuth authorization, cloud site/project discovery, and action item issue creation formatted in Atlassian Document Format (ADF) via REST API v3.
  - **Security Vault**: AES-256-GCM authenticated encryption with isolated IVs and authentication tags for all credentials.
- **Human Approval & Safe Execution Engine (Phase 4)**:
  - **Human-in-the-Loop Safeguard**: *"AI proposes. Humans approve. DealFlow executes."* No external updates occur without explicit human approval.
  - **Grounding & Validation**: Proposals verified against verbatim transcript quotes and freshness checked against current CRM records.
  - **Material Modification Guard**: Editing an approved action immediately invalidates approval and resets status to `pending_approval`.
  - **Execution Engine**: Idempotent execution lock, real HTTP provider verification, and immutable audit logging.
- **DevOps & Containers (Phase 5)**: Multi-stage Dockerfiles (`server/Dockerfile`, `server/Dockerfile.worker`, `client/Dockerfile`), Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`), Nginx reverse proxy, and GitHub Actions CI/CD (`.github/workflows/ci-cd.yml`).
- **Security & RBAC**: JWT Access Tokens (15m) + Rotating Refresh Tokens (7d) with token reuse revocation. Strict RBAC (`admin`, `manager`, `rep`, `sales_ops`).

```
dealflow-ai/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── components/         # Layout, AudioPlayer, AudioUploadModal, ReviewInsightsModal, Modals, Badges
│   │   ├── context/            # AuthContext, SocketContext
│   │   ├── pages/              # MeetingDetailsPage (7 Tabs), MeetingsPage, DealIntelligencePage, ActionCenterPage, ...
│   │   ├── services/           # ApiClient (XHR upload progress, JWT auth, token refresh)
│   │   └── styles/             # Enterprise CSS Tokens & Components (Zero Tailwind)
│   └── vite.config.js          # Reverse proxy to backend API & WebSocket
├── server/                     # Express REST API Server
│   ├── src/
│   │   ├── config/             # DB, Redis, Environment loaders
│   │   ├── controllers/        # Auth, Meetings, Deals, Actions, Dashboard, Integrations, Settings
│   │   ├── middleware/         # Auth, Tenant, Role, Validation, Centralized Error Handling
│   │   ├── models/             # Org, User, Meeting, TranscriptSegment, MeetingInsight, Deal, ActionItem, ...
│   │   ├── modules/
│   │   │   ├── ai/             # AI Service, OpenAI provider, prompt injection shield, schemas
│   │   │   ├── intelligence/   # Explainable Deal Health Scoring Service (7 dimensions)
│   │   │   ├── storage/        # Storage abstraction (Local & S3 providers, file validation)
│   │   │   └── transcription/  # Whisper transcription service, provider, validator
│   │   ├── queues/             # BullMQ Meeting Processing Queue & Worker
│   │   ├── routes/             # Modular API versioned routes (/api/v1)
│   │   └── services/           # MeetingService, DealService, AuthService, AuditService
│   ├── tests/                  # Jest test suite (Health, Auth, Multi-Tenant Isolation, AudioUpload, Transcription, AI Analysis)
│   ├── seed.js                 # Realistic multi-tenant demo data seeder with audio & insights
│   └── server.js               # Entry point with HTTP, Socket.IO, DB & Graceful Shutdown
├── docs/                       # Complete Production Architecture & Operations Suite
│   ├── PRD.md                  # Product Requirements Document
│   ├── ARCHITECTURE.md         # Full Technical & Production Topology Specification
│   ├── API.md                  # REST API v1 Specification (All Endpoints & Sockets)
│   ├── SETUP.md                # Local & Docker Development Setup Guide
│   ├── ENVIRONMENT.md          # Environment Variable Configuration & Vault Reference
│   ├── DEPLOYMENT.md           # Production Deployment, Docker & Rollback Runbook
│   ├── SECURITY.md             # Security Review, RBAC Matrix & Threat Model
│   ├── DATABASE.md             # Database Schemas, Indexing & Connection Pooling
│   ├── INTEGRATIONS.md         # External Provider Specs (Zoom, Gong, HubSpot, Jira)
│   ├── TROUBLESHOOTING.md      # Incident Response Runbook
│   └── BACKUP_AND_RECOVERY.md  # DR, Backup Retention & PITR Procedures
└── package.json                # Monorepo orchestration scripts
```

---

## 🔑 Demo Accounts & Pre-Seeded Tenants

The application automatically seeds realistic multi-tenant demonstration data upon startup:

### Organization 1: Acme Cloud Technologies (Domain: `acmecloud.com`)
| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@acmecloud.com` | `Password123!` | Full admin control, team invites, integration credentials, audit logs |
| **Sales Rep** | `sarah.rep@acmecloud.com` | `Password123!` | View & log meetings, manage deals, update action items |

### Organization 2: Global Retail Corp (Domain: `globalretail.com`)
| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@globalretail.com` | `Password123!` | Isolated tenant for verifying multi-tenant data boundaries |

---

## 🚀 Quickstart Guide (Windows)

### Prerequisites
- **Node.js**: v18.0.0+ (Tested on v22.19.0)
- **npm**: v9.0.0+ (Tested on v10.9.3)
- **MongoDB** *(Optional)*: If an external MongoDB instance is running at `mongodb://127.0.0.1:27017/dealflow_ai`, it will connect automatically. In local development without an external database, the server automatically starts an embedded in-memory MongoDB instance with pre-seeded demo records!
- **Redis** *(Optional)*: If Redis is running on port 6379, BullMQ queues connect automatically. If offline, the queue gracefully runs in resilient direct async execution mode without interrupting HTTP operations.
- **OpenAI API Key** *(Optional for AI processing)*: Add `OPENAI_API_KEY=sk-...` to `server/.env`. (Automated tests use built-in mock providers for zero-cost, zero-network verification).

### 1. Installation
Run npm install in both server and client:
```powershell
npm install --prefix server
npm install --prefix client
```

### 2. Configure Environment Variables
Copy `.env.example` in `server/`:
```powershell
Copy-Item server/.env.example server/.env
```

### 3. Run Automated Tests
Execute the comprehensive Jest test suite (80 tests across 14 test suites covering Phases 1, 2, 3, 4, and 5):
```powershell
npm test --prefix server
```

### 4. Build Frontend
Verify production frontend build:
```powershell
npm run build --prefix client
```

### 5. Start the Application
Run the backend and frontend concurrently:
```powershell
# Terminal 1 - Start Express Backend (Port 5000):
npm run dev --prefix server

# Terminal 2 - Start React + Vite Client (Port 5173):
npm run dev --prefix client
```

Open your browser at: **`http://localhost:5173`**

---

## 🎙️ Phase 2 Feature Highlights

1. **Audio Upload Workflow**:
   - Drag-and-drop audio uploader (MP3, WAV, M4A, MP4) with size limits (default 25MB) and MIME/magic-byte validation.
   - Real-time progress bar (0–100%) during upload.
   - Optional deal association and scheduled call timestamps.
2. **Secure Media Streaming**:
   - Safe audio streaming via `GET /api/v1/meetings/:id/audio` supporting HTTP Range byte requests.
   - Dual authentication: HTTP `Authorization` header and `?token=` query parameter for native `<audio>` elements.
   - Strict organization isolation: Tenant B cannot stream Tenant A's audio recordings.
3. **Meeting Details Workspace (7 Tabs)**:
   - **Overview**: Executive summary (purpose, situation, decisions, unresolved questions, next steps) and Deal Health score card.
   - **Full Transcript**: Segment viewer with click-to-seek audio synchronization, speaker labels, search filter, and TXT/JSON export.
   - **Decision Criteria**: Technical, budget, timeline, and security requirements with verbatim transcript evidence.
   - **Buying Signals**: Commercial intent indicators with transcript quotes and audio seek links.
   - **Risks & Objections**: Active customer objections with severity levels and mitigation suggestions.
   - **Competitor Intel**: Competitor mentions with cited strengths, weaknesses, and displacement risks.
   - **Action Commitments**: Deliverables categorized by responsible party (`Customer Deliverable` vs `Internal Action`), due date, and priority.
4. **Explainable Deal Health Score (0–100)**:
   - Evaluated across 7 dimensions: Requirements Alignment, Budget Clarity, Timeline Feasibility, Decision Maker Engagement, Buying Signals, Objection Resolution, Next-Step Clarity.
   - Includes transparent AI scoring rationale.
5. **Human-in-the-Loop Review**:
   - Sales reps can review, edit, and certify meeting intelligence via `PATCH /api/v1/meetings/:id/insights`.
   - Certified reviews display audit timestamps and reviewer identity.
6. **Deal Intelligence Aggregation**:
   - Synthesizes intelligence across multiple meetings for each deal opportunity.
7. **Real-Time WebSockets**:
   - Socket.IO live updates for pipeline stage transitions (`meeting:status`, `meeting:transcript`, `meeting:insights`).

---

## ⚡ Phase 3 & 4 Highlights: Human Approval Center & Real Integrations

1. **Human-in-the-Loop Approval Center (`/approvals`)**:
   - Filterable action table with status tabs: Pending Approval, Approved, Executed, Rejected.
   - Comprehensive action cards displaying target system (HubSpot, Jira), title, rationale, and confidence scores.
   - Grounding evidence view with verbatim transcript quotes and timestamp seek references.
   - Visual Before/After diffs for CRM updates (e.g., deal stage, amount, close date).
   - In-app action editing with automatic approval invalidation safeguard.
   - Live audit history timeline modal showing full event lifecycle.
2. **Safe & Verified Execution Engine**:
   - Real API execution against HubSpot CRM API v3 and Jira Cloud REST API v3.
   - Pre-flight stale data detection: aborts execution if target CRM records were modified externally.
   - Idempotency protection prevents double-submission during concurrent operations or retries.
   - Only marks actions as `completed` after verified HTTP 200/201 provider confirmation.
3. **Four Real External Integrations**:
   - **Zoom**: Webhook verification (`x-zm-signature` HMAC-SHA256) & Real-Time Media Streams (RTMS).
   - **Gong**: API v2 call import with cursor pagination and monologue transcript normalization.
   - **HubSpot**: OAuth 2.0 deal synchronization, pipeline mapping, and meeting note associations.
   - **Jira Cloud**: 3LO OAuth authorization and task creation in Atlassian Document Format (ADF).

---

## 🔒 Multi-Tenant Data Isolation Guarantee
Every business model (`Meeting`, `TranscriptSegment`, `MeetingInsight`, `Deal`, `ActionItem`, `Integration`, `AutomationAction`, `ApprovalHistory`, `AutomationExecution`, `AutomationSetting`, `AuditLog`, `User`) is explicitly scoped with `organizationId`:
1. **JWT Boundary**: Access tokens encode `organizationId`.
2. **Tenant Middleware**: `enforceTenantIsolation` validates that `req.organizationId` matches the authenticated user's organization.
3. **Database Queries**: All queries filter by `organizationId: req.organizationId`.
4. **Verification**: 100% verified by automated test suites `tests/tenantIsolation.test.js`, `tests/automationApproval.test.js`, and `tests/automationExecution.test.js`.
