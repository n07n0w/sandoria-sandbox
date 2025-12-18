FROM node:18-alpine AS base
RUN apk update && apk upgrade && \
  apk add --no-cache dumb-init curl && \
  addgroup -g 1001 -S nodejs && \
  adduser -S nextjs -u 1001

WORKDIR /app
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs
ARG VERSION=0.0.0
ARG BRANCH=unknown
ARG COMMIT=unknown
ARG BUILD=0
ENV VERSION=${VERSION} \
  BRANCH=${BRANCH} \
  COMMIT=${COMMIT} \
  BUILD=${BUILD} \
  NODE_ENV=production \
  PORT=3000
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
