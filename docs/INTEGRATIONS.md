# DealFlow AI — External Integrations Architecture & Guide

DealFlow AI connects with four core enterprise platforms:
1. **Zoom** (Live RTMS voice streams & completed recording webhooks)
2. **Gong** (API v2 call imports & monologue transcripts)
3. **HubSpot CRM** (OAuth 2.0 deal synchronization, pipeline mapping, and meeting notes)
4. **Atlassian Jira Cloud** (3LO OAuth issue creation in Atlassian Document Format)

---

## 1. Zoom Integration

### 1.1 Capabilities
- **Real-Time Media Streams (RTMS)**: Captures live audio packets during customer sales calls, buffers speaker segments, and routes finalized audio into the transcription pipeline.
- **Webhook Recording Ingestion**: Automatically ingests `recording.completed` events, downloads MP4/M4A recordings, and queues AI intelligence processing.

### 1.2 Developer Configuration
- **Zoom App Type**: Server-to-Server OAuth or General OAuth App.
- **Required Scopes**:
  - `meeting:read`
  - `recording:read`
- **Webhook Endpoint**: `https://api.yourdomain.com/api/v1/webhooks/zoom`
- **Webhook Secret Token**: Configure in Zoom Marketplace and set `ZOOM_WEBHOOK_SECRET` in `.env`.
- **Validation**: Automatically responds to Zoom's `endpoint.url_validation` HMAC-SHA256 challenge.

---

## 2. Gong Integration

### 2.1 Capabilities
- **API v2 Call Import**: Queries calls across configurable date ranges using cursor pagination.
- **Transcript Extraction**: Fetches synchronized monologues and sentences via `POST /v2/calls/transcript` and converts them into standard `TranscriptSegment` documents.
- **Deduplication**: Tracks `externalCallId` to guarantee that duplicate imports are safely skipped without redundant AI processing.

### 2.2 Developer Configuration
- **Base URL**: `https://api.gong.io`
- **Authentication**: Basic Authentication using `GONG_ACCESS_KEY` and `GONG_CLIENT_SECRET`.
- **Required Permissions**: Access to Workspace Call data and Transcripts in Gong Company Settings.

---

## 3. HubSpot CRM Integration

### 3.1 Capabilities
- **OAuth 2.0 Authorization**: PKCE-compatible OAuth flow with encrypted refresh tokens and automatic 2-minute pre-expiration token refresh.
- **Deal Synchronization**: Bi-directional syncing mapping internal deals to HubSpot deal properties (`dealname`, `amount`, `dealstage`, `closedate`).
- **Meeting Notes Association**: Posts structured AI meeting summaries as CRM notes associated directly to target deals (`associationTypeId: 214`).
- **Safe Deal Updates**: Executes verified `PATCH /crm/v3/objects/deals/:id` only after explicit human approval, with pre-flight stale data detection.

### 3.2 Developer Configuration
- **HubSpot App Type**: Public App in HubSpot Developer Portal.
- **Required Scopes**:
  - `crm.objects.deals.read`
  - `crm.objects.deals.write`
  - `crm.objects.contacts.read`
  - `crm.schemas.deals.read`
- **Redirect URI**: `https://api.yourdomain.com/api/v1/integrations/hubspot/callback`

---

## 4. Atlassian Jira Cloud Integration

### 4.1 Capabilities
- **OAuth 2.0 (3LO)**: User-authorized 3-legged OAuth with offline access refresh tokens.
- **Cloud Site & Project Discovery**: Queries accessible Atlassian Cloud sites (`/oauth/token/accessible-resources`) and project keys.
- **Atlassian Document Format (ADF)**: Formats action deliverables and meeting commitments into compliant structured ADF JSON for Jira Cloud REST API v3.
- **Issue Creation**: Creates Tasks and Stories in target projects with due dates, assignees, and traceability links back to the original meeting.

### 4.2 Developer Configuration
- **Atlassian App Type**: OAuth 2.0 (3LO) in Atlassian Developer Console.
- **Required Scopes**:
  - `read:jira-work`
  - `write:jira-work`
  - `read:jira-user`
  - `offline_access`
- **Redirect URI**: `https://api.yourdomain.com/api/v1/integrations/jira/callback`

---

## 5. Integration Verification Status

| Integration | Sandbox Available | Connection Status Verification | Mock Test Coverage | Live Verification Notes |
|---|---|---|---|---|
| **Zoom** | Developer Account | Verified via `tests/zoomIntegration.test.js` | 100% Passed | HMAC verification & challenge response tested. |
| **Gong** | API v2 Sandbox | Verified via `tests/gongIntegration.test.js` | 100% Passed | Monologue ingestion & deduplication tested. |
| **HubSpot** | Developer Portal | Verified via `tests/hubspotIntegration.test.js` & `tests/automationExecution.test.js` | 100% Passed | Token refresh & deal patching verified. |
| **Jira Cloud** | Atlassian Cloud | Verified via `tests/jiraIntegration.test.js` & `tests/automationExecution.test.js` | 100% Passed | ADF formatting & issue generation verified. |
