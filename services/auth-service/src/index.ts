import { bootstrap, getEnvPort, SERVICE_NAMES } from '@lms/shared';
import { buildApp } from './app.js';
import { seedUsers } from './store/userStore.js';

await seedUsers();

await bootstrap({
  serviceName: SERVICE_NAMES.AUTH,
  port: getEnvPort(3001),
  host: process.env.SERVICE_HOST ?? 'auth-service',
  buildApp,
});
