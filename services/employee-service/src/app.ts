import Fastify from 'fastify';
import { authPlugin, correlationPlugin, errorHandlerPlugin } from '@lms/shared';
import { employeeRoutes } from './routes/employee.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  app.register(correlationPlugin);
  app.register(errorHandlerPlugin);
  app.register(async (instance) => {
    await instance.register(authPlugin);
    await instance.register(employeeRoutes);
  });

  return app;
}
