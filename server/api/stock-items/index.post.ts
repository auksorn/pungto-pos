import { and, eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems, ingredients } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, ['owner', 'manager'])
  const branchId = requireEffectiveBranchId(user)

  const body = await readBody<{ ingredientId?: number, name?: string, unit?: string, minThreshold?: number }>(event)

  let ingredientId = body?.ingredientId
  if (!ingredientId) {
    // Free-typed name: reuse the existing ingredient with that name (shared
    // across branches), or create it if this is genuinely new.
    const name = body?.name?.trim()
    const unit = body?.unit?.trim()
    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อวัตถุดิบ' })
    }
    if (!unit) {
      throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกหน่วยนับ' })
    }

    const [existing] = await db.select().from(ingredients).where(eq(ingredients.name, name)).limit(1)
    if (existing) {
      if (existing.unit !== unit) {
        throw createError({ statusCode: 400, statusMessage: `มีวัตถุดิบชื่อนี้อยู่แล้วที่หน่วยนับ "${existing.unit}" กรุณาใช้หน่วยนับเดียวกัน` })
      }
      ingredientId = existing.id
    } else {
      const [created] = await db.insert(ingredients).values({ name, unit }).returning()
      ingredientId = created.id
    }
  }

  const [alreadyStocked] = await db.select({ id: stockItems.id }).from(stockItems)
    .where(and(eq(stockItems.branchId, branchId), eq(stockItems.ingredientId, ingredientId)))
    .limit(1)
  if (alreadyStocked) {
    throw createError({ statusCode: 409, statusMessage: 'สาขานี้มีวัตถุดิบนี้อยู่แล้ว' })
  }

  const [item] = await db.insert(stockItems).values({
    branchId,
    ingredientId,
    minThreshold: body?.minThreshold ?? 0
  }).returning()

  return db.query.stockItems.findFirst({ where: eq(stockItems.id, item.id), with: { ingredient: true } })
})
