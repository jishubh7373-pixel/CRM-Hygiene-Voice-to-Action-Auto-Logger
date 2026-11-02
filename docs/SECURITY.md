# DealFlow AI — Application Security & Threat Model

This document outlines the security controls, cryptographic implementations, and threat mitigation architecture of DealFlow AI.

---

## 1. Security Architecture & Threat Model

DealFlow AI operates on a **Zero-Trust Multi-Tenancy** security model. Every request is verified, scoped, and checked against tenant boundaries.

```
+-----------------------------------------------------------------------------------+
|                            DEFENSE-IN-DEPTH PIPELINE                              |
+-----------------------------------------------------------------------------------+
 [ Ingress ] -> TLS 1.3 / Strict HTTPS
 [ Edge ]    -> Rate Limiting (50 req / 15m on Auth) + Helmet Security Headers
 [ App GW ]  -> Correlation IDs (X-Request-Id) + NoSQL Injection Operator Sanitizer
 [ Auth ]    -> JWT Access Token (15m) + Rotating Refresh Token (7d)
 [ Tenancy ] -> enforceTenantIsolation Middleware (req.organizationId binding)
 [ RBAC ]    -> authorize(['admin', 'manager', 'sales_ops'])
 [ Vault ]   -> AES-256-GCM Authenticated Encryption for OAuth Secrets
 [ Audio ]   -> Private Storage + Authenticated Byte-Range Streaming
 [ Data ]    -> Immutable AuditLog & ApprovalHistory Ledgers
+-----------------------------------------------------------------------------------+
```

---

## 2. Authentication & Session Security

### 2.1 Password Security
- **Algorithm**: `bcryptjs` with salt round factor `10`.
- **Validation**: Minimum 8 characters, requiring uppercase, lowercase, numbers, and special symbols.
- **Leakage Prevention**: Mongoose `User` schema defines `password: { select: false }`. Passwords are never serialized into API responses or audit logs.

### 2.2 JWT & Token Lifecycle
- **Access Tokens**: Short-lived (15 minutes), signed using HMAC-SHA256 (`JWT_ACCESS_SECRET`). Payload strictly contains `{ userId, organizationId, role }`.
- **Refresh Tokens**: Long-lived (7 days), stored securely in database with SHA-256 token hashing.
- **Replay & Reuse Revocation**: If a revoked or already-exchanged refresh token is presented, all refresh tokens for that user session are immediately invalidated.

---

## 3. Multi-Tenant Data Isolation (Zero-Trust)

1. **Schema-Level Enforcement**:
   Every business entity (`Meeting`, `TranscriptSegment`, `MeetingInsight`, `Deal`, `ActionItem`, `Integration`, `AutomationAction`, `ApprovalHistory`, `AutomationExecution`, `AuditLog`) defines:
   ```javascript
   organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }
   ```
2. **Context Binding**:
   The `enforceTenantIsolation` middleware binds `req.organizationId = req.user.organizationId` directly from the validated JWT claims.
3. **Query Scoping**:
   All database read and write queries universally include `{ organizationId: req.organizationId }`.
4. **Automated Verification**:
   100% verified by automated test suites (`tests/tenantIsolation.test.js`, `tests/automationApproval.test.js`). Cross-tenant access attempts return HTTP 404 or 403.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Resource / Endpoint | `admin` | `manager` | `sales_ops` | `rep` |
|---|---|---|---|---|
| View Dashboard & Meetings | Allowed | Allowed | Allowed | Allowed |
| Upload Meeting Audio | Allowed | Allowed | Allowed | Allowed |
| View Transcripts & AI Insights | Allowed | Allowed | Allowed | Allowed |
| Create & View Deals | Allowed | Allowed | Allowed | Allowed |
| View Action Proposals | Allowed | Allowed | Allowed | Allowed |
| **Approve / Reject Action Proposals** | **Allowed** | **Allowed** | **Allowed** | **403 Forbidden** |
| **Edit Proposed Action Payload** | **Allowed** | **Allowed** | **Allowed** | **403 Forbidden** |
| **Execute Action to HubSpot / Jira** | **Allowed** | **Allowed** | **Allowed** | **403 Forbidden** |
| Manage Team & Invite Members | **Allowed** | 403 Forbidden | 403 Forbidden | 403 Forbidden |
| Connect / Disconnect Integrations | **Allowed** | 403 Forbidden | 403 Forbidden | 403 Forbidden |
| Configure Automation Policies | **Allowed** | 403 Forbidden | 403 Forbidden | 403 Forbidden |
| View Audit Logs | **Allowed** | 403 Forbidden | 403 Forbidden | 403 Forbidden |
| Export Organization Data (GDPR) | **Allowed** | 403 Forbidden | 403 Forbidden | 403 Forbidden |

---

## 5. Cryptographic Vault for External Credentials

All third-party integration secrets (Zoom OAuth tokens, Gong API keys, HubSpot tokens, Jira tokens) are protected using **AES-256-GCM authenticated encryption**:

- **Cipher**: `aes-256-gcm`
- **Key**: 32-byte secret (`INTEGRATION_ENCRYPTION_KEY`)
- **Initialization Vector (IV)**: 12-byte cryptographically random IV generated per encryption
- **Authentication Tag**: 16-byte GCM authentication tag preventing ciphertext tampering
- **Storage Format**: `iv:authTag:encryptedData`
- **Zero Exposure**: Decrypted tokens are never serialized into API responses or logged to stdout.

---

## 6. API Security & Injection Defense

### 6.1 NoSQL Operator Injection Sanitization
Express middleware recursively inspects `req.body`, `req.query`, and `req.params`. Any keys beginning with `$` (e.g. `$where`, `$gt`, `$ne`, `$regex`) or containing `.` are stripped before reaching controller logic.

### 6.2 Security Headers (Helmet)
- `X-Content-Type-Options: nosniff` (Prevents MIME sniffing attacks)
- `X-Frame-Options: DENY` (Clickjacking prevention)
- `X-XSS-Protection: 1; mode=block`
- `Cross-Origin-Resource-Policy: cross-origin` (Allows authenticated media streaming)

### 6.3 CORS Policy
- Allowed origins are strictly locked to `CLIENT_URL` in production mode.
- Requests with unauthorized origins in production are rejected with `403 Forbidden`.

### 6.4 Rate Limiting
- `express-rate-limit` enforces a threshold of 50 login/registration requests per 15-minute window per IP to prevent brute-force credential stuffing.

### 6.5 Webhook Signature Verification
- **Zoom Webhooks**: Validates `x-zm-signature` against `v0:${timestamp}:${rawBody}` using `ZOOM_WEBHOOK_SECRET` with HMAC-SHA256 and a 5-minute replay freshness window. Responds to `endpoint.url_validation` HMAC challenge requests.

---

## 7. Safe Logging & Data Redaction

The custom production logger (`server/src/utils/logger.js`) inspects all logged metadata objects and recursively masks sensitive fields:
- `password`
- `token` / `accessToken` / `refreshToken`
- `clientSecret` / `apiKey`
- `authorization`
- `secretAccessKey`
- `encryptionKey`
- `webhookSecret`

Masked values are replaced with `[REDACTED]` prior to serialization.
