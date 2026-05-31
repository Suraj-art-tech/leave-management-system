import {
  DEFAULT_ALLOCATION,
  LEAVE_TYPES,
  ROLES,
  type LeaveBalance,
  type LeaveType,
  type User,
} from '@lms/shared';

export const balanceStore = new Map<string, LeaveBalance>();

export function createLeaveBalance(employeeId: string): LeaveBalance {
  const balances = {} as LeaveBalance['balances'];
  for (const type of LEAVE_TYPES) {
    const allocated = DEFAULT_ALLOCATION[type];
    balances[type] = { allocated, used: 0, remaining: allocated };
  }
  return { employeeId, balances };
}

export function seedEmployees(): void {
  const employees = ['EMP001', 'EMP002'];
  for (const employeeId of employees) {
    balanceStore.set(employeeId, createLeaveBalance(employeeId));
  }
  console.log('[employee-service] Seeded balances for:', employees.join(', '));
}

export function canAccessEmployee(user: { employeeId: string; role: User['role'] }, targetId: string, teamMemberIds: string[] = []): boolean {
  if (user.employeeId === targetId) return true;
  if (user.role === ROLES.MANAGER && teamMemberIds.includes(targetId)) return true;
  return false;
}

export function deductBalance(employeeId: string, leaveType: LeaveType, days: number): LeaveBalance {
  const balance = balanceStore.get(employeeId);
  if (!balance) throw new Error('Employee balance not found');

  const entry = balance.balances[leaveType];
  if (entry.remaining < days) {
    throw new Error(`Insufficient ${leaveType} leave balance`);
  }

  entry.used += days;
  entry.remaining -= days;
  balanceStore.set(employeeId, balance);
  return balance;
}
