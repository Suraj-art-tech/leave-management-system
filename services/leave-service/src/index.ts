import { bootstrap, connectRabbit, getEnvPort, SERVICE_NAMES } from '@lms/shared';
import { buildApp } from './app.js';

await connectRabbit();

await bootstrap({
  serviceName: SERVICE_NAMES.LEAVE,
  port: getEnvPort(3003),
  host: process.env.SERVICE_HOST ?? 'leave-service',
  buildApp,
});
