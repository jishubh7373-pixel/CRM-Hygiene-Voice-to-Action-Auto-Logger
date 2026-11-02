# DealFlow AI — Environment Configuration Reference

This document provides a breakdown of all environment variables used across DealFlow AI services.

---

## 1. Environment Classification

| Environment | Purpose | Validation Strictness | Storage Provider |
|---|---|---|---|
| `development` | Local development and rapid prototyping | Relaxed; uses safe local fallbacks | `local` |
| `test` | Automated test runner execution (Jest) | In-memory databases; zero network calls | `local` |
| `staging` | Pre-production testing on cloud infrastructure | Full production validation | `s3` |
| `production` | Live production SaaS deployment | **Strict fail-fast**; zero development defaults allowed | `s3` |

---

## 2. Environment Variables Matrix

### 2.1 Core Application
| Variable Name | Required in Prod? | Default (Dev) | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Runtime environment (`development`, `test`, `production`). |
| `PORT` | No | `5000` | HTTP port for the Express API gateway. |
| `CLIENT_URL` | Yes | `http://localhost:5173` | Allowed origin for CORS headers. Must match public frontend domain in production. |

### 2.2 Database & Cache
| Variable Name | Required in Prod? | Default (Dev) | Description |
|---|---|---|---|
| `MONGODB_URI` | **Yes** | `mongodb://127.0.0.1:27017/dealflow_ai` | MongoDB connection URI. In production, must be a replica-set connection string (e.g. MongoDB Atlas). |
| `REDIS_HOST` | No | `127.0.0.1` | Redis host for BullMQ queues and worker coordination. |
| `REDIS_PORT` | No | `6379` | Redis port. |
| `REDIS_PASSWORD` | Optional | `""` | Redis authentication password. |
| `REDIS_URL` | Optional | `undefined` | Full Redis connection string (`rediss://...` for TLS). Overrides host/port. |

### 2.3 Authentication & Cryptographic Vault
| Variable Name | Required in Prod? | Default (Dev) | Security Constraint |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | **Yes** | `dealflow_default_...` | High-entropy string (min 32 chars). Must be randomized in prod. |
| `JWT_REFRESH_SECRET` | **Yes** | `dealflow_default_...` | High-entropy string (min 32 chars). Must be distinct from access secret. |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Lifetime of access tokens. |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Lifetime of refresh tokens. |
| `INTEGRATION_ENCRYPTION_KEY` | **Yes** | `dealflow_integrations_...` | 32-byte hexadecimal key for AES-256-GCM vault encryption. |

> [!CAUTION]
> The server will **refuse to start** in `production` mode if `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, or `INTEGRATION_ENCRYPTION_KEY` contain default development substrings.

### 2.4 OpenAI API & Model Configuration
| Variable Name | Required in Prod? | Default (Dev) | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Optional in Dev / Required for AI | `""` | OpenAI API key with permissions for Whisper and Chat Completions. |
| `OPENAI_TRANSCRIPTION_MODEL` | No | `whisper-1` | Model ID for voice transcription. |
| `OPENAI_ANALYSIS_MODEL` | No | `gpt-4o-mini` | Model ID for meeting structured intelligence extraction. |

### 2.5 Audio Storage Abstraction
| Variable Name | Required in Prod? | Default (Dev) | Description |
|---|---|---|---|
| `STORAGE_PROVIDER` | Yes | `local` | Storage driver (`local` or `s3`). Set to `s3` in production. |
| `LOCAL_STORAGE_PATH` | No | `uploads/audio` | Filesystem folder for local storage mode. |
| `MAX_AUDIO_UPLOAD_MB` | No | `25` | Maximum allowed audio upload size in megabytes. |
| `S3_BUCKET_NAME` | If S3 | `""` | AWS S3 or Cloudflare R2 bucket name. |
| `S3_REGION` | If S3 | `us-east-1` | S3 region. |
| `S3_ACCESS_KEY_ID` | If S3 | `""` | S3 IAM access key ID. |
| `S3_SECRET_ACCESS_KEY` | If S3 | `""` | S3 IAM secret access key. |
| `S3_ENDPOINT` | Optional | `undefined` | Custom S3 endpoint for Cloudflare R2, MinIO, or Wasabi. |

### 2.6 External Integrations (OAuth & Webhooks)
| Variable Name | Required in Prod? | Description |
|---|---|---|
| `ZOOM_CLIENT_ID` | Optional | Zoom OAuth App Client ID. |
| `ZOOM_CLIENT_SECRET` | Optional | Zoom OAuth App Client Secret. |
| `ZOOM_WEBHOOK_SECRET` | Optional | Secret token for validating `x-zm-signature` HMAC-SHA256 headers. |
| `ZOOM_REDIRECT_URI` | Optional | OAuth callback URL for Zoom. |
| `GONG_ACCESS_KEY` | Optional | Gong API v2 Access Key. |
| `GONG_CLIENT_SECRET` | Optional | Gong API v2 Client Secret. |
| `GONG_BASE_URL` | Optional | Gong API base URL (default: `https://api.gong.io`). |
| `HUBSPOT_CLIENT_ID` | Optional | HubSpot App Client ID. |
| `HUBSPOT_CLIENT_SECRET` | Optional | HubSpot App Client Secret. |
| `HUBSPOT_REDIRECT_URI` | Optional | OAuth callback URL for HubSpot. |
| `HUBSPOT_SCOPES` | Optional | OAuth scopes for HubSpot CRM objects. |
| `JIRA_CLIENT_ID` | Optional | Atlassian OAuth App Client ID. |
| `JIRA_CLIENT_SECRET` | Optional | Atlassian OAuth App Client Secret. |
| `JIRA_REDIRECT_URI` | Optional | OAuth callback URL for Jira Cloud. |
| `JIRA_SCOPES` | Optional | 3LO OAuth scopes for Jira issues. |

---

## 3. Secret Generation Helper

Generate production-grade cryptographic secrets with Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run this 3 times to generate unique keys for:
1. `JWT_ACCESS_SECRET`
2. `JWT_REFRESH_SECRET`
3. `INTEGRATION_ENCRYPTION_KEY`
