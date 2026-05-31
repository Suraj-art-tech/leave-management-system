import type { LeaveType } from './types.js';

export const ROLES = {
  EMPLOYEE: 'Employee' as const,
  MANAGER: 'Manager' as const,
};

export const LEAVE_TYPES: LeaveType[] = ['CASUAL', 'SICK', 'PRIVILEGE'];

export const LEAVE_STATUS = {
  PENDING: 'PENDING' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const DEFAULT_ALLOCATION: Record<LeaveType, number> = {
  CASUAL: 12,
  SICK: 10,
  PRIVILEGE: 15,
};

export const EVENTS = {
  LEAVE_APPLIED: 'leave.applied',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',
  LEAVE_CANCELLED: 'leave.cancelled',
  SYSTEM_ERROR: 'system.error',
} as const;

export const SERVICE_NAMES = {
  AUTH: 'auth-service',
  EMPLOYEE: 'employee-service',
  LEAVE: 'leave-service',
  NOTIFICATION: 'notification-service',
  GATEWAY: 'api-gateway',
} as const;
