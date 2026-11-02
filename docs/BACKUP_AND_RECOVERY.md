# DealFlow AI — Backup, Recovery & Disaster Recovery Runbook

This document details the backup policies, snapshot schedules, and disaster recovery procedures for DealFlow AI.

---

## 1. Data Classification & RPO / RTO Targets

| Data Tier | Components | RPO Target (Max Data Loss) | RTO Target (Max Downtime) |
|---|---|---|---|
| **Tier 1 (Critical)** | MongoDB (Organizations, Users, Meetings, Deals, Insights, Actions, Audit Logs) | **< 1 hour** (Continuous Oplog PITR) | **< 30 minutes** |
| **Tier 2 (Media)** | S3 / R2 Object Storage (Original Audio Recordings) | **< 24 hours** (Cross-region replication) | **< 2 hours** |
| **Tier 3 (Transient)**| Redis (BullMQ Queues & Caching) | **< 15 minutes** (AOF / RDB persistence) | **< 10 minutes** (Auto-restart) |

---

## 2. Backup Strategy & Schedules

### 2.1 MongoDB Backups (Database Tier)
- **Point-in-Time Recovery (PITR)**: Enable Continuous Cloud Backups in MongoDB Atlas with a 7-day oplog recovery window.
- **Automated Daily Snapshots**: Retained for 30 days.
- **Weekly Snapshots**: Retained for 90 days.
- **Monthly Snapshots**: Retained for 365 days.
- **Manual Dump Command** (for self-hosted or off-site archiving):
  ```bash
  mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/dealflow_ai" --gzip --archive=/backups/dealflow_$(date +%Y%m%d_%H%M%S).archive.gz
  ```

### 2.2 Audio Storage Backups (Media Tier)
- Enable **Bucket Versioning** and **Cross-Region Replication (CRR)** on the AWS S3 or Cloudflare R2 bucket.
- **Lifecycle Rule**: Move raw audio recordings to Infrequent Access (IA) after 90 days, or apply tenant data retention purges via `POST /api/v1/settings/purge-audio`.

---

## 3. Database Restoration Procedures

### 3.1 Scenario A: MongoDB Atlas Point-in-Time Restore (UI)
1. Navigate to **MongoDB Atlas** ➔ **Clusters** ➔ **Backup**.
2. Click **Restore** ➔ Select **Point-in-Time Recovery**.
3. Select target timestamp (to the minute before the incident).
4. Restore to a new dedicated cluster or stage cluster first to verify data integrity before pointing application DNS.

### 3.2 Scenario B: Manual CLI Archive Restore
To restore an archive backup to a target database:

```bash
# 1. Stop API traffic or set maintenance mode
docker compose -f docker-compose.prod.yml stop api worker

# 2. Execute mongorestore
mongorestore --uri="mongodb://mongodb:27017/dealflow_ai" --gzip --archive=/backups/dealflow_20261101_120000.archive.gz --drop

# 3. Start services and verify readiness
docker compose -f docker-compose.prod.yml start api worker
curl http://localhost:5000/ready
```

---

## 4. Disaster Recovery Testing Runbook

Test restoration quarterly in a non-production environment:

1. Provision an isolated staging MongoDB database.
2. Restore the latest daily production snapshot into staging.
3. Start the DealFlow AI test suite against the restored database:
   ```powershell
   cd server
   $env:MONGODB_URI="mongodb://staging-test-host:27017/dealflow_ai"
   npm test
   ```
4. Verify that:
   - Tenant isolation holds true.
   - User credentials and hashed passwords authenticate.
   - Meetings and transcript segments load accurately.
   - Audit logs reflect pre-incident history.
5. Document restoration completion time and any discrepancies in the DR log.
