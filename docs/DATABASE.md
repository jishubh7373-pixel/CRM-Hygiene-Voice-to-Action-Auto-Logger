# DealFlow AI — Database Architecture & Schema Reference

DealFlow AI utilizes MongoDB with Mongoose for structured multi-tenant persistence.

---

## 1. Database Tenancy & Indexing Architecture

All collections (excluding system-level administration) enforce a **compound tenancy indexing strategy** to guarantee query performance, uniqueness scoping, and zero data leakage.

```
                             +------------------------+
                             |   Organization Model   |
                             |  (Tenant Root Record)  |
                             +-----------+------------+
                                         | 1:N
        +------------------+-------------+-------------+------------------+
        |                  |                           |                  |
        v                  v                           v                  v
+---------------+  +---------------+           +---------------+  +---------------+
|   User Model  |  | Meeting Model |           |   Deal Model  |  |Integration Mod|
+---------------+  +-------+-------+           +-------+-------+  +---------------+
                           | 1:N                       |
                +----------+----------+                |
                |                     |                |
                v                     v                |
        +---------------+     +---------------+        |
        |TranscriptSegm |     | MeetingInsight|        |
        +---------------+     +-------+-------+        |
                                      |                |
                                      +--------+-------+
                                               |
                                               v
                                      +------------------+
                                      | AutomationAction |
                                      +--------+---------+
                                               | 1:N
                                      +--------+---------+
                                      |                  |
                                      v                  v
                              +---------------+  +---------------+
                              |ApprovalHistory|  |AutomationExec |
                              +---------------+  +---------------+
```

---

## 2. Collections & Schema Index Reference

### 2.1 `organizations`
- `_id`: ObjectId
- `name`: String (required)
- `domain`: String (unique, indexed)
- `plan`: String (`starter`, `professional`, `enterprise`)
- `status`: String (`active`, `suspended`)
- **Indexes**:
  - `{ domain: 1 }` (unique)

### 2.2 `users`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `name`: String (required)
- `email`: String (required, unique, lowercase)
- `password`: String (hashed, select: false)
- `role`: String (`admin`, `manager`, `rep`, `sales_ops`)
- **Indexes**:
  - `{ email: 1 }` (unique)
  - `{ organizationId: 1, role: 1 }`

### 2.3 `meetings`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `title`: String (required)
- `source`: String (`audio_upload`, `zoom`, `gong`, `manual`)
- `status`: String (`draft`, `scheduled`, `in_progress`, `completed`, `cancelled`)
- `processingStatus`: String (`pending`, `transcribing`, `analyzing`, `completed`, `failed`)
- `dealId`: ObjectId (optional, ref: `Deal`, indexed)
- `durationSeconds`: Number
- `audioStorage`: `{ provider, key, bucket, sizeBytes, mimeType }`
- **Indexes**:
  - `{ organizationId: 1, createdAt: -1 }`
  - `{ organizationId: 1, dealId: 1 }`
  - `{ organizationId: 1, processingStatus: 1 }`
  - `{ organizationId: 1, externalCallId: 1 }` (sparse)

### 2.4 `transcriptsegments`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `meetingId`: ObjectId (required, indexed)
- `segmentIndex`: Number (required)
- `speaker`: String
- `text`: String (required)
- `startTime`: Number (seconds)
- `endTime`: Number (seconds)
- **Indexes**:
  - `{ organizationId: 1, meetingId: 1, segmentIndex: 1 }`
  - `{ meetingId: 1, startTime: 1 }`

### 2.5 `meetinginsights`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `meetingId`: ObjectId (required, unique per tenant)
- `summary`: `{ executiveSummary, purpose, situation, decisions, unresolvedQuestions, nextSteps }`
- `decisionCriteria`: Array of `{ category, requirement, priority, evidenceQuote }`
- `buyingSignals`: Array of `{ signal, strength, category, evidenceQuote, timestamp }`
- `objections`: Array of `{ objection, severity, raisedBy, status, suggestedMitigation }`
- `risks`: Array of `{ risk, severity, impact, mitigation }`
- `competitors`: Array of `{ name, context, weaknesses, strengths, displacementRisk }`
- `dealHealth`: `{ totalScore, band, scores, rationale }`
- `modelMetadata`: `{ transcriptionModel, analysisModel, promptTokens, completionTokens, totalTokens }`
- **Indexes**:
  - `{ organizationId: 1, meetingId: 1 }` (unique)

### 2.6 `deals`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `ownerId`: ObjectId (required, ref: `User`, indexed)
- `name`: String (required)
- `accountName`: String (required)
- `amount`: Number (required)
- `stage`: String (`discovery`, `qualification`, `demo`, `proposal`, `negotiation`, `closed_won`, `closed_lost`)
- `closeDate`: Date (required)
- `healthScore`: `{ score, band, lastAssessedAt }`
- **Indexes**:
  - `{ organizationId: 1, stage: 1 }`
  - `{ organizationId: 1, ownerId: 1 }`
  - `{ organizationId: 1, closeDate: 1 }`

### 2.7 `automationactions`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `meetingId`: ObjectId (required, indexed)
- `dealId`: ObjectId (optional, indexed)
- `actionType`: String (`hubspot_update_deal`, `hubspot_create_note`, `jira_create_issue`)
- `targetSystem`: String (`hubspot`, `jira`)
- `approvalStatus`: String (`pending_approval`, `approved`, `rejected`, `cancelled`)
- `executionStatus`: String (`idle`, `queued`, `executing`, `completed`, `failed`)
- `confidenceScore`: Number
- `confidenceBand`: String (`high`, `medium`, `low`)
- **Indexes**:
  - `{ organizationId: 1, approvalStatus: 1, createdAt: -1 }`
  - `{ organizationId: 1, meetingId: 1 }`
  - `{ organizationId: 1, targetSystem: 1 }`

### 2.8 `approvalhistories`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `actionId`: ObjectId (required, indexed)
- `eventType`: String (indexed)
- `performedBy`: ObjectId (ref: `User`)
- `timestamp`: Date (default: Date.now)
- **Indexes**:
  - `{ organizationId: 1, actionId: 1, timestamp: -1 }`

### 2.9 `automationexecutions`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `actionId`: ObjectId (required, indexed)
- `idempotencyKey`: String (unique per action execution)
- `status`: String (`executing`, `completed`, `failed`)
- **Indexes**:
  - `{ organizationId: 1, actionId: 1 }`
  - `{ idempotencyKey: 1 }`

### 2.10 `auditlogs`
- `_id`: ObjectId
- `organizationId`: ObjectId (required, indexed)
- `userId`: ObjectId (ref: `User`, indexed)
- `action`: String (required, indexed)
- `entityType`: String (required)
- `entityId`: String (required)
- `createdAt`: Date (indexed)
- **Indexes**:
  - `{ organizationId: 1, createdAt: -1 }`
  - `{ organizationId: 1, entityType: 1, entityId: 1 }`

---

## 3. Connection Pooling & Production Sizing

In `server/src/config/db.js`, Mongoose initializes with production connection options:

```javascript
const mongooseOptions = {
  maxPoolSize: 50,          // Maintain up to 50 socket connections
  minPoolSize: 10,          // Keep at least 10 sockets warm
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,                // Use IPv4
};
```
