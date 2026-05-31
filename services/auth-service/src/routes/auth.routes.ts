import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import {
  AppError,
  signToken,
  successResponse,
  type User,
} from '@lms/shared';
import { toSafeUser, userStore } from '../store/userStore.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { email: string; password: string } }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = [...userStore.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) throw new AppError(401, 'Invalid email or password');

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new AppError(401, 'Invalid email or password');

      const token = signToken({
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
      });

      return reply.send(successResponse({ token, user: toSafeUser(user) }, request.correlationId));
    }
  );

  app.get<{ Params: { employeeId: string } }>('/users/:employeeId', async (request, reply) => {
    const user = userStore.get(request.params.employeeId);
    if (!user) throw new AppError(404, 'User not found');
    return reply.send(successResponse(toSafeUser(user), request.correlationId));
  });

  app.get<{ Params: { employeeId: string } }>('/users/:employeeId/team', async (request, reply) => {
    const manager = userStore.get(request.params.employeeId);
    if (!manager) throw new AppError(404, 'Manager not found');

    const team: User[] = [...userStore.values()]
      .filter((u) => u.managerId === manager.employeeId)
      .map(toSafeUser);

    return reply.send(successResponse(team, request.correlationId));
  });
}
