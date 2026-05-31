import { v4 as uuidv4 } from 'uuid';
import { LEAVE_STATUS, type LeaveRequest } from '@lms/shared';

export const leaveStore = new Map<string, LeaveRequest>();

export function createLeaveRequest(input: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>): LeaveRequest {
  const now = new Date().toISOString();
  const leave: LeaveRequest = {
    ...input,
    id: uuidv4(),
    status: LEAVE_STATUS.PENDING,
    createdAt: now,
    updatedAt: now,
  };
  leaveStore.set(leave.id, leave);
  return leave;
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function inclusiveDays(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate).getTime();
  const end = parseDateOnly(endDate).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

export function hasOverlap(employeeId: string, startDate: string, endDate: string, excludeId?: string): boolean {
  const start = parseDateOnly(startDate).getTime();
  const end = parseDateOnly(endDate).getTime();

  for (const leave of leaveStore.values()) {
    if (leave.employeeId !== employeeId) continue;
    if (excludeId && leave.id === excludeId) continue;
    if (leave.status !== LEAVE_STATUS.PENDING && leave.status !== LEAVE_STATUS.APPROVED) continue;

    const ls = parseDateOnly(leave.startDate).getTime();
    const le = parseDateOnly(leave.endDate).getTime();
    if (start <= le && end >= ls) return true;
  }
  return false;
}

export function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
