# API Documentation

Base URL (via gateway): `http://localhost:3000`

All protected endpoints require: `Authorization: Bearer <token>`

## Auth

### POST /api/auth/login

**Request:**
```json
{
  "email": "bob.employee@lms.com",
  "password": "Password@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "employeeId": "EMP001",
      "name": "Bob Employee",
      "email": "bob.employee@lms.com",
      "role": "Employee",
      "department": "Engineering",
      "managerId": "MGR001"
    }
  },
  "correlationId": "uuid"
}
```

## Leave Balances

### GET /api/balances/me

**Response (200):**
```json
{
  "success": true,
  "data": {
    "employeeId": "EMP001",
    "balances": {
      "CASUAL": { "allocated": 12, "used": 0, "remaining": 12 },
      "SICK": { "allocated": 10, "used": 0, "remaining": 10 },
      "PRIVILEGE": { "allocated": 15, "used": 0, "remaining": 15 }
    }
  },
  "correlationId": "uuid"
}
```

### GET /api/balances/:employeeId

Manager can view team member balances.

## Leave Requests

### POST /api/leaves (Employee only)

**Request:**
```json
{
  "leaveType": "CASUAL",
  "startDate": "2026-06-10",
  "endDate": "2026-06-11",
  "days": 2,
  "reason": "Personal work",
  "reportingManagerId": "MGR001"
}
```

**Response (201):** Leave request with `status: "PENDING"`

### GET /api/leaves/me?status=PENDING&page=1&limit=10

Employee leave history with pagination.

### GET /api/leaves/team?status=PENDING (Manager only)

Team leave requests with optional filters: `employeeId`, `startDate`, `endDate`, `page`, `limit`

### PATCH /api/leaves/:id/approve (Manager only)

Approves pending request, deducts balance, sends notification.

### PATCH /api/leaves/:id/reject (Manager only)

**Request:**
```json
{ "reason": "Insufficient team coverage" }
```

### PATCH /api/leaves/:id/cancel (Employee only)

Cancels a **pending** leave request owned by the authenticated employee. Publishes `leave.cancelled` and notifies employee and manager.

**Response (200):** Leave request with `status: "CANCELLED"`

## Notifications

### GET /api/notifications/me

Returns logged notifications for authenticated user. Includes leave events and system error messages (`system.error` type) when unexpected failures occur.

## Health

### GET /health (each service + gateway)

```json
{
  "status": "UP",
  "service": "api-gateway",
  "timestamp": "2026-05-30T..."
}
```

## Error responses

| Status | Scenario |
|---|---|
| 400 | Validation failure, insufficient balance, invalid dates |
| 401 | Missing/invalid JWT |
| 403 | RBAC violation |
| 404 | Resource not found |
| 409 | Overlapping leave request |
| 503 | Circuit breaker open / dependency unavailable |
| 500 | Unexpected server error |

**Error format:**
```json
{
  "success": false,
  "error": { "message": "Insufficient CASUAL leave balance", "details": null },
  "correlationId": "uuid"
}
```

## Seed users

| Email | Password | Role |
|---|---|---|
| alice.manager@lms.com | Password@123 | Manager |
| bob.employee@lms.com | Password@123 | Employee |
| carol.employee@lms.com | Password@123 | Employee |
