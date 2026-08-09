# ── Stage 1: Build ──
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build
COPY src ./src
RUN npm run build

# ── Stage 2: Production Runner ──
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy production dependencies and compiled output
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Run as non-root user
USER node

EXPOSE 8081

CMD ["node", "dist/index.js"]
