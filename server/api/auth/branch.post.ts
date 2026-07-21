import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { branches } from '../../db/schema'

// Lets an owner switch which branch they're currently acting on, or pick
// "all branches" (branchId: null) to view aggregated data read-only.
export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, ['owner'])

  const body = await readBody<{ branchId?: number | null }>(event)
  const branchId = body?.branchId ?? null

  if (branchId !== null) {
    if (!Number.isInteger(branchId)) {
      throw createError({ statusCode: 400, statusMessage: 'invalid branchId' })
    }
    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1)
    if (!branch || !branch.isActive) {
      throw createError({ statusCode: 404, statusMessage: 'ไม่พบสาขา หรือสาขานี้ปิดใช้งานแล้ว' })
    }
  }

  // setUserSession merges via defu, which treats `null` as "unset" and would
  // silently keep the old value — use replaceUserSession so null actually sticks.
  await replaceUserSession(event, { user: { ...user, activeBranchId: branchId } })

  return { ok: true, activeBranchId: branchId }
})
