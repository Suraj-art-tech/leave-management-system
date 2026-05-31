import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'super-secret-leave-management-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

export function signToken(payload: Omit<JwtPayload, 'userId'> & { userId?: string }): string {
  const tokenPayload: JwtPayload = {
    userId: payload.userId ?? payload.employeeId,
    employeeId: payload.employeeId,
    name: payload.name,
    role: payload.role,
  };
  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export { JWT_SECRET, JWT_EXPIRES_IN };
