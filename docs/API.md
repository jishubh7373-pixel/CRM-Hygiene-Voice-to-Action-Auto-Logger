# DealFlow AI — REST API Documentation (v1)

Base URL: `/api/v1`

All protected endpoints require an `Authorization` header formatted as:
`Authorization: Bearer <access_token>`

For media streaming (HTML5 `<audio>` tags), query string authentication is also accepted:
`GET /meetings/:id/audio?token=<access_token>`

---

### 1. Observability, Health & Telemetry
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Liveness probe: returns service status (`ok`), uptime, and timestamp. |
| `GET` | `/ready` | Public | Readiness probe: validates database connection and redis availability before traffic routing. |
| `GET` | `/api/v1/health` | Public | Deep component diagnostics: reports MongoDB, Redis, and BullMQ queue metrics. |
| `GET` | `/api/v1/ready` | Public | Standard versioned readiness probe. |


---

### 2. Authentication & Tenancy
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new Organization and first Admin user. |
| `POST` | `/auth/login` | Public | Authenticate user, receive JWT access token + refresh token. |
| `POST` | `/auth/refresh-token`| Public | Exchange valid refresh token for a new access token. |
| `POST` | `/auth/logout` | Authenticated | Revoke refresh token and invalidate session. |
| `GET` | `/auth/me` | Authenticated | Returns current authenticated user and organization profile. |

---

### 3. Meetings & Voice Intelligence (Phase 2)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/meetings` | Authenticated | List all meetings for the tenant with filters (`status`, `processingStatus`, `platform`, `search`). |
| `POST` | `/meetings/upload` | Authenticated | Upload MP3/WAV/M4A/MP4 audio file via multipart form, initiate Whisper transcription and AI intelligence. |
| `POST` | `/meetings` | Authenticated | Create a meeting note manually. |
| `GET` | `/meetings/:id` | Authenticated | Get full meeting metadata, status, and summary. |
| `GET` | `/meetings/:id/audio` | Authenticated | Securely stream meeting audio with HTTP Range requests (supports header or `?token=`). |
| `GET` | `/meetings/:id/transcript` | Authenticated | Retrieve ordered transcript segments with start/end timestamps and speaker tags. |
| `GET` | `/meetings/:id/insights` | Authenticated | Get structured AI meeting intelligence, 7-dimension deal health score, and evidence quotes. |
| `PATCH`| `/meetings/:id/insights` | Authenticated | Human review: edit executive summary fields and certify findings with reviewer audit trail. |
| `POST` | `/meetings/:id/reprocess` | Authenticated | Re-enqueue meeting for audio transcription and intelligence extraction. |
| `PATCH`| `/meetings/:id` | Authenticated | Update meeting record details. |
| `DELETE`| `/meetings/:id`| Authenticated (`admin`, `manager`) | Delete meeting and all associated audio, transcript segments, and insights. |

---

### 4. Deals & Pipeline Intelligence
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/deals` | Authenticated | List all tenant deals, hygiene health statuses, and risk factors. |
| `POST` | `/deals` | Authenticated | Create new deal record. |
| `GET` | `/deals/:id` | Authenticated | Get deal details and associated action items. |
| `GET` | `/deals/:id/intelligence`| Authenticated | Get synthesized multi-meeting voice intelligence, aggregate 7-dimension score, criteria, and risks. |
| `PATCH`| `/deals/:id` | Authenticated | Update deal stage, amount, or close date. |

---

### 5. Action Items & Commitments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/actions` | Authenticated | List action items across all tenant deals/meetings with filters (`status`, `priority`). |
| `POST` | `/actions` | Authenticated | Create new action commitment. |
| `PATCH`| `/actions/:id/status` | Authenticated | Update action status (`pending`, `completed`) or sync to CRM (`crmSyncStatus: 'synced'`). |
| `DELETE`| `/actions/:id` | Authenticated (`admin`, `manager`) | Delete action commitment item. |

---

### 6. External Integrations (Phase 3: Zoom, Gong, HubSpot, Jira)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/integrations` | Authenticated | List all 4 provider integrations with verified connection status, health, and metadata. |
| `GET` | `/integrations/:provider/status` | Authenticated | Get detailed connection and health status for a specific provider. |
| `GET` | `/integrations/:provider/auth-url` | Authenticated | Generate cryptographically signed OAuth 2.0 authorization URL (`hubspot`, `jira`). |
| `POST` | `/integrations/:provider/callback` | Authenticated | Exchange OAuth authorization code for tokens, encrypt with AES-256-GCM. |
| `POST` | `/integrations/:provider/test` | Authenticated | Perform live API health check against provider endpoints. |
| `POST` | `/integrations/:provider/disconnect` | Authenticated (`admin`) | Disconnect provider and purge encrypted credentials. |
| `POST` | `/integrations/gong/configure` | Authenticated (`admin`) | Save and verify Gong API v2 credentials (`accessKey`, `clientSecret`, `baseUrl`). |
| `POST` | `/integrations/gong/import` | Authenticated | Ingest completed calls with date range filters, cursor pagination, and monologue transcripts. |
| `POST` | `/integrations/hubspot/sync` | Authenticated | Bi-directional deal synchronization, stage mapping, and `DealMapping` persistence. |
| `GET` | `/integrations/hubspot/deals` | Authenticated | Preview deals directly from HubSpot API v3. |
| `GET` | `/integrations/hubspot/pipelines` | Authenticated | Retrieve HubSpot pipelines and deal stages for field mapping. |
| `GET` | `/integrations/jira/sites` | Authenticated | Query accessible Jira Cloud sites (`/oauth/token/accessible-resources`). |
| `GET` | `/integrations/jira/projects` | Authenticated | Query projects in Jira Cloud site. |
| `POST` | `/integrations/jira/configure` | Authenticated (`admin`) | Save default site ID, project key, and issue type ID. |
| `POST` | `/integrations/jira/test-issue` | Authenticated | Create verified test task using Atlassian Document Format (ADF) via REST API v3. |
| `POST` | `/integrations/zoom/configure` | Authenticated (`admin`) | Configure Zoom credentials, Account ID, and Webhook secret token. |

---

### 7. External Webhooks
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/webhooks/zoom` | Public (Signed) | Official Zoom Webhook handler. Responds to `endpoint.url_validation` HMAC challenge, validates `v0:timestamp:payload` HMAC-SHA256 signature, and ingests `recording.completed` events. |
| `POST` | `/webhooks/gong` | Public (Signed) | Ingests Gong webhook notifications for newly completed calls. |

---

### 8. Human Approval Center & Workflow Automation (Phase 4)
Base URL: `/api/v1/automation`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/automation/actions` | Authenticated | List all proposed, approved, and executed actions with filters (`approvalStatus`, `actionType`, `targetSystem`, `meetingId`, `dealId`, `search`). |
| `GET` | `/automation/actions/stats` | Authenticated | Summary statistics (pending, approved, rejected, executed counts, high-confidence counts). |
| `POST` | `/automation/actions/generate/:meetingId` | Authenticated | Manually trigger AI action proposal extraction for a completed meeting. |
| `GET` | `/automation/actions/:id` | Authenticated | Get full details for an action proposal, including verbatim transcript quotes, evidence confidence, and diff. |
| `POST` | `/automation/actions/:id/approve` | Authenticated (`admin`, `manager`, `sales_ops`) | Explicitly approve a proposed action for external execution. |
| `POST` | `/automation/actions/:id/reject` | Authenticated (`admin`, `manager`, `sales_ops`) | Reject a proposed action with mandatory reason. |
| `PATCH`| `/automation/actions/:id` | Authenticated (`admin`, `manager`, `sales_ops`) | Edit proposed action payload. Note: Material modification of an already approved action automatically revokes approval and resets status to `pending_approval`. |
| `POST` | `/automation/actions/:id/execute` | Authenticated (`admin`, `manager`, `sales_ops`) | Execute an approved action against external provider (HubSpot or Jira). Requires `approvalStatus === 'approved'`. |
| `GET` | `/automation/actions/:id/history` | Authenticated | Retrieve immutable timeline of all proposal events, reviews, edits, and status transitions. |
| `GET` | `/automation/executions` | Authenticated | List execution audit log records with provider confirmation IDs and timestamps. |
| `GET` | `/automation/settings` | Authenticated | Get tenant automation configuration and approval policies. |
| `PATCH`| `/automation/settings` | Authenticated (`admin`) | Update tenant automation policies, auto-proposal rules, and minimum confidence thresholds. |

---

### 9. Settings, Governance & Privacy (Phase 5)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/settings/organization` | Authenticated | Fetch organization preferences and plan. |
| `PATCH`| `/settings/organization`| Authenticated (`admin`) | Update organization preferences. |
| `GET` | `/settings/team` | Authenticated | List team members in the tenant. |
| `POST` | `/settings/team/invite` | Authenticated (`admin`) | Invite new user with designated role. |
| `GET` | `/settings/audit-logs` | Authenticated (`admin`) | View immutable audit trail for compliance. |
| `GET` | `/settings/usage` | Authenticated | Retrieve AI token consumption, transcribed audio minutes, and model-based cost estimates. |
| `GET` | `/settings/data-retention` | Authenticated (`admin`) | Fetch tenant data retention limits (audio, transcripts, insights). |
| `PATCH`| `/settings/data-retention`| Authenticated (`admin`) | Update tenant data retention policy and auto-purge settings. |
| `POST` | `/settings/data-export` | Authenticated (`admin`) | Export complete organization archive (GDPR / CCPA data takeout). |
| `POST` | `/settings/purge-audio` | Authenticated (`admin`) | Manually trigger retention policy check to purge expired audio files. |


---

### 10. Real-Time Socket.IO Events
Connection URL: `ws://localhost:5000` (or proxied via Vite `/socket.io`)
Auth: Handshake auth token `{ auth: { token: '<access_token>' } }`
Room: Automatic tenant scoping `org:<organizationId>`

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `meeting:created` | Server -> Client | `{ meetingId, title, processingStatus }` | Emitted when audio upload commences. |
| `meeting:status` | Server -> Client | `{ meetingId, stage, status, progress }` | Pipeline stage transitions (`transcribing`, `analyzing`, `completed`, `failed`). |
| `meeting:transcript` | Server -> Client | `{ meetingId, segmentCount }` | Emitted upon Whisper transcript completion. |
| `meeting:insights` | Server -> Client | `{ meetingId, insights }` | Emitted upon AI structured intelligence extraction. |
| `meeting:error` | Server -> Client | `{ meetingId, stage, error }` | Pipeline failure notification. |
| `action-item:created`| Server -> Client | `{ meetingId, count }` | Emitted when AI commits new action items. |
| `automation:action:created` | Server -> Client | `{ meetingId, actionCount }` | Emitted when new action proposals are generated for human review. |
| `automation:action:status` | Server -> Client | `{ actionId, approvalStatus, executionStatus }` | Emitted upon approval, rejection, or edit of an action. |
| `automation:action:executed`| Server -> Client | `{ actionId, executionId, status, providerResponse }` | Emitted upon execution completion against external provider. |

