import type { EventHandlerRequest, H3Event } from 'h3'
import type { User } from '#auth-utils'

type Role = 'owner' | 'manager' | 'staff'

export async function requireRole(event: H3Event<EventHandlerRequest>, roles: Role[]) {
  const session = await requireUserSession(event)
  if (!roles.includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'ไม่มีสิทธิ์เข้าถึง' })
  }
  return session
}

// The branch a request should act on. Owners can switch branches (or pick "all
// branches", represented as null) via the header switcher; manager/staff are
// always pinned to their assigned branch.
export function getEffectiveBranchId(user: User) {
  return user.role === 'owner' ? user.activeBranchId : user.branchId
}

export function requireEffectiveBranchId(user: User) {
  const branchId = getEffectiveBranchId(user)
  if (!branchId) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกสาขาก่อนทำรายการนี้' })
  }
  return branchId
}
