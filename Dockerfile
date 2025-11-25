# Multi-stage build for Emby Manager
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

# 使用国内镜像源加速(服务器构建)
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

WORKDIR /app

# Copy frontend files
COPY web ./web

WORKDIR /app/web

# Install dependencies and build
RUN npm ci && npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder

# 使用国内镜像源加速(服务器构建)
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app/server

# Copy backend package files
COPY server/package*.json ./
RUN npm ci

# Copy backend source
COPY server ./

# Generate Prisma client and build TypeScript
RUN npx prisma generate && npm run build

# Stage 3: Production
FROM node:18-alpine

# 使用国内镜像源加速(服务器构建)
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# Install runtime dependencies
RUN apk add --no-cache openssl

WORKDIR /app

# Copy backend files from builder
COPY --from=backend-builder /app/server/package*.json ./
COPY --from=backend-builder /app/server/node_modules ./node_modules
COPY --from=backend-builder /app/server/prisma ./prisma
COPY --from=backend-builder /app/server/dist ./dist

# Copy built frontend to public directory (served by backend)
COPY --from=frontend-builder /app/web/dist ./public

# Create directory for database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Environment variables (will be overridden by docker-compose or -e flags)
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/dev.db
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start server (backend serves frontend static files)
CMD npx prisma migrate deploy && npm start
