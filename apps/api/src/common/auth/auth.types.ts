import type { Request } from 'express';
import type { StaffRole } from '@prisma/client';

export interface CustomerJwtPayload {
  sub: string;
  typ: 'customer';
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface StaffJwtPayload {
  sub: string;
  typ: 'staff';
  storeId: string;
  role: StaffRole;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedMember {
  id: string;
}

export interface AuthenticatedStaff {
  id: string;
  storeId: string;
  role: StaffRole;
}

export interface RequestWithMember extends Request {
  member?: AuthenticatedMember;
}

export interface RequestWithStaff extends Request {
  staff?: AuthenticatedStaff;
}

export interface MemberPublic {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface StaffStorePublic {
  id: string;
  name: string;
}

export interface StaffPublic {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
  store: StaffStorePublic;
}

export interface RequestCodeResult {
  expiresInSeconds: number;
  devCode?: string;
}

export interface CustomerLoginResult {
  token: string;
  member: MemberPublic;
}

export interface StaffLoginResult {
  token: string;
  staff: StaffPublic;
}
