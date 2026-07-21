import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { products } from '../../db/schema'

// Soft delete: products stay referenceable by past orders, just hidden from the menu.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [product] = await db.update(products).set({ isActive: false }).where(eq(products.id, id)).returning()
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบสินค้า' })
  }
  return { ok: true }
})
