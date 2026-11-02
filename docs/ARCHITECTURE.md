# Technical Architecture Document
## Project: DealFlow AI — CRM Hygiene & Voice-to-Action Auto-Logger

---

### 1. Architectural Overview & System Design
DealFlow AI is engineered as an enterprise-grade multi-tenant SaaS application adhering to strict Clean Architecture, Separation of Concerns, and Zero-Trust tenancy principles.

```
                           +------------------------+
                           |  React + Vite Frontend |
                           |  (CSS Modules / Pure)  |
                           +-----------+------------+
                                       | HTTPS / WSS
                                       v
                           +------------------------+
                           |     Express Gateway    |
                           |  Helmet | RateLimit    |
                           |  CORS   | JWT Auth     |
                           +-----------+------------+
                                       |
              +------------------------+------------------------+
              |                        |                        |
              v                        v                        v
     +-----------------+      +-----------------+      +-----------------+
     | Auth / Tenant   |      | Meeting & Deals |      | Integrations &  |
     | Controllers     |      | Controllers     |      | Audit Logs      |
     +--------+--------+      +--------+--------+      +--------+--------+
              |                        |                        |
              +------------------------+------------------------+
                                       |
                                       v
                              +-----------------+
                              | Service Layer   |
                              | Business Logic  |
                              +--------+--------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
         +-------------------+                   +-------------------+
         |  Mongoose Models  |                   |  BullMQ + Redis   |
         |  (organizationId  |                   |  Background Job   |
         |   Indexed Strict) |                   |  Queue Pipeline   |
         +---------+---------+                   +---------+---------+
                   |                                       |
                   v                                       v
         +-------------------+                   +-------------------+
         | MongoDB Database  |                   | Multi-Stage Worker|
         | Multi-Tenant Docs |                   | (Whisper / OpenAI)|
         +-------------------+                   +-------------------+
```

---

### 2. Multi-Tenant Data Isolation Strategy
- **Partitioning Model**: Shared-database with tenant-scoped collections.
- **Tenant Scope Enforcement**:
  1. Every schema defines `organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }`.
  2. The `authenticate` middleware extracts and verifies the tenant context from the verified JWT payload.
  3. Service and Controller layers universally bind all read/write queries to `organizationId: req.user.organizationId`.
  4. Unit and Integration tests explicitly verify that User A belonging to Org 1 can never access, mutate, or query records from Org 2.

---

### 3. Voice Ingestion & Audio Storage Abstraction (Phase 2)
The audio ingestion architecture decouples file storage from business logic through a provider interface:

```
                            +--------------------------+
                            |     Multer Middleware    |
                            | (MemoryStorage, Limit)   |
                            +------------+-------------+
                                         |
                                         v
                            +--------------------------+
                            |      StorageService      |
                            | (Magic Bytes, MIME, Ext) |
                            +------------+-------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
             +--------------------+              +--------------------+
             | LocalStorageProvider|              |  S3StorageProvider |
             | (Safe Tenant Dirs) |              | (AWS S3 / CF R2)   |
             +--------------------+              +--------------------+
```

- **Validation**: Strict validation of MIME types (`audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/x-m4a`), file extensions, magic bytes (ID3, RIFF/WAVE, MP4 ftyp box), and configurable upload limits (default 25MB).
- **Binary Isolation**: Audio binary data is **never** persisted directly into MongoDB documents. MongoDB stores strictly storage metadata (`storageKey`, `storageProvider`, `mimeType`, `sizeBytes`, `durationSeconds`).
- **Streaming**: Authenticated HTTP Range request streaming via `GET /api/v1/meetings/:id/audio` supporting both `Authorization: Bearer <token>` and `?token=` query parameters for native HTML5 audio players.

---

### 4. Transcription Engine Architecture (Phase 2)
- **Engine**: OpenAI Whisper API (`whisper-1`) utilizing `verbose_json` response formats.
- **Segment Persistence**: Stored in a dedicated `TranscriptSegment` collection indexed by `organizationId` and `meetingId`.
- **Diarization & Participant Integrity**: Speaker labels default to `Speaker` without fabricating participant names.
- **Timing Constraints**: Strict validation ensuring `endTime >= startTime` and non-empty text per segment.
- **Chunking Strategy**: Provider handles audio chunking with sequential index re-assembly if files exceed provider limits.

---

### 5. AI Meeting Intelligence & Analysis Engine (Phase 2)
Structured insights are extracted from raw transcripts using OpenAI models (`gpt-4o-mini` / `gpt-4o`) with strict schema validation:

```
                          +------------------------+
                          |   Transcript Segments  |
                          +-----------+------------+
                                      |
                                      v
                          +------------------------+
                          | Prompt Injection Shield|
                          | (Transcript as Untrusted)|
                          +-----------+------------+
                                      |
                                      v
                          +------------------------+
                          |  OpenAI Chat Completion |
                          |  (Structured JSON Mode)|
                          +-----------+------------+
                                      |
                                      v
                          +------------------------+
                          | Schema & Quote Validator|
                          | (Evidence Traceability)|
                          +-----------+------------+
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
              v                       v                       v
     +-----------------+     +-----------------+     +-----------------+
     | MeetingInsight  |     |   ActionItem    |     |   Deal Health   |
     | (Summary, Risks)|     | (Customer/Team) |     |  (7 Dimensions) |
     +-----------------+     +-----------------+     +-----------------+
```

#### 5.1 Prompt Injection Defense
Transcripts are wrapped in untrusted data delimiters and system instructions explicitly command the model to ignore any prompt instructions embedded inside customer dialogue.

#### 5.2 Evidence Traceability
Every extracted decision criterion, buying signal, objection, risk, competitor mention, and action item includes an evidence object:
```json
{
  "quote": "verbatim customer excerpt",
  "startTime": 12.5,
  "endTime": 18.0,
  "confidence": 0.95
}
```
Validation ensures quotes match actual phrases present in the transcript segments.

#### 5.3 Explainable 7-Dimension Deal Health Scoring
Calculates a 0–100 composite score with explicit explanation rationale across 7 weighted dimensions:
1. **Requirements Alignment** (15 pts)
2. **Budget Clarity** (15 pts)
3. **Timeline Feasibility** (15 pts)
4. **Decision Maker Engagement** (15 pts)
5. **Buying Signal Intensity** (20 pts)
6. **Objection Resolution** (10 pts)
7. **Next Step Clarity** (10 pts)

#### 5.4 Human-in-the-Loop Review
Sales reps and managers can review, refine, and certify AI findings via `PATCH /api/v1/meetings/:id/insights`, updating audit metadata (`isReviewed`, `reviewedBy`, `reviewedAt`).

---

### 6. Real-Time Socket.IO Synchronization
- Real-time multiplexing into tenant rooms: `org:<organizationId>`.
- Client subscribes to lifecycle events:
  - `meeting:created`
  - `meeting:status` (stages: `uploading`, `transcribing`, `analyzing`, `completed`, `failed`)
  - `meeting:transcript`
  - `meeting:insights`
  - `meeting:error`
- Resilient polling fallback (4-second interval) automatically activates on frontend when WebSockets are disconnected during active pipeline processing.

---

### 7. External Integrations Architecture (Phase 3)

```
       +-------------------------------------------------------------+
       |             External Platform Ingestion Sources             |
       +-------------------------------------------------------------+
            |                    |                    |
            v                    v                    v
     +--------------+     +--------------+     +--------------+
     |  Zoom Video  |     |  Gong Calls  |     | HubSpot CRM  |
     | (RTMS Stream |     |  (API v2 /   |     | (OAuth 2.0 / |
     |  & Webhooks) |     |  Transcripts)|     |  Deals Sync) |
     +-------+------+     +-------+------+     +-------+------+
             |                    |                    |
             +--------------------+--------------------+
                                  |
                                  v
                  +-------------------------------+
                  | UnifiedMeetingIngestionService|
                  | - Multi-tenant De-duplication |
                  | - Normalized Transcript Segs  |
                  | - Auto AI Intelligence Feeder |
                  +---------------+---------------+
                                  |
               +------------------+------------------+
               |                                     |
               v                                     v
     +-------------------+                 +-------------------+
     |   Meeting Model   |                 |TranscriptSegment  |
     | (externalMeetingId|                 |   (Speaker, text, |
     |  externalCallId)  |                 |    start, end sec)|
     +---------+---------+                 +---------+---------+
               |                                     |
               +------------------+------------------+
                                  |
                                  v
                       +---------------------+
                       |   AiService Engine  |
                       | (Insights, Hygiene, |
                       |  7-Dimension Score) |
                       +----------+----------+
                                  |
                                  v
                       +---------------------+
                       |  Atlassian Jira     |
                       |  (REST API v3 / ADF |
                       |   Auto Task Logger) |
                       +---------------------+
```

#### 7.1 Authenticated AES-256-GCM Credential Vault
- All third-party secrets (OAuth access tokens, refresh tokens, Basic auth keys, webhook secrets) are encrypted before writing to MongoDB.
- Uses authenticated encryption with 96-bit random IVs and 128-bit authentication tags.
- Secrets are never returned to frontend clients or exposed in API response serializers.

#### 7.2 Signed OAuth 2.0 State Security
- OAuth state strings contain encrypted `{ organizationId, userId, provider, nonce, exp }`.
- Time-limited (10-minute validity) to prevent CSRF, tenant confusion, and replay attacks.

#### 7.3 Zoom Live RTMS & Webhooks
- **HMAC-SHA256 Signature Verification**: Validates `x-zm-signature` against `v0:${timestamp}:${rawBody}` using `ZOOM_WEBHOOK_SECRET` with 5-minute freshness window.
- **URL Challenge Handling**: Automatically responds to Zoom's `endpoint.url_validation` event with HMAC-SHA256 hash.
- **RTMS Live Audio Capture**: Ingests real-time media stream packets, buffers speaker segments, and routes finalized calls into `UnifiedMeetingIngestionService`.

#### 7.4 Gong API v2 Call Import
- Queries calls using date-range filters (`fromDateTime`, `toDateTime`) and cursor pagination.
- Fetches call transcripts via `POST /v2/calls/transcript` and normalizes monologues and sentences into standard `TranscriptSegment` format.
- Automatically initiates Phase 2 AI intelligence extraction upon ingestion.

#### 7.5 HubSpot Deal & Pipeline Synchronization
- Automated OAuth 2.0 token refresh (re-authenticating 2 minutes before expiration).
- Configurable deal property mapping: maps HubSpot properties (`dealname`, `amount`, `dealstage`, `closedate`) into internal deal schema.
- Idempotent `DealMapping` collection prevents duplicate deal creation and preserves external CRM URLs.

#### 7.6 Jira Cloud & Atlassian Document Format (ADF)
- Connects via Atlassian OAuth 2.0 (3LO) with offline refresh tokens.
- Generates compliant Atlassian Document Format (ADF) JSON documents for issue descriptions.
- Supports automated action item task creation via Jira Cloud REST API v3.

---

### 8. Human Approval Center, Workflow Automation & Safe Execution Engine (Phase 4)

DealFlow AI Phase 4 transforms meeting insights into verified, executed CRM updates and project tickets through a human-in-the-loop automation engine.

```
+---------------------------------------------------------------------------------------------+
|                                    WORKFLOW PIPELINE                                       |
+---------------------------------------------------------------------------------------------+
 Meeting Completed -> AI Intelligence -> Proposal Generation -> Evidence Grounding
                                                                        |
                                                                        v
 Execution Result  <- Safe Execution Engine <- Human Review & Approval (RBAC)
 (Audit Log + Hist)   (Idempotent + Freshness) (Approve / Reject / Edit)
+---------------------------------------------------------------------------------------------+
```

#### 8.1 Core Principle: Human-in-the-Loop Safeguards
> **AI proposes. Humans approve. DealFlow executes.**
- AI algorithms and background jobs are strictly forbidden from directly updating external CRM or project management platforms without explicit human authorization.
- Every automated proposal requires an affirmative approval action by an authorized user (`admin`, `manager`, or `sales_ops`).

#### 8.2 Proposal Generation & Evidence Grounding (`action-generator.service.js`)
- Triggered automatically when meeting AI analysis completes, or manually via API.
- Generates three distinct categories of proposed actions:
  1. **HubSpot Deal Updates** (`hubspot_update_deal`): Stage advancement, budget/amount updates, close date modifications based on meeting signals.
  2. **HubSpot Meeting Notes** (`hubspot_create_note`): High-signal executive summary notes associated directly with target CRM deals.
  3. **Jira Tasks / Issues** (`jira_create_issue`): Commitments and tasks identified in the call, formatted with Atlassian Document Format (ADF) descriptions and due dates.
- **Evidence Verification (`action-validator.service.js`)**:
  - Validates that every proposed action is grounded with verbatim transcript quotes, start/end timestamps, and speaker attribution.
  - Computes confidence scores (0.0 to 1.0) and assigns confidence bands (`low`, `medium`, `high`).
  - Flags low-confidence proposals (< 0.7) for mandatory manual review.

#### 8.3 State Machine, RBAC & Approval Invalidation (`automation.policy.js`)
- **Lifecycle States**: `pending_approval` -> `approved` -> `executing` -> `completed` / `failed`, or `rejected` / `cancelled`.
- **Role-Based Execution**:
  - `rep`: Can view proposals and propose actions; 403 Forbidden for approval, rejection, or execution.
  - `admin`, `manager`, `sales_ops`: Authorized to approve, edit, reject, and trigger execution.
- **Approval Invalidation on Modification**:
  - If a user modifies the payload of an already approved proposal, the approval is immediately revoked (`approvalStatus` resets to `pending_approval`, `approvedBy` and `approvedAt` are cleared).
  - This eliminates race conditions where an approved action is edited to an unvetted payload prior to execution.

#### 8.4 Safe Execution Engine & Stale Data Detection (`execution.service.js`)
- **Pre-flight Check**: Verifies `approvalStatus === 'approved'` and rejects any unauthorized or pending action with 400 Bad Request.
- **Stale Deal Data Protection**: Before updating HubSpot deals, queries the current deal state in CRM to verify that stage and amount have not drifted externally since the proposal was created. Prevents overwriting concurrent human edits.
- **Idempotency Guard**: Atomic execution state locking (`executing`) and `AutomationExecution` records prevent double-execution under concurrency or network retries.
- **Real Provider Confirmation**: Only marks actions as `completed` after receiving HTTP 200/201 confirmation with target entity IDs from HubSpot API v3 or Jira Cloud REST API v3.
- **Immutable Audit Trail**: Records structured events in `ApprovalHistory`, `AutomationExecution`, and central `AuditLog`.

---

### 9. Production Readiness, Observability & Deployment Architecture (Phase 5)

DealFlow AI Phase 5 transforms the platform into an enterprise-ready, production-hardened SaaS system with independently scalable services and observability.

```
+---------------------------------------------------------------------------------------------+
|                             PRODUCTION RUNTIME TOPOLOGY                                     |
+---------------------------------------------------------------------------------------------+
               [ Client Traffic ] (HTTPS / TLS 1.3)
                        |
                        v
         +------------------------------+
         |    Nginx Reverse Proxy       |
         |  (SSL, Gzip, Sec Headers)    |
         +--------------+---------------+
                        |
        +---------------+---------------+
        |                               |
        v                               v
+----------------+              +----------------+
| dealflow-client|              |  dealflow-api  |  <--- Scalable API Gateway
| (Vite SPA)     |              | (Express REST) |       (Health / Ready Probes)
+----------------+              +-------+--------+
                                        |
                  +---------------------+---------------------+
                  |                                           |
                  v                                           v
         +------------------+                        +------------------+
         |   MongoDB Atlas  |                        |    Redis Cloud   |
         | (Connection Pool)|                        |  (BullMQ Events) |
         +------------------+                        +--------+---------+
                                                              |
                                                              v
                                                     +------------------+
                                                     | dealflow-worker  | <--- Scalable Worker
                                                     | (Linux Container)|      (Isolated Jobs)
                                                     +------------------+
```

#### 9.1 Independent Service Decoupling
- **API Gateway (`server.js`)**: Handles HTTP requests, authentication, and Socket.IO real-time client events.
- **Background Worker (`worker.js`)**: Independently scalable process consuming the BullMQ `meeting-processing-queue`.
- **Worker Isolation**: Can be scaled horizontally across separate Linux containers or cloud instances without affecting API responsiveness.

#### 9.2 Observability & Telemetry Probes
- **Liveness Probe (`GET /health`)**: High-speed, non-blocking check returning HTTP 200 and process uptime for Kubernetes or Docker swarm orchestrators.
- **Readiness Probe (`GET /ready`)**: Validates database connection state (`dbStatus.state === 'connected'`) and Redis availability before routing traffic.
- **Request Tracing**: Injects and propagates `X-Request-Id` across all HTTP logs and response headers for cross-service distributed debugging.

#### 9.3 AI Usage Analytics & Model Cost Governance
- Tracks token consumption (`promptTokens`, `completionTokens`, `totalTokens`) and audio minutes for every processed meeting.
- Computes accurate estimated costs based on published model rates (`gpt-4o-mini`, `whisper-1`).
- Provides tenant quota dashboards (`GET /api/v1/settings/usage`).

#### 9.4 Data Retention & Privacy Compliance (GDPR / CCPA)
- **Configurable Retention**: Organizations can specify audio, transcript, and insight retention windows (`GET/PATCH /api/v1/settings/data-retention`).
- **Data Takeout Export**: Compiles an organization's complete structured archive via `POST /api/v1/settings/data-export`.
- **Secure Audio Purge**: Automates removal of raw audio binaries older than the configured threshold while preserving business records and audit trails.


