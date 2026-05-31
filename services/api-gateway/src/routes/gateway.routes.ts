import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  ROLES,
  SERVICE_NAMES,
  authorize,
  discoverService,
  httpRequest,
  successResponse,
} from '@lms/shared';

async function proxyTo(
  request: FastifyRequest,
  reply: FastifyReply,
  serviceName: string,
  fallbackEnv: string,
  targetPath: string,
  method?: string,
  body?: unknown
) {
  const fallback = process.env[fallbackEnv];
  const baseUrl = await discoverService(serviceName, fallback);
  const token = request.headers.authorization?.startsWith('Bearer ')
    ? request.headers.authorization.slice(7)
    : undefined;

  const result = await httpRequest<unknown>(serviceName, `${baseUrl}${targetPath}`, {
    method: method ?? request.method,
    body,
    correlationId: request.correlationId,
    token,
  });

  return reply.send(result);
}

export async function gatewayRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request, reply) => {
    return reply.send(
      successResponse(
        {
          name: 'Leave Management System API Gateway',
          version: '1.0.0',
          health: '/health',
          endpoints: {
            login: 'POST /api/auth/login',
            myBalance: 'GET /api/balances/me',
            applyLeave: 'POST /api/leaves',
            myLeaves: 'GET /api/leaves/me',
            teamLeaves: 'GET /api/leaves/team',
            approveLeave: 'PATCH /api/leaves/:id/approve',
            rejectLeave: 'PATCH /api/leaves/:id/reject',
            cancelLeave: 'PATCH /api/leaves/:id/cancel',
            notifications: 'GET /api/notifications/me',
          },
        },
        request.correlationId
      )
    );
  });

  app.post('/api/auth/login', async (request, reply) => {
    return proxyTo(request, reply, SERVICE_NAMES.AUTH, 'AUTH_SERVICE_URL', '/login', 'POST', request.body);
  });

  app.get('/api/balances/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    return proxyTo(request, reply, SERVICE_NAMES.EMPLOYEE, 'EMPLOYEE_SERVICE_URL', '/balances/me');
  });

  app.get<{ Params: { employeeId: string } }>(
    '/api/balances/:employeeId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      return proxyTo(
        request,
        reply,
        SERVICE_NAMES.EMPLOYEE,
        'EMPLOYEE_SERVICE_URL',
        `/balances/${request.params.employeeId}`
      );
    }
  );

  app.post('/api/leaves', { preHandler: [app.authenticate, authorize(ROLES.EMPLOYEE)] }, async (request, reply) => {
    return proxyTo(request, reply, SERVICE_NAMES.LEAVE, 'LEAVE_SERVICE_URL', '/leaves', 'POST', request.body);
  });

  app.get('/api/leaves/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = new URLSearchParams(request.query as Record<string, string>).toString();
    const path = `/leaves/me${query ? `?${query}` : ''}`;
    return proxyTo(request, reply, SERVICE_NAMES.LEAVE, 'LEAVE_SERVICE_URL', path);
  });

  app.get('/api/leaves/team', { preHandler: [app.authenticate, authorize(ROLES.MANAGER)] }, async (request, reply) => {
    const query = new URLSearchParams(request.query as Record<string, string>).toString();
    const path = `/leaves/team${query ? `?${query}` : ''}`;
    return proxyTo(request, reply, SERVICE_NAMES.LEAVE, 'LEAVE_SERVICE_URL', path);
  });

  app.patch<{ Params: { id: string } }>(
    '/api/leaves/:id/approve',
    { preHandler: [app.authenticate, authorize(ROLES.MANAGER)] },
    async (request, reply) => {
      return proxyTo(
        request,
        reply,
        SERVICE_NAMES.LEAVE,
        'LEAVE_SERVICE_URL',
        `/leaves/${request.params.id}/approve`,
        'PATCH'
      );
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/api/leaves/:id/reject',
    { preHandler: [app.authenticate, authorize(ROLES.MANAGER)] },
    async (request, reply) => {
      return proxyTo(
        request,
        reply,
        SERVICE_NAMES.LEAVE,
        'LEAVE_SERVICE_URL',
        `/leaves/${request.params.id}/reject`,
        'PATCH',
        request.body
      );
    }
  );

  app.patch<{ Params: { id: string } }>(
    '/api/leaves/:id/cancel',
    { preHandler: [app.authenticate, authorize(ROLES.EMPLOYEE)] },
    async (request, reply) => {
      return proxyTo(
        request,
        reply,
        SERVICE_NAMES.LEAVE,
        'LEAVE_SERVICE_URL',
        `/leaves/${request.params.id}/cancel`,
        'PATCH'
      );
    }
  );

  app.get('/api/notifications/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    return proxyTo(request, reply, SERVICE_NAMES.NOTIFICATION, 'NOTIFICATION_SERVICE_URL', '/notifications/me');
  });
}
