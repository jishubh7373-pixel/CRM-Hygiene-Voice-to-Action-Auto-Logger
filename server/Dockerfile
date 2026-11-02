# ==========================================
# DealFlow AI — Backend API Production Dockerfile
# Multi-Stage Build with Non-Root Security
# ==========================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S dealflow && \
    adduser -u 1001 -S dealflow -G dealflow

# Copy production dependencies and application files
COPY --chown=dealflow:dealflow --from=dependencies /app/node_modules ./node_modules
COPY --chown=dealflow:dealflow package*.json ./
COPY --chown=dealflow:dealflow server.js ./
COPY --chown=dealflow:dealflow worker.js ./
COPY --chown=dealflow:dealflow src/ ./src/

# Create uploads directory with appropriate permissions
RUN mkdir -p /app/uploads/audio && chown -R dealflow:dealflow /app/uploads

USER dealflow

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
