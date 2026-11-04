import type { Member } from '@prisma/client';
import type { MemberPublic } from '../../../common/auth/auth.types.js';

export function toMemberPublic(member: Member): MemberPublic {
  return {
    id: member.id,
    phone: member.phone,
    nickname: member.nickname,
    avatarUrl: member.avatarUrl,
    createdAt: member.createdAt.toISOString(),
  };
}
