FROM node:20-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN npm ci

COPY . .
RUN npx prisma generate --schema=packages/backend/prisma/schema.prisma
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Prisma CLI is retained because the container applies the schema on startup.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=build /app/packages/frontend/dist ./packages/frontend/dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --schema=packages/backend/prisma/schema.prisma --skip-generate && node packages/backend/dist/server.js"]
