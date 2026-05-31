import Fastify from 'fastify';
import { authPlugin, correlationPlugin, errorHandlerPlugin } from '@lms/shared';
import { leaveRoutes } from './routes/leave.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  app.register(correlationPlugin);
  app.register(errorHandlerPlugin);
  app.register(async (instance) => {
    await instance.register(authPlugin);
    await instance.register(leaveRoutes);
  });

  return app;
}
