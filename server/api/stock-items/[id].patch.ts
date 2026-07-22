import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems } from '../../db/schema'

// The item's name/unit live on the shared ingredient now (see /api/ingredients);
// only the branch-specific low-stock threshold is editable here.
export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [existing] = await db.select().from(stockItems).where(eq(stockItems.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  if (user.role !== 'owner' && existing.branchId !== user.branchId) {
    throw createError({ statusCode: 403, statusMessage: 'ไม่มีสิทธิ์เข้าถึง' })
  }

  const body = await readBody<{ minThreshold?: number }>(event)
  const updates: Partial<typeof stockItems.$inferInsert> = {}
  if (body?.minThreshold !== undefined) {
    if (typeof body.minThreshold !== 'number' || !Number.isFinite(body.minThreshold) || body.minThreshold < 0) {
      throw createError({ statusCode: 400, statusMessage: 'สต๊อกขั้นต่ำไม่ถูกต้อง' })
    }
    updates.minThreshold = body.minThreshold
  }

  const [item] = await db.update(stockItems).set(updates).where(eq(stockItems.id, id)).returning()
  return db.query.stockItems.findFirst({ where: eq(stockItems.id, item!.id), with: { ingredient: true } })
})
