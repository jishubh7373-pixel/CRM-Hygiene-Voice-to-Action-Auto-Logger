# DealFlow AI — Production Deployment Guide

This guide details recommended deployment architectures, container setup, reverse proxy configurations, and release procedures.

---

## 1. Recommended Production Architecture

```
                  [ HTTPS Client Traffic ] (Cloudflare / Route 53)
                              |
                              v
                +----------------------------+
                |    Nginx Reverse Proxy     |
                |  (SSL/TLS Termination,     |
                |   Gzip, Security Headers)  |
                +--------------+-------------+
                               |
               +---------------+---------------+
               |                               |
               v                               v
    +--------------------+           +--------------------+
    |  dealflow-client   |           |    dealflow-api    |
    |  (Static Nginx SPA)|           | (Node.js API GW)   |
    +--------------------+           +---------+----------+
                                               |
                     +-------------------------+-------------------------+
                     |                         |                         |
                     v                         v                         v
           +-------------------+     +-------------------+     +-------------------+
           |   MongoDB Atlas   |     |    Redis Cloud    |     |   Cloudflare R2   |
           |  (Replica Set)    |     | (BullMQ Cluster)  |     |  (Audio Storage)  |
           +-------------------+     +---------+---------+     +-------------------+
                                               |
                                               v
                                     +-------------------+
                                     |  dealflow-worker  |
                                     | (Linux Background |
                                     |  Queue Processor) |
                                     +-------------------+
```

---

## 2. Infrastructure Prerequisites

| Component | Recommended Production Provider | Minimum Sizing |
|---|---|---|
| **API Host** | AWS ECS / DigitalOcean App Platform / Render | 1 vCPU, 2GB RAM |
| **Worker Host** | AWS ECS / DigitalOcean Droplet (Linux) | 2 vCPU, 2GB RAM (scalable) |
| **Database** | MongoDB Atlas (Dedicated M10+) | Replica Set with Automated Backups |
| **Queue / Cache**| Upstash Redis / Redis Cloud / AWS ElastiCache | 256MB+ with persistence enabled |
| **Object Storage**| Cloudflare R2 / AWS S3 | S3-compatible, private bucket |
| **Domain & DNS** | Cloudflare / AWS Route 53 | Full SSL/TLS (Strict Mode) |

---

## 3. Docker Production Deployment

### 3.1 Step 1: Configure Production Environment
Create `server/.env.production` from `server/.env.production.example`:
```bash
cp server/.env.production.example server/.env.production
```
Populate all required variables with real production values:
- `MONGODB_URI`
- `REDIS_HOST` / `REDIS_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `INTEGRATION_ENCRYPTION_KEY`
- `OPENAI_API_KEY`
- `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`

### 3.2 Step 2: Build and Launch Containers
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### 3.3 Step 3: Verify Container Health
```bash
docker compose -f docker-compose.prod.yml ps
```
Ensure all containers report healthy status:
- `dealflow-api-prod` (healthy)
- `dealflow-worker-prod` (running)
- `dealflow-client-prod` (running)
- `dealflow-proxy-prod` (healthy)

### 3.4 Step 4: Validate Health & Readiness Endpoints
```bash
# Liveness probe
curl -f http://localhost:5000/health

# Readiness probe (verifies database connectivity)
curl -f http://localhost:5000/ready
```

---

## 4. Zero-Downtime Rolling Update Procedure

To deploy updates without interrupting active sales meetings or uploads:

1. **Pull new code**:
   ```bash
   git pull origin main
   ```
2. **Rebuild images in background**:
   ```bash
   docker compose -f docker-compose.prod.yml build
   ```
3. **Rolling restart of Worker service**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps worker
   ```
   *Worker gracefully finishes current active meeting jobs before terminating.*
4. **Rolling restart of API service**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps api
   ```
   *Healthcheck ensures the new API container is ready before traffic switches.*
5. **Update Frontend client**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --no-deps client proxy
   ```

---

## 5. Rollback Procedure

If a critical issue is identified post-launch:

1. Identify the previous stable Git commit hash:
   ```bash
   git log --oneline -n 5
   ```
2. Check out the previous stable commit:
   ```bash
   git checkout <PREVIOUS_COMMIT_HASH>
   ```
3. Re-deploy with production Compose:
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```
4. Confirm health via `/ready`:
   ```bash
   curl -f http://localhost:5000/ready
   ```
