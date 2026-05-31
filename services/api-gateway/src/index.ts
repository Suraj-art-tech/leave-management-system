import { bootstrap, getEnvPort, SERVICE_NAMES } from '@lms/shared';
import { buildApp } from './app.js';

await bootstrap({
  serviceName: SERVICE_NAMES.GATEWAY,
  port: getEnvPort(3000),
  host: process.env.SERVICE_HOST ?? 'api-gateway',
  buildApp,
});
