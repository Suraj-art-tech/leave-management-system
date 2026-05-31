import type { FastifyInstance } from 'fastify';
import {
  AppError,
  ROLES,
  SERVICE_NAMES,
  discoverService,
  httpRequest,
  successResponse,
  type User,
} from '@lms/shared';
import { addSystemErrorNotification, notificationStore } from '../store/notificationStore.js';

async function getTeamMemberIds(managerId: string, correlationId: string, token?: string): Promise<string[]> {
  const authUrl = await discoverService(SERVICE_NAMES.AUTH, process.env.AUTH_SERVICE_URL);
  const response = await httpRequest<{ success: boolean; data: User[] }>(
    SERVICE_NAMES.AUTH,
    `${authUrl}/users/${managerId}/team`,
    { correlationId, token }
  );
  return response.data.map((u) => u.employeeId);
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { recipientId: string; message: string; correlationId: string; serviceName?: string } }>(
    '/notifications/system-error',
    {
      schema: {
        body: {
          type: 'object',
          required: ['recipientId', 'message', 'correlationId'],
          properties: {
            recipientId: { type: 'string' },
            message: { type: 'string' },
            correlationId: { type: 'string' },
            serviceName: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const notification = addSystemErrorNotification(request.body);
      return reply.status(201).send(successResponse(notification, request.correlationId));
    }
  );

  app.get('/notifications/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const items = [...notificationStore.values()]
      .filter((n) => n.recipientId === request.user!.employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return reply.send(successResponse(items, request.correlationId));
  });

  app.get<{ Params: { recipientId: string } }>(
    '/notifications/:recipientId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { recipientId } = request.params;
      const user = request.user!;

      if (user.employeeId !== recipientId) {
        if (user.role !== ROLES.MANAGER) {
          throw new AppError(403, 'Forbidden: cannot access notifications for this user');
        }
        const teamIds = await getTeamMemberIds(
          user.employeeId,
          request.correlationId,
          request.headers.authorization?.slice(7)
        );
        if (!teamIds.includes(recipientId)) {
          throw new AppError(403, 'Forbidden: cannot access notifications for this user');
        }
      }

      const items = [...notificationStore.values()]
        .filter((n) => n.recipientId === recipientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return reply.send(successResponse(items, request.correlationId));
    }
  );
}
