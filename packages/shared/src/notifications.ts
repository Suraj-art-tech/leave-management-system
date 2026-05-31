import { request } from 'undici';
import { EVENTS, SERVICE_NAMES } from './constants.js';
import { discoverService } from './consul.js';

export interface SystemErrorInput {
  recipientId: string;
  message: string;
  correlationId: string;
  serviceName?: string;
}

export function logSystemErrorNotification(input: SystemErrorInput): void {
  void (async () => {
    try {
      const fallback = process.env.NOTIFICATION_SERVICE_URL;
      const baseUrl = await discoverService(SERVICE_NAMES.NOTIFICATION, fallback);
      await request(`${baseUrl}/notifications/system-error`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': input.correlationId,
        },
        body: JSON.stringify({
          recipientId: input.recipientId,
          message: input.message,
          correlationId: input.correlationId,
          serviceName: input.serviceName,
          type: EVENTS.SYSTEM_ERROR,
        }),
      });
    } catch (err) {
      console.warn('[system-error-notification] Failed to log notification:', (err as Error).message);
    }
  })();
}
