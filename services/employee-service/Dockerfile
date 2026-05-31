FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/employee-service/package.json services/employee-service/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/employee-service services/employee-service
RUN npm run build -w @lms/shared && npm run build -w employee-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/services/employee-service ./services/employee-service
WORKDIR /app/services/employee-service
EXPOSE 3002
CMD ["node", "dist/index.js"]
