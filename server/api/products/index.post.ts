import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { categories, products } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const body = await readBody<{ name?: string, price?: number, categoryId?: number | null, imageUrl?: string | null }>(event)
  const name = body?.name?.trim()
  const price = body?.price

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อสินค้า' })
  }
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกราคาที่ถูกต้อง' })
  }
  if (body?.categoryId != null) {
    if (!Number.isInteger(body.categoryId)) {
      throw createError({ statusCode: 400, statusMessage: 'invalid categoryId' })
    }
    const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, body.categoryId)).limit(1)
    if (!category) {
      throw createError({ statusCode: 404, statusMessage: 'ไม่พบหมวดหมู่' })
    }
  }

  const [product] = await db.insert(products).values({
    name,
    price,
    categoryId: body?.categoryId ?? null,
    imageUrl: body?.imageUrl ?? null
  }).returning()

  return product
})
