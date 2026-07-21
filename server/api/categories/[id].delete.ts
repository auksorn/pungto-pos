import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { categories, products } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [inUse] = await db.select({ id: products.id }).from(products).where(eq(products.categoryId, id)).limit(1)
  if (inUse) {
    throw createError({ statusCode: 409, statusMessage: 'ไม่สามารถลบได้ เนื่องจากมีสินค้าอยู่ในหมวดหมู่นี้' })
  }

  const [category] = await db.delete(categories).where(eq(categories.id, id)).returning()
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบหมวดหมู่' })
  }
  return { ok: true }
})
