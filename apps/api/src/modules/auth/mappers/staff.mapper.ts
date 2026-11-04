import type { StaffRole } from '@prisma/client';
import type { StaffPublic } from '../../../common/auth/auth.types.js';

interface StaffWithStore {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
  store: {
    id: string;
    name: string;
  };
}

export function toStaffPublic(staff: StaffWithStore): StaffPublic {
  return {
    id: staff.id,
    username: staff.username,
    name: staff.name,
    role: staff.role,
    store: {
      id: staff.store.id,
      name: staff.store.name,
    },
  };
}
