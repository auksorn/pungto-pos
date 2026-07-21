import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems } from '../../db/schema'

// The item's name/unit live on the shared ingredient now (see /api/ingredients);
// only the branch-specific low-stock threshold is editable here.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ minThreshold?: number }>(event)
  const updates: Partial<typeof stockItems.$inferInsert> = {}
  if (body?.minThreshold !== undefined) updates.minThreshold = body.minThreshold

  const [item] = await db.update(stockItems).set(updates).where(eq(stockItems.id, id)).returning()
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  return db.query.stockItems.findFirst({ where: eq(stockItems.id, item.id), with: { ingredient: true } })
})
