# DealFlow AI — Troubleshooting & Incident Response Runbook

This runbook covers diagnosis, debugging, and recovery procedures for common operational issues in DealFlow AI.

---

## 1. Quick Diagnostic Triage

Run these diagnostic commands to assess system health:

```bash
# 1. Check API Liveness
curl -I http://localhost:5000/health

# 2. Check Database & Redis Readiness
curl http://localhost:5000/ready

# 3. Check Worker & Queue Metrics
curl -H "Authorization: Bearer <ADMIN_TOKEN>" http://localhost:5000/api/v1/health
```

---

## 2. Common Operational Issues & Solutions

### 2.1 "Operation `organizations.findOne()` buffering timed out after 10000ms"
- **Cause**: The Express application cannot connect to the configured MongoDB URI (`MONGODB_URI`), or the replica set primary is unreachable.
- **Solution**:
  1. In local development: ensure `MONGODB_URI` points to a reachable MongoDB instance, or leave it blank in `NODE_ENV=development` to let the auto-contained in-memory server initialize.
  2. In production: verify IP access whitelist in MongoDB Atlas Network Security tab (ensure the container or server IP is allowed).
  3. Verify connection string format: `mongodb+srv://<user>:<password>@cluster.mongodb.net/dealflow_ai?retryWrites=true&w=majority`.

### 2.2 Redis Connection Notice: "Operating in degraded queue mode"
- **Behavior**: DealFlow AI does **not crash** when Redis is offline. It logs a warning and shifts BullMQ into a direct asynchronous queue runner (`dispatched_async_runner`).
- **Solution**:
  1. Check Redis container/daemon: `docker compose ps redis` or `redis-cli ping`.
  2. Verify `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` match your Redis server.
  3. If using TLS (e.g. AWS ElastiCache), specify `REDIS_URL=rediss://...`.

### 2.3 OpenAI Error: "OpenAI API key is not configured in backend environment variables"
- **Cause**: `OPENAI_API_KEY` is empty in `.env`.
- **Solution**:
  1. Add a valid OpenAI API key to `server/.env`:
     ```ini
     OPENAI_API_KEY=sk-proj-...
     ```
  2. Restart the server or worker container. Note that automated test suites use mock providers and do not require real OpenAI keys.

### 2.4 Audio Upload Error: "Unsupported file type or magic byte signature mismatch"
- **Cause**: The uploaded file extension does not match its internal binary magic bytes, or the format is not in the supported list (MP3, WAV, M4A, MP4).
- **Solution**:
  1. Verify the audio file is genuinely encoded as MP3 (`ID3` header), WAV (`RIFF....WAVE`), or MP4 (`ftyp` box).
  2. Check upload size limits (`MAX_AUDIO_UPLOAD_MB`). Default limit is 25MB. Increase in `.env` if processing multi-hour recordings.

### 2.5 Action Execution Error: "Execution aborted due to stale record state"
- **Cause**: DealFlow AI's safety engine detected that the deal's `amount` or `stage` in HubSpot changed externally after the AI proposal was generated.
- **Solution**:
  1. This is an intentional safeguard preventing DealFlow AI from overwriting concurrent CRM edits made by another team member.
  2. In the Approval Center (`/approvals`), click **Edit** on the proposed action, verify the new CRM values, and re-approve.

### 2.6 CORS Error: "CORS origin blocked by policy"
- **Cause**: Request sent from an origin not matching `CLIENT_URL` in `production` mode.
- **Solution**:
  1. Set `CLIENT_URL=https://app.yourdomain.com` in `server/.env.production`.
  2. Ensure reverse proxy passes proper `Host` and `X-Forwarded-For` headers.

---

## 3. Worker Process Restart Runbook

If the background queue worker stops consuming jobs:

```bash
# Docker Compose:
docker compose -f docker-compose.prod.yml restart worker

# View worker logs:
docker compose -f docker-compose.prod.yml logs -f --tail=100 worker
```
BullMQ jobs will automatically retry using exponential backoff (attempt 1: immediate, attempt 2: +3s, attempt 3: +6s).
