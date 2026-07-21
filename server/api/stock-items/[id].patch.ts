import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, unit?: string, minThreshold?: number }>(event)
  const updates: Partial<typeof stockItems.$inferInsert> = {}

  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อวัตถุดิบ' })
    updates.name = name
  }
  if (body?.unit !== undefined) {
    const unit = body.unit.trim()
    if (!unit) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกหน่วยนับ' })
    updates.unit = unit
  }
  if (body?.minThreshold !== undefined) updates.minThreshold = body.minThreshold

  const [item] = await db.update(stockItems).set(updates).where(eq(stockItems.id, id)).returning()
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  return item
})
