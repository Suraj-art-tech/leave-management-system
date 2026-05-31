import Fastify from 'fastify';
import { correlationPlugin, errorHandlerPlugin } from '@lms/shared';
import { authRoutes } from './routes/auth.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  app.register(correlationPlugin);
  app.register(errorHandlerPlugin);
  app.register(authRoutes);

  return app;
}
