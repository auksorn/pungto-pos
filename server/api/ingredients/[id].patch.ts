import { and, eq, ne } from 'drizzle-orm'
import { db } from '../../db'
import { ingredients } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, unit?: string, costPerUnit?: number, imageUrl?: string | null }>(event)
  const updates: Partial<typeof ingredients.$inferInsert> = {}

  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อวัตถุดิบ' })
    const [existing] = await db.select().from(ingredients).where(and(eq(ingredients.name, name), ne(ingredients.id, id))).limit(1)
    if (existing) throw createError({ statusCode: 409, statusMessage: 'มีวัตถุดิบชื่อนี้อยู่แล้ว' })
    updates.name = name
  }
  if (body?.unit !== undefined) {
    const unit = body.unit.trim()
    if (!unit) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกหน่วยนับ' })
    updates.unit = unit
  }
  if (body?.costPerUnit !== undefined) {
    if (typeof body.costPerUnit !== 'number' || !Number.isFinite(body.costPerUnit) || body.costPerUnit < 0) {
      throw createError({ statusCode: 400, statusMessage: 'ต้นทุนต่อหน่วยไม่ถูกต้อง' })
    }
    updates.costPerUnit = body.costPerUnit
  }
  if (body?.imageUrl !== undefined) updates.imageUrl = body.imageUrl

  const [ingredient] = await db.update(ingredients).set(updates).where(eq(ingredients.id, id)).returning()
  if (!ingredient) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  return ingredient
})
