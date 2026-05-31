FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/notification-service/package.json services/notification-service/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/notification-service services/notification-service
RUN npm run build -w @lms/shared && npm run build -w notification-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/services/notification-service ./services/notification-service
WORKDIR /app/services/notification-service
EXPOSE 3004
CMD ["node", "dist/index.js"]
