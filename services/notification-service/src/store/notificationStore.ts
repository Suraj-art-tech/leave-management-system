import { v4 as uuidv4 } from 'uuid';
import { EVENTS, type LeaveEventPayload, type Notification } from '@lms/shared';

export const notificationStore = new Map<string, Notification>();

export function addNotification(input: Omit<Notification, 'id' | 'read' | 'createdAt'>): Notification {
  const notification: Notification = {
    ...input,
    id: uuidv4(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  notificationStore.set(notification.id, notification);
  console.log(`[notification] ${notification.type} -> ${notification.recipientId}: ${notification.message}`);
  return notification;
}

export function addSystemErrorNotification(input: {
  recipientId: string;
  message: string;
  correlationId: string;
  serviceName?: string;
}): Notification {
  const detail = input.serviceName ? `[${input.serviceName}] ${input.message}` : input.message;
  return addNotification({
    recipientId: input.recipientId,
    type: EVENTS.SYSTEM_ERROR,
    message: detail,
    correlationId: input.correlationId,
  });
}

export function handleLeaveEvent(routingKey: string, payload: LeaveEventPayload, correlationId: string): void {
  const data = payload as LeaveEventPayload;

  if (routingKey === EVENTS.LEAVE_APPLIED) {
    addNotification({
      recipientId: data.employeeId,
      type: EVENTS.LEAVE_APPLIED,
      message: `Leave request ${data.leaveId} submitted for ${data.days} day(s) ${data.leaveType}`,
      correlationId,
    });
    addNotification({
      recipientId: data.reportingManagerId,
      type: EVENTS.LEAVE_APPLIED,
      message: `${data.employeeName} submitted leave request ${data.leaveId} for ${data.days} day(s) ${data.leaveType}`,
      correlationId,
    });
    return;
  }

  if (routingKey === EVENTS.LEAVE_APPROVED) {
    addNotification({
      recipientId: data.employeeId,
      type: EVENTS.LEAVE_APPROVED,
      message: `Leave request ${data.leaveId} approved`,
      correlationId,
    });
    return;
  }

  if (routingKey === EVENTS.LEAVE_REJECTED) {
    addNotification({
      recipientId: data.employeeId,
      type: EVENTS.LEAVE_REJECTED,
      message: `Leave request ${data.leaveId} rejected: ${data.rejectionReason ?? 'No reason provided'}`,
      correlationId,
    });
    return;
  }

  if (routingKey === EVENTS.LEAVE_CANCELLED) {
    addNotification({
      recipientId: data.employeeId,
      type: EVENTS.LEAVE_CANCELLED,
      message: `Leave request ${data.leaveId} cancelled`,
      correlationId,
    });
    addNotification({
      recipientId: data.reportingManagerId,
      type: EVENTS.LEAVE_CANCELLED,
      message: `${data.employeeName} cancelled leave request ${data.leaveId}`,
      correlationId,
    });
  }
}
