# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
RUN chown -R appuser:nodejs /usr/src/app
USER appuser
EXPOSE 3000
CMD ["dumb-init", "npm", "run", "dev"]

# Production dependencies stage
FROM base AS production-deps
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force

# Production build stage
FROM base AS production-build
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build || echo "No build step defined"

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=production-deps /usr/src/app/node_modules ./node_modules

# Copy application code
COPY --from=production-build /usr/src/app/src ./src
COPY --from=production-build /usr/src/app/data ./data
COPY --from=production-build /usr/src/app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R appuser:nodejs logs

# Set proper ownership
RUN chown -R appuser:nodejs /usr/src/app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node src/utils/healthCheck.js --json | grep -q '"overall_status":"healthy"' || exit 1

# Expose port
EXPOSE 3000

# Use dumb-init for proper signal handling
CMD ["dumb-init", "node", "src/app.js"]

# Labels for metadata
LABEL maintainer="AnweshaMondal" \
      description="Production-ready Random Fact Generator API" \
      version="1.0.0"