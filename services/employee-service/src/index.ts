import { bootstrap, getEnvPort, SERVICE_NAMES } from '@lms/shared';
import { buildApp } from './app.js';
import { seedEmployees } from './store/balanceStore.js';

seedEmployees();

await bootstrap({
  serviceName: SERVICE_NAMES.EMPLOYEE,
  port: getEnvPort(3002),
  host: process.env.SERVICE_HOST ?? 'employee-service',
  buildApp,
});
