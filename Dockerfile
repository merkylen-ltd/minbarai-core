# Ultra-slim Dockerfile for Next.js on Google Cloud Run
# Optimized for minimal attack surface, maximum performance, and ultra-low latency

# Stage 1: Dependencies - Ultra-minimal base
FROM node:18-alpine AS deps
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    && apk add --no-cache libc6-compat \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*
WORKDIR /app

# Copy package files with exact versions
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --no-audit --no-fund --prefer-offline \
    && npm cache clean --force \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Stage 2: Builder - Optimized build environment
FROM node:18-alpine AS builder
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build arguments
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_PRICE_ID
ARG NEXT_PUBLIC_VOICEFLOW_WS_URL
ARG NEXT_PUBLIC_VOICEFLOW_WS_TOKEN
ARG NEXT_PUBLIC_SITE_URL
ARG NEXTAUTH_URL

# Set environment variables for optimized build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Set build arguments as environment variables
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PRICE_ID=$NEXT_PUBLIC_STRIPE_PRICE_ID
ENV NEXT_PUBLIC_VOICEFLOW_WS_URL=$NEXT_PUBLIC_VOICEFLOW_WS_URL
ENV NEXT_PUBLIC_VOICEFLOW_WS_TOKEN=$NEXT_PUBLIC_VOICEFLOW_WS_TOKEN
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Build with optimizations
RUN npm run build \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/* /app/node_modules \
    && mkdir -p /app/.next/cache

# Stage 3: Ultra-slim Runtime - Alpine-based for better compatibility
FROM node:18-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Set environment variables for runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Copy built application with proper ownership
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public assets directly from build context to ensure availability
COPY --chown=nextjs:nodejs public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/cache ./.next/cache

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start the application with proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--max-old-space-size=1024", "server.js"]
