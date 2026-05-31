import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { AppError, errorResponse } from '../errors.js';
import { logSystemErrorNotification } from '../notifications.js';

function notifySystemError(
  request: { user?: { employeeId: string }; correlationId?: string },
  message: string
): void {
  if (!request.user?.employeeId || !request.correlationId) return;
  logSystemErrorNotification({
    recipientId: request.user.employeeId,
    message,
    correlationId: request.correlationId,
    serviceName: process.env.SERVICE_NAME,
  });
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const correlationId = request.correlationId ?? null;

    if (error instanceof AppError) {
      request.log.warn({ err: error, correlationId }, error.message);
      if (error.statusCode === 503) {
        notifySystemError(request, error.message);
      }
      return reply.status(error.statusCode).send(errorResponse(error.message, correlationId, error.details));
    }

    if (error.validation) {
      return reply.status(400).send(errorResponse('Validation error', correlationId, error.validation));
    }

    const statusCode = (error as { statusCode?: number }).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      request.log.warn({ err: error, correlationId }, error.message);
      return reply.status(statusCode).send(errorResponse(error.message, correlationId));
    }

    request.log.error({ err: error, correlationId }, error.message);
    notifySystemError(request, 'An unexpected system error occurred. Please try again later.');
    return reply.status(500).send(errorResponse('Internal server error', correlationId));
  });
};

export default fp(errorHandlerPlugin, { name: 'error-handler-plugin' });
