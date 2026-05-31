import type { FastifyInstance } from 'fastify';
import {
  AppError,
  EVENTS,
  LEAVE_STATUS,
  ROLES,
  SERVICE_NAMES,
  authorize,
  discoverService,
  httpRequest,
  publishEvent,
  successResponse,
  type LeaveBalance,
  type LeaveEventPayload,
  type LeaveRequest,
  type LeaveType,
  type User,
} from '@lms/shared';
import {
  createLeaveRequest,
  hasOverlap,
  inclusiveDays,
  leaveStore,
  paginate,
  todayUtcDate,
  parseDateOnly,
} from '../store/leaveStore.js';

interface ApplyLeaveBody {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  reportingManagerId: string;
}

async function getUser(employeeId: string, correlationId: string): Promise<User> {
  const authUrl = await discoverService(SERVICE_NAMES.AUTH, process.env.AUTH_SERVICE_URL);
  const response = await httpRequest<{ success: boolean; data: User }>(
    SERVICE_NAMES.AUTH,
    `${authUrl}/users/${employeeId}`,
    { correlationId }
  );
  return response.data;
}

async function getBalance(employeeId: string, correlationId: string, token: string): Promise<LeaveBalance> {
  const employeeUrl = await discoverService(SERVICE_NAMES.EMPLOYEE, process.env.EMPLOYEE_SERVICE_URL);
  const response = await httpRequest<{ success: boolean; data: LeaveBalance }>(
    SERVICE_NAMES.EMPLOYEE,
    `${employeeUrl}/balances/${employeeId}`,
    { correlationId, token }
  );
  return response.data;
}

async function deductBalance(
  employeeId: string,
  leaveType: LeaveType,
  days: number,
  correlationId: string
): Promise<void> {
  const employeeUrl = await discoverService(SERVICE_NAMES.EMPLOYEE, process.env.EMPLOYEE_SERVICE_URL);
  await httpRequest(
    SERVICE_NAMES.EMPLOYEE,
    `${employeeUrl}/balances/deduct`,
    {
      method: 'PUT',
      body: { employeeId, leaveType, days },
      correlationId,
    }
  );
}

function toEventPayload(leave: LeaveRequest): LeaveEventPayload {
  return {
    leaveId: leave.id,
    employeeId: leave.employeeId,
    employeeName: leave.employeeName,
    reportingManagerId: leave.reportingManagerId,
    leaveType: leave.leaveType,
    days: leave.days,
    status: leave.status,
    rejectionReason: leave.rejectionReason,
  };
}

export async function leaveRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ApplyLeaveBody }>(
    '/leaves',
    {
      preHandler: [app.authenticate, authorize(ROLES.EMPLOYEE)],
      schema: {
        body: {
          type: 'object',
          required: ['leaveType', 'startDate', 'endDate', 'days', 'reason', 'reportingManagerId'],
          properties: {
            leaveType: { type: 'string', enum: ['CASUAL', 'SICK', 'PRIVILEGE'] },
            startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            days: { type: 'number', minimum: 1 },
            reason: { type: 'string', minLength: 1 },
            reportingManagerId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const user = request.user!;
      const token = request.headers.authorization!.slice(7);
      const today = todayUtcDate();

      if (parseDateOnly(body.startDate) < today || parseDateOnly(body.endDate) < today) {
        throw new AppError(400, 'Leave dates cannot be in the past');
      }
      if (parseDateOnly(body.startDate) > parseDateOnly(body.endDate)) {
        throw new AppError(400, 'Start date must be before or equal to end date');
      }

      const calculatedDays = inclusiveDays(body.startDate, body.endDate);
      if (body.days !== calculatedDays) {
        throw new AppError(400, `Days must equal inclusive calendar days (${calculatedDays})`);
      }

      if (hasOverlap(user.employeeId, body.startDate, body.endDate)) {
        throw new AppError(409, 'Overlapping leave request exists');
      }

      const manager = await getUser(body.reportingManagerId, request.correlationId);
      if (manager.role !== ROLES.MANAGER) {
        throw new AppError(400, 'Reporting manager must be a valid manager');
      }

      const balance = await getBalance(user.employeeId, request.correlationId, token);
      if (balance.balances[body.leaveType].remaining < body.days) {
        throw new AppError(400, `Insufficient ${body.leaveType} leave balance`);
      }

      const leave = createLeaveRequest({
        employeeId: user.employeeId,
        employeeName: user.name,
        reportingManagerId: body.reportingManagerId,
        leaveType: body.leaveType,
        startDate: body.startDate,
        endDate: body.endDate,
        days: body.days,
        reason: body.reason,
      });

      await publishEvent(EVENTS.LEAVE_APPLIED, toEventPayload(leave), request.correlationId);

      return reply.status(201).send(successResponse(leave, request.correlationId));
    }
  );

  app.get<{ Querystring: { status?: string; page?: string; limit?: string } }>(
    '/leaves/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const page = Number(request.query.page ?? 1);
      const limit = Number(request.query.limit ?? 10);
      let items = [...leaveStore.values()].filter((l) => l.employeeId === request.user!.employeeId);
      if (request.query.status) {
        items = items.filter((l) => l.status === request.query.status);
      }
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return reply.send(successResponse(paginate(items, page, limit), request.correlationId));
    }
  );

  app.get<{ Querystring: { status?: string; employeeId?: string; startDate?: string; endDate?: string; page?: string; limit?: string } }>(
    '/leaves/team',
    { preHandler: [app.authenticate, authorize(ROLES.MANAGER)] },
    async (request, reply) => {
      const page = Number(request.query.page ?? 1);
      const limit = Number(request.query.limit ?? 10);
      let items = [...leaveStore.values()].filter((l) => l.reportingManagerId === request.user!.employeeId);

      if (request.query.status) items = items.filter((l) => l.status === request.query.status);
      if (request.query.employeeId) items = items.filter((l) => l.employeeId === request.query.employeeId);
      if (request.query.startDate) items = items.filter((l) => l.startDate >= request.query.startDate!);
      if (request.query.endDate) items = items.filter((l) => l.endDate <= request.query.endDate!);

      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return reply.send(successResponse(paginate(items, page, limit), request.correlationId));
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/leaves/:id/approve',
    { preHandler: [app.authenticate, authorize(ROLES.MANAGER)] },
    async (request, reply) => {
      const leave = leaveStore.get(request.params.id);
      if (!leave) throw new AppError(404, 'Leave request not found');
      if (leave.reportingManagerId !== request.user!.employeeId) {
        throw new AppError(403, 'Forbidden: not the reporting manager for this request');
      }
      if (leave.status !== LEAVE_STATUS.PENDING) {
        throw new AppError(400, 'Only pending leave requests can be approved');
      }

      await deductBalance(leave.employeeId, leave.leaveType, leave.days, request.correlationId);

      leave.status = LEAVE_STATUS.APPROVED;
      leave.updatedAt = new Date().toISOString();
      leaveStore.set(leave.id, leave);

      await publishEvent(EVENTS.LEAVE_APPROVED, toEventPayload(leave), request.correlationId);

      return reply.send(successResponse(leave, request.correlationId));
    }
  );

  app.patch<{ Params: { id: string }; Body: { reason: string } }>(
    '/leaves/:id/reject',
    {
      preHandler: [app.authenticate, authorize(ROLES.MANAGER)],
      schema: {
        body: {
          type: 'object',
          required: ['reason'],
          properties: { reason: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const leave = leaveStore.get(request.params.id);
      if (!leave) throw new AppError(404, 'Leave request not found');
      if (leave.reportingManagerId !== request.user!.employeeId) {
        throw new AppError(403, 'Forbidden: not the reporting manager for this request');
      }
      if (leave.status !== LEAVE_STATUS.PENDING) {
        throw new AppError(400, 'Only pending leave requests can be rejected');
      }

      leave.status = LEAVE_STATUS.REJECTED;
      leave.rejectionReason = request.body.reason;
      leave.updatedAt = new Date().toISOString();
      leaveStore.set(leave.id, leave);

      await publishEvent(EVENTS.LEAVE_REJECTED, toEventPayload(leave), request.correlationId);

      return reply.send(successResponse(leave, request.correlationId));
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/leaves/:id/cancel',
    { preHandler: [app.authenticate, authorize(ROLES.EMPLOYEE)] },
    async (request, reply) => {
      const leave = leaveStore.get(request.params.id);
      if (!leave) throw new AppError(404, 'Leave request not found');
      if (leave.employeeId !== request.user!.employeeId) {
        throw new AppError(403, 'Forbidden: cannot cancel another employee leave request');
      }
      if (leave.status !== LEAVE_STATUS.PENDING) {
        throw new AppError(400, 'Only pending leave requests can be cancelled');
      }

      leave.status = LEAVE_STATUS.CANCELLED;
      leave.updatedAt = new Date().toISOString();
      leaveStore.set(leave.id, leave);

      await publishEvent(EVENTS.LEAVE_CANCELLED, toEventPayload(leave), request.correlationId);

      return reply.send(successResponse(leave, request.correlationId));
    }
  );
}
