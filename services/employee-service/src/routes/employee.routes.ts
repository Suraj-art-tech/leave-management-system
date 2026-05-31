import type { FastifyInstance } from 'fastify';
import {
  AppError,
  ROLES,
  SERVICE_NAMES,
  authorize,
  discoverService,
  httpRequest,
  successResponse,
  type LeaveType,
  type User,
} from '@lms/shared';
import {
  balanceStore,
  canAccessEmployee,
  createLeaveBalance,
  deductBalance,
} from '../store/balanceStore.js';

async function getTeamMemberIds(managerId: string, correlationId: string, token?: string): Promise<string[]> {
  const authUrl = await discoverService(SERVICE_NAMES.AUTH, process.env.AUTH_SERVICE_URL);
  const response = await httpRequest<{ success: boolean; data: User[] }>(
    SERVICE_NAMES.AUTH,
    `${authUrl}/users/${managerId}/team`,
    { correlationId, token }
  );
  return response.data.map((u) => u.employeeId);
}

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/balances/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const balance = balanceStore.get(request.user!.employeeId);
    if (!balance) throw new AppError(404, 'Leave balance not found');
    return reply.send(successResponse(balance, request.correlationId));
  });

  app.get<{ Params: { employeeId: string } }>(
    '/balances/:employeeId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { employeeId } = request.params;
      let teamIds: string[] = [];
      if (request.user!.role === ROLES.MANAGER) {
        teamIds = await getTeamMemberIds(
          request.user!.employeeId,
          request.correlationId,
          request.headers.authorization?.slice(7)
        );
      }

      if (!canAccessEmployee(request.user!, employeeId, teamIds)) {
        throw new AppError(403, 'Forbidden: cannot access this employee balance');
      }

      const balance = balanceStore.get(employeeId);
      if (!balance) throw new AppError(404, 'Leave balance not found');
      return reply.send(successResponse(balance, request.correlationId));
    }
  );

  app.post<{ Body: { employeeId: string } }>(
    '/employees',
    {
      schema: {
        body: {
          type: 'object',
          required: ['employeeId'],
          properties: { employeeId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { employeeId } = request.body;
      if (balanceStore.has(employeeId)) {
        throw new AppError(409, 'Employee balance already exists');
      }
      const balance = createLeaveBalance(employeeId);
      balanceStore.set(employeeId, balance);
      return reply.status(201).send(successResponse(balance, request.correlationId));
    }
  );

  app.put<{ Body: { employeeId: string; leaveType: LeaveType; days: number } }>(
    '/balances/deduct',
    {
      schema: {
        body: {
          type: 'object',
          required: ['employeeId', 'leaveType', 'days'],
          properties: {
            employeeId: { type: 'string' },
            leaveType: { type: 'string', enum: ['CASUAL', 'SICK', 'PRIVILEGE'] },
            days: { type: 'number', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { employeeId, leaveType, days } = request.body;
      try {
        const balance = deductBalance(employeeId, leaveType, days);
        return reply.send(successResponse(balance, request.correlationId));
      } catch (err) {
        throw new AppError(400, (err as Error).message);
      }
    }
  );
}
