FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY server/prisma server/prisma
COPY server/tsconfig.json server/tsconfig.json
COPY server/src server/src
COPY server/test-e2e.ts server/test-e2e.ts
RUN npm run db:generate --workspace server
RUN npm run build --workspace server

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma

EXPOSE 4000
USER node
CMD ["node", "server/dist/index.js"]
