# Leave Management System — Microservices Backend

Node.js microservices backend for the **Microservices Assignment 2026** (Leave Management Portal).

## Tech stack

- TypeScript + ESM
- Fastify
- Yarn workspaces monorepo
- In-memory data stores
- Consul (service discovery)
- RabbitMQ (async notifications)
- JWT authentication + RBAC
- Docker + Docker Compose

## Prerequisites

- Node.js 20+
- npm 10+ (or Yarn 1.x)
- Docker & Docker Compose

## Quick start (Docker)

Build and run locally:

```bash
docker compose up --build
```

Or pull the pre-built images from Docker Hub and run (no local build):

```bash
docker compose pull
docker compose up
```

Services:

| Service | URL |
|---|---|
| API Gateway | http://localhost:3000 |
| Consul UI | http://localhost:8500 |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |

## Docker Hub images

All service images are published publicly on Docker Hub under [`surajpandey01`](https://hub.docker.com/u/surajpandey01).

| Service | Image |
|---|---|
| auth-service | `surajpandey01/lms-auth-service:1.0.0` |
| employee-service | `surajpandey01/lms-employee-service:1.0.0` |
| leave-service | `surajpandey01/lms-leave-service:1.0.0` |
| notification-service | `surajpandey01/lms-notification-service:1.0.0` |
| api-gateway | `surajpandey01/lms-api-gateway:1.0.0` |

Pull a single image manually:

```bash
docker pull surajpandey01/lms-api-gateway:1.0.0
```

## Local development

```bash
npm install
npm run build -w @lms/shared

# Start infra only
docker compose up consul rabbitmq -d

# Run a service (example)
npm run dev -w auth-service
npm run dev -w api-gateway
```

Build all:

```bash
npm run build
```

## Environment variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Description |
|---|---|
| JWT_SECRET | Shared JWT signing secret |
| CONSUL_HOST / CONSUL_PORT | Consul connection |
| RABBITMQ_URL | RabbitMQ connection string |
| AUTH_SERVICE_URL | Fallback URL for auth-service |
| EMPLOYEE_SERVICE_URL | Fallback URL for employee-service |
| LEAVE_SERVICE_URL | Fallback URL for leave-service |
| NOTIFICATION_SERVICE_URL | Fallback URL for notification-service |

## API testing

1. Import `postman/Leave-Management-System.postman_collection.json` into Postman
2. Run **Login (Employee)** to set the `token` variable
3. Execute remaining requests in order

Full API docs: [docs/API.md](docs/API.md)

## Seed credentials

All users share password: `Password@123`

| Email | Role |
|---|---|
| alice.manager@lms.com | Manager |
| bob.employee@lms.com | Employee |
| carol.employee@lms.com | Employee |

## Demo video

| Scenario | Link |
|---|---|
| Apply leave — success flow | https://youtu.be/cc9Xf20wx-I |
| Rejected leave flow | https://youtu.be/mNyCesjcDxs |

## Project structure

```text
packages/shared/          Shared utilities (JWT, Consul, RabbitMQ, circuit breaker)
services/auth-service/    Authentication & users
services/employee-service/ Leave balances
services/leave-service/    Leave workflow
services/notification-service/ Event-driven notifications
services/api-gateway/      Public API entry point
docs/                      Architecture & API documentation
postman/                   Postman collection
```

## Submission checklist

- [x] Source code
- [x] Architecture document
- [x] API documentation
- [x] Inter-service communication writeup
- [x] Dockerfile per service
- [x] docker-compose.yml
- [x] Postman collection
- [x] Docker Hub image paths (published under `surajpandey01`)
- [x] Demo video recording
- [ ] GitHub repository link
