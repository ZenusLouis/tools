FROM node:22-alpine AS builder
WORKDIR /app

COPY apps/dashboard/package*.json ./
RUN npm ci --ignore-scripts

COPY apps/dashboard/ ./
COPY AGENTS.md /data/AGENTS.md
COPY agents.toml /data/agents.toml
COPY agents /data/agents
COPY .agents /data/.agents
COPY .claude /data/.claude
COPY .codex /data/.codex
COPY skills /data/skills
COPY projects /data/projects
COPY memory /data/memory
COPY logs /data/logs
COPY mcp /data/mcp
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /data /data

USER node

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
