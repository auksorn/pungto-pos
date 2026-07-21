import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { products } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, price?: number, categoryId?: number | null, imageUrl?: string | null, isActive?: boolean }>(event)
  const updates: Partial<typeof products.$inferInsert> = {}

  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อสินค้า' })
    updates.name = name
  }
  if (body?.price !== undefined) {
    if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) {
      throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกราคาที่ถูกต้อง' })
    }
    updates.price = body.price
  }
  if (body?.categoryId !== undefined) updates.categoryId = body.categoryId
  if (body?.imageUrl !== undefined) updates.imageUrl = body.imageUrl
  if (body?.isActive !== undefined) updates.isActive = body.isActive

  const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning()
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบสินค้า' })
  }
  return product
})
