FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY web web
RUN npm run build --workspace web

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/web/package.json ./web/package.json
COPY --from=build /app/web/.next ./web/.next
COPY --from=build /app/web/next.config.mjs ./web/next.config.mjs

EXPOSE 3000
USER node
CMD ["npm", "run", "start", "--workspace", "web"]
