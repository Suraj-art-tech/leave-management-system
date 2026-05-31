import bcrypt from 'bcryptjs';
import type { UserWithPassword } from '@lms/shared';
import { ROLES } from '@lms/shared';

export const userStore = new Map<string, UserWithPassword>();

export async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('Password@123', 10);

  const users: UserWithPassword[] = [
    {
      employeeId: 'MGR001',
      name: 'Alice Manager',
      email: 'alice.manager@lms.com',
      role: ROLES.MANAGER,
      department: 'Engineering',
      managerId: null,
      passwordHash,
    },
    {
      employeeId: 'EMP001',
      name: 'Bob Employee',
      email: 'bob.employee@lms.com',
      role: ROLES.EMPLOYEE,
      department: 'Engineering',
      managerId: 'MGR001',
      passwordHash,
    },
    {
      employeeId: 'EMP002',
      name: 'Carol Employee',
      email: 'carol.employee@lms.com',
      role: ROLES.EMPLOYEE,
      department: 'Engineering',
      managerId: 'MGR001',
      passwordHash,
    },
  ];

  for (const user of users) {
    userStore.set(user.employeeId, user);
  }

  console.log('[auth-service] Seeded users:', users.map((u) => u.employeeId).join(', '));
}

export function toSafeUser(user: UserWithPassword) {
  return {
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    managerId: user.managerId,
  };
}
