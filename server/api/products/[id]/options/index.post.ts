import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { optionGroups, products } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const productId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(productId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, isRequired?: boolean }>(event)
  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อตัวเลือก' })
  }

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบสินค้า' })
  }

  const [group] = await db.insert(optionGroups).values({ productId, name, isRequired: body?.isRequired ?? false }).returning()
  return { ...group, choices: [] }
})
