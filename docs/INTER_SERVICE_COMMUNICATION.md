# Inter-Service Communication

## Synchronous (HTTP)

| Caller | Target | Purpose |
|---|---|---|
| api-gateway | auth-service | Login proxy |
| api-gateway | employee-service | Balance queries |
| api-gateway | leave-service | Leave workflow |
| api-gateway | notification-service | Notification queries |
| leave-service | auth-service | Validate reporting manager |
| leave-service | employee-service | Check balance, deduct on approval |
| employee-service | auth-service | Fetch team members for RBAC |

All HTTP calls:
- Resolve target URL via **Consul** (`discoverService`) with env fallback
- Protected by **circuit breaker** (Opossum)
- Carry **`x-correlation-id`** for tracing
- Forward **`Authorization: Bearer`** when acting on behalf of a user

## Asynchronous (RabbitMQ)

| Publisher | Exchange | Routing key | Consumer |
|---|---|---|---|
| leave-service | `leave.events` | `leave.applied` | notification-service |
| leave-service | `leave.events` | `leave.approved` | notification-service |
| leave-service | `leave.events` | `leave.rejected` | notification-service |
| leave-service | `leave.events` | `leave.cancelled` | notification-service |
| any service | HTTP POST | `/notifications/system-error` | notification-service |

Queue: `notification.queue` (durable, bound to all leave.* keys)

## Assumptions

1. Single instance per service (no horizontal scaling in MVP)
2. In-memory stores are not shared; each service owns its data
3. Employee balances are pre-seeded for EMP001 and EMP002 on startup
4. Consul may be unavailable briefly on boot; services fall back to static URLs
5. RabbitMQ connection retries up to 15 times before failing
6. JWT secret is shared across all services via environment variable
7. Internal endpoints (e.g. `/balances/deduct`, `/notifications/system-error`) are reachable within Docker network only
8. System error notifications are logged for authenticated users on HTTP 500 and 503 responses

## Service discovery flow

1. Service starts → registers with Consul (`name`, `address`, `port`, `/health` check)
2. Caller needs auth-service → queries Consul for healthy `auth-service` instances
3. Caller picks instance URL → `http://auth-service:3001`
4. On failure/unhealthy → excluded from discovery results
