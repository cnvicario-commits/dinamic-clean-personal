# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 10001 dinamic \
  && useradd --system --uid 10001 --gid dinamic --home-dir /app --shell /usr/sbin/nologin dinamic
COPY --from=build --chown=dinamic:dinamic /app/package.json /app/package-lock.json ./
COPY --from=build --chown=dinamic:dinamic /app/node_modules ./node_modules
COPY --from=build --chown=dinamic:dinamic /app/dist ./dist
USER dinamic
EXPOSE 3001
CMD ["node", "dist/index.js"]
