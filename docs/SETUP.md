# DealFlow AI — Developer Setup Guide

This guide provides instructions for setting up DealFlow AI for local development, staging, and containerized execution on both **Windows (PowerShell)** and **Linux/macOS (Bash)**.

---

## 1. Prerequisites

Ensure the following runtimes and tools are installed:

| Tool | Minimum Version | Recommended Version | Verification Command |
|---|---|---|---|
| **Node.js** | `v18.0.0` | `v20.x` or `v22.x` | `node -v` |
| **npm** | `v9.0.0` | `v10.x` | `npm -v` |
| **Git** | `v2.30.0` | Latest | `git --version` |
| **Docker** *(Optional)* | `v24.0` | Latest Docker Desktop | `docker --version` |
| **Docker Compose** *(Optional)* | `v2.20` | Latest | `docker compose version` |

> [!NOTE]
> MongoDB and Redis are **not required** to be installed locally to run development and test suites.
> - **MongoDB**: In development mode, if a local MongoDB daemon is not detected at `mongodb://127.0.0.1:27017`, the server automatically starts a self-contained in-memory database and auto-seeds multi-tenant demo records.
> - **Redis**: If Redis is offline, BullMQ automatically falls back to an asynchronous in-process queue runner.

---

## 2. Repository Installation

Clone the repository and install dependencies for both `server` and `client`:

### Windows PowerShell:
```powershell
# 1. Install backend dependencies
cd server
npm install
cd ..

# 2. Install frontend dependencies
cd client
npm install
cd ..
```

### Linux / macOS:
```bash
# 1. Install backend dependencies
cd server && npm install && cd ..

# 2. Install frontend dependencies
cd client && npm install && cd ..
```

---

## 3. Environment Configuration

Copy the example environment templates:

### Windows PowerShell:
```powershell
Copy-Item server/.env.example server/.env
```

### Linux / macOS:
```bash
cp server/.env.example server/.env
```

### Minimal Development `.env` Configuration:
```ini
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_ACCESS_SECRET=dealflow_default_jwt_access_secret_dev_32char
JWT_REFRESH_SECRET=dealflow_default_jwt_refresh_secret_dev_32char
INTEGRATION_ENCRYPTION_KEY=dealflow_integrations_secret_key_32bytes_hex!!
STORAGE_PROVIDER=local
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
```

---

## 4. Running the Development Application

Run backend and frontend in separate terminals:

### Terminal 1: Backend Express Server (Port 5000)
```powershell
cd server
npm run dev
```
*Server starts with hot-reloading on `http://localhost:5000`.*

### Terminal 2: React + Vite Frontend Client (Port 5173)
```powershell
cd client
npm run dev
```
*Client serves on `http://localhost:5173` with Vite HMR.*

### Terminal 3 *(Optional)*: Standalone Background Worker
```powershell
cd server
npm run worker:dev
```
*Listens to BullMQ queue jobs independently for horizontal worker scaling.*

---

## 5. Pre-Seeded Demonstration Accounts

When starting with an in-memory database or after running `npm run seed --prefix server`, the following test tenants are available:

### Tenant 1: Acme Cloud Technologies (Domain: `acmecloud.com`)
- **Admin Account**:
  - Email: `admin@acmecloud.com`
  - Password: `Password123!`
  - Role: `admin` (Full tenant control, team invites, integrations, approval governance)
- **Sales Rep Account**:
  - Email: `sarah.rep@acmecloud.com`
  - Password: `Password123!`
  - Role: `rep` (Meeting ingestion, audio playback, view deals, propose actions)

### Tenant 2: Global Retail Corp (Domain: `globalretail.com`)
- **Admin Account**:
  - Email: `admin@globalretail.com`
  - Password: `Password123!`
  - Role: `admin` (Isolated tenant for testing boundary enforcement)

---

## 6. Running Automated Tests

Execute the complete test suite (80 tests across 14 test suites):

```powershell
cd server
npm test
```

To run a specific test suite:
```powershell
# Run production readiness tests
node ./node_modules/jest/bin/jest.js tests/productionReadiness.test.js

# Run approval center tests
node ./node_modules/jest/bin/jest.js tests/automationApproval.test.js

# Run safe execution tests
node ./node_modules/jest/bin/jest.js tests/automationExecution.test.js
```

---

## 7. Containerized Development with Docker Compose

To run the full stack (API, Worker, MongoDB, Redis, Client, Nginx) inside Docker:

```powershell
# Build and start all services
docker compose up --build -d

# Check status of containers
docker compose ps

# View live API logs
docker compose logs -f api

# Tear down containers and volumes
docker compose down -v
```
Access the application at `http://localhost:80`.
