# Architecture — Leave Management System

## Overview

Node.js microservices backend for employee leave management. TypeScript, ESM, Fastify, in-memory stores, Consul discovery, RabbitMQ notifications.

---

## 1. High-level system architecture

![High-level system architecture](diagrams/01-high-level-architecture.png)

<details>
<summary>Show Mermaid source</summary>

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        POSTMAN[Postman / API Client]
    end

    subgraph Gateway["API Gateway :3000"]
        GW[Fastify Gateway<br/>JWT validation · RBAC · Proxy<br/>Circuit Breaker · Correlation ID]
    end

    subgraph Services["Microservices"]
        AUTH[auth-service<br/>:3001<br/>Users · Login · JWT]
        EMP[employee-service<br/>:3002<br/>Leave balances · Deduction]
        LEAVE[leave-service<br/>:3003<br/>Leave workflow · Validations]
        NOTIF[notification-service<br/>:3004<br/>Notification log store]
    end

    subgraph Infra["Infrastructure"]
        CONSUL[(Consul :8500<br/>Service Registry)]
        RMQ[(RabbitMQ :5672<br/>Exchange: leave.events)]
    end

    subgraph Data["In-memory data per service"]
        D1[(userStore)]
        D2[(balanceStore)]
        D3[(leaveStore)]
        D4[(notificationStore)]
    end

    POSTMAN -->|HTTPS REST| GW

    GW -->|HTTP sync| AUTH
    GW -->|HTTP sync| EMP
    GW -->|HTTP sync| LEAVE
    GW -->|HTTP sync| NOTIF

    LEAVE -->|HTTP sync| AUTH
    LEAVE -->|HTTP sync| EMP
    EMP -->|HTTP sync| AUTH

    LEAVE -->|publish leave.*| RMQ
    RMQ -->|consume| NOTIF

    AUTH -.->|register / discover| CONSUL
    EMP -.->|register / discover| CONSUL
    LEAVE -.->|register / discover| CONSUL
    NOTIF -.->|register / discover| CONSUL
    GW -.->|discover| CONSUL

    AUTH --- D1
    EMP --- D2
    LEAVE --- D3
    NOTIF --- D4

    GW & AUTH & EMP & LEAVE -.->|system-error HTTP| NOTIF
```

</details>

---

## 2. Service responsibilities

| Service | Port | Responsibility |
|---|---|---|
| **api-gateway** | 3000 | Public API entry, JWT validation, RBAC, HTTP proxy via Consul, circuit breaker |
| **auth-service** | 3001 | User store, login, JWT issuance, team lookup |
| **employee-service** | 3002 | Leave balance allocation (12/10/15), balance queries, deduction on approval |
| **leave-service** | 3003 | Apply / history / team view / approve / reject / cancel, validations, event publishing |
| **notification-service** | 3004 | Consumes RabbitMQ events, stores notification log entries, system-error logging |
| **Consul** | 8500 | Service registration, health checks, discovery |
| **RabbitMQ** | 5672 | Async messaging for leave lifecycle notifications |

---

## 3. Synchronous request flow (Approve leave)

![Approve leave sequence](diagrams/02-approve-leave-sequence.png)

<details>
<summary>Show Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    actor M as Manager (Alice)
    participant GW as API Gateway
    participant C as Consul
    participant L as leave-service
    participant E as employee-service
    participant R as RabbitMQ
    participant N as notification-service

    M->>GW: PATCH /api/leaves/{id}/approve<br/>Authorization: Bearer JWT
    GW->>GW: Validate JWT + Manager role
    GW->>C: Discover leave-service
    C-->>GW: http://leave-service:3003
    GW->>L: PATCH /leaves/{id}/approve
    L->>L: Verify pending + reporting manager
    L->>C: Discover employee-service
    L->>E: PUT /balances/deduct
    E-->>L: Updated balance
    L->>L: Set status APPROVED
    L->>R: Publish leave.approved
    R-->>N: Deliver event
    N->>N: Log notification for employee
    L-->>GW: 200 Approved leave
    GW-->>M: 200 Response
```

</details>

---

## 4. Asynchronous notification flow

![Asynchronous notification flow](diagrams/03-async-notification-flow.png)

<details>
<summary>Show Mermaid source</summary>

```mermaid
flowchart LR
    subgraph Publisher
        LS[leave-service]
    end

    subgraph Broker
        EX{{leave.events<br/>topic exchange}}
        Q[notification.queue]
    end

    subgraph Consumer
        NS[notification-service]
        STORE[(notificationStore)]
    end

    LS -->|leave.applied| EX
    LS -->|leave.approved| EX
    LS -->|leave.rejected| EX
    LS -->|leave.cancelled| EX

    EX --> Q
    Q --> NS
    NS --> STORE

    CLIENT[Client] -->|GET /api/notifications/me| STORE
```

</details>

| Event | Recipients notified |
|---|---|
| `leave.applied` | Employee + Manager |
| `leave.approved` | Employee |
| `leave.rejected` | Employee (with reason) |
| `leave.cancelled` | Employee + Manager |
| `system.error` (HTTP) | Authenticated user (on 500/503) |

---

## 5. Service discovery & health checks

![Service discovery and health checks](diagrams/04-service-discovery.png)

<details>
<summary>Show Mermaid source</summary>

```mermaid
flowchart TD
    START([Service starts]) --> REG[Register with Consul<br/>name · address · port]
    REG --> HC[Health check every 10s<br/>GET /health]
    HC -->|UP| PASS[Marked healthy in Consul]
    HC -->|DOWN| FAIL[Excluded from discovery]

    CALLER[Calling service / gateway] --> DISC[discoverService]
    DISC --> CONSUL[(Consul)]
    CONSUL -->|healthy instance| URL[Return service URL]
    CONSUL -->|none found| FALLBACK[Use env fallback URL<br/>AUTH_SERVICE_URL etc.]
    URL --> HTTP[HTTP request + circuit breaker]
    FALLBACK --> HTTP
```

</details>

---

## 6. Cross-cutting concerns

![Cross-cutting concerns](diagrams/05-cross-cutting-mindmap.png)

<details>
<summary>Show Mermaid source</summary>

```mermaid
mindmap
  root((Cross-cutting))
    Authentication
      JWT signed by auth-service
      Verified at gateway and services
      userId role expiration
    Authorization
      Employee own data
      Manager team data
    Resilience
      Opossum circuit breaker
      Consul health checks
      Env URL fallback
    Observability
      Pino structured logging
      x-correlation-id tracing
      Global error envelope
    Notifications
      RabbitMQ async events
      System error log entries
```

</details>

| Concern | Implementation |
|---|---|
| **Authentication** | JWT signed by auth-service, verified by gateway and all protected services |
| **Authorization** | Role-based (Employee / Manager) enforced per endpoint |
| **Service discovery** | Consul registration + `/health` checks every 10s |
| **Circuit breaker** | Opossum on all outbound HTTP (gateway + inter-service) |
| **Distributed tracing** | `x-correlation-id` header propagated across all calls |
| **Logging** | Pino (Fastify) JSON structured logs |
| **Global errors** | Consistent `{ success, error, correlationId }` envelope |
| **Notifications** | RabbitMQ log entries + HTTP system-error endpoint (no email/SMS) |

---

## 7. Deployment architecture (Docker Compose)

![Deployment architecture](diagrams/06-deployment.png)

<details>
<summary>Show Mermaid source</summary>

```mermaid
flowchart TB
    subgraph DockerCompose["docker compose up --build"]
        subgraph AppServices
            GW2[api-gateway :3000]
            A2[auth-service :3001]
            E2[employee-service :3002]
            L2[leave-service :3003]
            N2[notification-service :3004]
        end
        subgraph SharedInfra
            C2[consul :8500]
            R2[rabbitmq :5672 / :15672]
        end
    end

    HOST[Developer machine<br/>localhost:3000] --> GW2
    GW2 --- A2 & E2 & L2 & N2
    A2 & E2 & L2 & N2 --- C2
    L2 & N2 --- R2
```

</details>

---

## 8. Data storage

In-memory `Map` stores per service, seeded on startup. No external database.

| Service | Store | Seed data |
|---|---|---|
| auth-service | `userStore` | MGR001, EMP001, EMP002 |
| employee-service | `balanceStore` | Balances for EMP001, EMP002 |
| leave-service | `leaveStore` | Empty (populated on apply) |
| notification-service | `notificationStore` | Empty (populated by events) |

### Leave allocation (automatic on employee create)

| Type | Days |
|---|---|
| Casual | 12 |
| Sick | 10 |
| Privilege | 15 |

---

## 9. Public API surface (via gateway)

All routes prefixed with `/api` except `/health`.

![Public API surface](diagrams/07-public-api-surface.png)

<details>
<summary>Show Mermaid source</summary>

```mermaid
flowchart LR
    subgraph Auth
        L1[POST /auth/login]
    end
    subgraph Balances
        B1[GET /balances/me]
        B2[GET /balances/:employeeId]
    end
    subgraph Leaves
        LV1[POST /leaves]
        LV2[GET /leaves/me]
        LV3[GET /leaves/team]
        LV4[PATCH /leaves/:id/approve]
        LV5[PATCH /leaves/:id/reject]
        LV6[PATCH /leaves/:id/cancel]
    end
    subgraph Notifications
        N1[GET /notifications/me]
    end

    GW3[API Gateway :3000] --> Auth & Balances & Leaves & Notifications
```

</details>

---

## 10. ASCII diagram (plain-text fallback)

```text
                         +-------------+
                         |   Client    |
                         +------+------+
                                |
                                v
                         +-------------+
                         | API Gateway | :3000
                         | JWT + Proxy |
                         +------+------+
                                |
            +-------------------+-------------------+
            |                   |                   |
            v                   v                   v
     +-------------+    +-------------+    +------------------+
     | auth-service|    |employee-svc |    |  leave-service   |
     |    :3001    |    |    :3002     |    |      :3003       |
     +------+------+    +------+------+    +---------+--------+
            |                   |                    |
            |                   |                    | publish
            |                   |                    v
            |                   |           +------------------+
            |                   |           |    RabbitMQ      |
            |                   |           +---------+--------+
            |                   |                     |
            |                   |                     v
            |                   |           +------------------+
            |                   |           | notification-svc |
            |                   |           |      :3004       |
            +-------------------+-----------+------------------+
                                |
                         +------+------+
                         |   Consul    | :8500
                         |  registry   |
                         +-------------+
```
