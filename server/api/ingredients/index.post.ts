import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { ingredients } from '../../db/schema'

// Adds a brand-new ingredient to the shared catalog (used by the recipe UI
// when the ingredient a product needs isn't stocked anywhere yet). For adding
// stock at a branch, POST /api/stock-items reuses an existing ingredient by
// name instead of erroring, since that's the more common flow.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const body = await readBody<{ name?: string, unit?: string, costPerUnit?: number, imageUrl?: string | null }>(event)
  const name = body?.name?.trim()
  const unit = body?.unit?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อวัตถุดิบ' })
  }
  if (!unit) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกหน่วยนับ' })
  }
  if (body?.costPerUnit !== undefined && (typeof body.costPerUnit !== 'number' || !Number.isFinite(body.costPerUnit) || body.costPerUnit < 0)) {
    throw createError({ statusCode: 400, statusMessage: 'ต้นทุนต่อหน่วยไม่ถูกต้อง' })
  }

  const [existing] = await db.select().from(ingredients).where(eq(ingredients.name, name)).limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'มีวัตถุดิบชื่อนี้อยู่แล้ว' })
  }

  const [ingredient] = await db.insert(ingredients).values({ name, unit, costPerUnit: body?.costPerUnit ?? 0, imageUrl: body?.imageUrl ?? null }).returning()
  return ingredient
})
