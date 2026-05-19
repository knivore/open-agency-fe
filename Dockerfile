FROM node:22.9.0-alpine3.20 AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm ci


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

ARG AZURE_OPENAI_API_KEY
ENV AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY

ARG AZURE_OPENAI_ENDPOINT
ENV AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT

ARG DEPLOYMENT_NAME
ENV DEPLOYMENT_NAME=$DEPLOYMENT_NAME

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner

# DL3018 warning: Pin versions in apk add. Instead of `apk add <package>` use `apk add <package>=<version>`
RUN apk add --update \
    curl \
    openssl \
    aws-cli

WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/certs/ ./certs
COPY --from=builder --chown=nextjs:nodejs /app/startup.sh ./

RUN ls -la
USER nextjs

RUN chmod 755 /app/startup.sh

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["sh", "/app/startup.sh"]
