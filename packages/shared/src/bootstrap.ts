import type { FastifyInstance } from 'fastify';
import { registerService } from './consul.js';
import { SERVICE_NAMES } from './constants.js';

export interface BootstrapOptions {
  serviceName: keyof typeof SERVICE_NAMES | string;
  port: number;
  host?: string;
  buildApp: () => Promise<FastifyInstance> | FastifyInstance;
}

export async function bootstrap(options: BootstrapOptions): Promise<void> {
  const host = options.host ?? process.env.SERVICE_HOST ?? 'localhost';
  const port = options.port;
  process.env.SERVICE_NAME = String(options.serviceName);
  const app = await options.buildApp();

  app.get('/health', async () => ({
    status: 'UP',
    service: options.serviceName,
    timestamp: new Date().toISOString(),
  }));

  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[${options.serviceName}] listening on 0.0.0.0:${port}`);

  await registerService({ name: String(options.serviceName), address: host, port });
}

export function getEnvPort(defaultPort: number): number {
  return Number(process.env.PORT ?? defaultPort);
}
