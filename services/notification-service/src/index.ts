import {
  bootstrap,
  connectRabbit,
  consumeEvents,
  EVENTS,
  getEnvPort,
  SERVICE_NAMES,
  type LeaveEventPayload,
} from '@lms/shared';
import { buildApp } from './app.js';
import { handleLeaveEvent } from './store/notificationStore.js';

await connectRabbit();

await consumeEvents(
  'notification.queue',
  [EVENTS.LEAVE_APPLIED, EVENTS.LEAVE_APPROVED, EVENTS.LEAVE_REJECTED, EVENTS.LEAVE_CANCELLED],
  async (routingKey, payload, correlationId) => {
    handleLeaveEvent(routingKey, payload as LeaveEventPayload, correlationId);
  }
);

await bootstrap({
  serviceName: SERVICE_NAMES.NOTIFICATION,
  port: getEnvPort(3004),
  host: process.env.SERVICE_HOST ?? 'notification-service',
  buildApp,
});
