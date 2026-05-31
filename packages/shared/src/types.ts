export type Role = 'Employee' | 'Manager';

export type LeaveType = 'CASUAL' | 'SICK' | 'PRIVILEGE';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface JwtPayload {
  userId: string;
  employeeId: string;
  name: string;
  role: Role;
}

export interface User {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  managerId: string | null;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface LeaveBalanceEntry {
  allocated: number;
  used: number;
  remaining: number;
}

export interface LeaveBalance {
  employeeId: string;
  balances: Record<LeaveType, LeaveBalanceEntry>;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  reportingManagerId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  type: string;
  message: string;
  correlationId: string;
  read: boolean;
  createdAt: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  correlationId: string | null;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    details: unknown;
  };
  correlationId: string | null;
}

export interface LeaveEventPayload {
  leaveId: string;
  employeeId: string;
  employeeName: string;
  reportingManagerId: string;
  leaveType: LeaveType;
  days: number;
  status: LeaveStatus;
  rejectionReason?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    user?: JwtPayload;
  }
}
