# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install security updates and dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Build stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM base AS runtime

# Copy built dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=nextjs:nodejs . .

# Create logs directory with correct permissions
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

# Build args for version info
ARG VERSION=0.0.0
ARG BRANCH=unknown
ARG COMMIT=unknown
ARG BUILD=0

# Set version environment variables
ENV VERSION=${VERSION} \
    BRANCH=${BRANCH} \
    COMMIT=${COMMIT} \
    BUILD=${BUILD} \
    NODE_ENV=production \
    PORT=3000

# Use non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
