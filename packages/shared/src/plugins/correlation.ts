import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

const correlationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const correlationId = (request.headers['x-correlation-id'] as string) ?? uuidv4();
    request.correlationId = correlationId;
    reply.header('x-correlation-id', correlationId);
  });
};

export default fp(correlationPlugin, { name: 'correlation-plugin' });
