import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import { verifyToken } from '../jwt.js';
import type { JwtPayload } from '../types.js';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError(401, 'Missing or malformed Authorization header');
    request.user = verifyToken(token);
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export function authorize(...roles: JwtPayload['role'][]) {
  return async (request: FastifyRequest) => {
    if (!request.user) throw new AppError(401, 'Unauthenticated');
    if (roles.length > 0 && !roles.includes(request.user.role)) {
      throw new AppError(403, 'Forbidden: insufficient privileges');
    }
  };
}

export default fp(authPlugin, { name: 'auth-plugin' });
