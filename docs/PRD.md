# Product Requirements Document (PRD)
## Project: DealFlow AI — CRM Hygiene & Voice-to-Action Auto-Logger

---

### 1. Executive Summary
**DealFlow AI** solves one of the costliest pain points in modern B2B sales organizations: **CRM Hygiene and Rep Productivity Decay**. Sales representatives spend over 30% of their working hours manually typing notes, updating deal stages, logging next steps, and creating follow-up tasks in CRMs like Salesforce and HubSpot. Consequently, CRMs are plagued by stale pipelines, missing close dates, unlogged customer objections, and dropped commitments.

DealFlow AI acts as an autonomous sales intelligence platform that captures voice conversations (meetings and calls), extracts high-intent deal signals, audits pipeline health, and logs verified action items directly into CRM workflows—ensuring real-time pipeline hygiene with zero manual rep friction.

---

### 2. Objectives & Success Metrics
- **Phase 1 Target**: Deliver a resilient, secure, multi-tenant MERN architectural foundation.
- **Enterprise Multi-Tenancy**: Complete organization-level data isolation where cross-tenant data leakage is mathematically and structurally impossible.
- **Security & Compliance**: Zero hardcoded secrets, authenticated JWT session handling with rotating refresh tokens, RBAC (Role-Based Access Control), rate-limiting, and immutable audit logs.
- **System Stability**: 99.9% uptime target with asynchronous background job offloading (BullMQ + Redis) for compute-heavy audio/NLP processing.
- **Sales Intelligence UI**: Premium, intuitive, distraction-free SaaS interface allowing sales reps and revenue leaders to inspect meetings, deals, pipeline hygiene, and integration health.

---

### 3. User Personas
1. **Sales Representative (Rep)**:
   - Goal: Spend time closing deals, not doing administrative data entry.
   - Pain Point: Forgetting to log meeting notes or follow-up action items into Salesforce/HubSpot.
2. **Sales Manager / RevOps Director**:
   - Goal: Real-time visibility into pipeline hygiene, deals at risk, missed customer action items, and rep accountability.
   - Pain Point: Dirty CRM data leads to inaccurate forecasting and unclosed quarters.
3. **System Administrator / Org Admin**:
   - Goal: Manage organization members, security roles, CRM integrations, and compliance audit trails.

---

### 4. System Roles & RBAC Matrix
| Role | Organization Management | User Management | Deal & Meeting Access | Integration Config | Audit Log Access |
|---|---|---|---|---|---|
| `admin` | Full Control | Invite, Edit, Deactivate | Full (Org-wide) | Full Read/Write | Full Read |
| `manager` | Read Only | View Team Members | Full (Team/Org-wide) | View Status | View Relevant |
| `rep` | Read (Own Org) | View Self | Assigned Deals / Meetings | View Status | Own Actions |

---

### 5. Functional Requirements (Phase 1 Scope)

#### 5.1 Multi-Tenant Organization & Authentication
- **Organization Hierarchy**: Every account belongs to an `Organization`. Multi-tenancy is enforced on every query via `organizationId`.
- **User Authentication**: Secure password hashing with `bcryptjs` (work factor 12).
- **Session Tokens**: Short-lived JWT Access Tokens (15m) paired with long-lived Refresh Tokens (7d) stored securely with token family revocation.
- **RBAC**: Enforce `admin`, `manager`, and `rep` permission boundaries.

#### 5.2 Core Entities & Data Architecture
- **Organization**: Company domain, plan tier, settings, active integrations.
- **User**: Profile, organization reference, role, status, last login timestamp.
- **Meeting**: Customer meeting records, scheduled/recorded timestamps, participant lists, duration, platform source, status (`scheduled`, `processing`, `completed`, `failed`), summary, and transcript placeholder.
- **Deal**: Associated CRM deal/opportunity, stage, pipeline value, close date, risk score, hygiene status (`healthy`, `at_risk`, `stale`).
- **ActionItem**: Explicit commitments identified from calls, owner, due date, status (`pending`, `completed`, `synced_to_crm`), priority (`urgent`, `high`, `medium`, `low`).
- **Integration**: Explicit connection state for Salesforce, HubSpot, Slack, Zoom, Google Meet. No mock states—requires valid user credentials.
- **AuditLog**: Immutable security trail recording actor, action, target entity, timestamp, and IP address.

#### 5.3 Background Processing Queue
- Redis-backed BullMQ queue (`meeting-processing-queue`) initialized for asynchronous ingestion and processing.
- Error resiliency: Graceful degradation with clear system telemetry when Redis is offline in local dev environments.

#### 5.4 Frontend SaaS Portal
- Standard CSS / CSS Modules with modern design system (slate/indigo enterprise aesthetic).
- Responsive layout with Sidebar, Topbar, User Profile, Org Switcher.
- Dashboard with pipeline hygiene metrics, meeting velocity, pending action items, and recent deal risks.
- Dedicated modules:
  - **Meetings**: Searchable, filterable list of captured calls and transcript statuses.
  - **Deal Intelligence**: Pipeline hygiene inspection with deal stage health.
  - **Action Center**: Task triage and CRM sync status tracker.
  - **Integrations**: Production-grade credential setup dialogs (Salesforce, HubSpot, Slack, Zoom).
  - **Settings**: Organization details, team management, security preferences.

---

### 6. Out of Scope for Phase 1
- Live Zoom/Gong bot stream interception (Phase 2).
- Real-time LLM audio transcription and summarization inference pipelines (Phase 2).
- Bi-directional CRM webhook sync execution without real OAuth tokens.
