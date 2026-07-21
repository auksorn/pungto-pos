import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { products, ingredients, productIngredients } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const productId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(productId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ ingredientId?: number, quantity?: number }>(event)
  const ingredientId = body?.ingredientId
  const quantity = body?.quantity
  if (typeof ingredientId !== 'number' || !Number.isInteger(ingredientId)) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกวัตถุดิบ' })
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกปริมาณที่ใช้' })
  }

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบสินค้า' })
  }
  const [ingredient] = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1)
  if (!ingredient) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }

  const [existing] = await db.select({ id: productIngredients.id }).from(productIngredients)
    .where(and(eq(productIngredients.productId, productId), eq(productIngredients.ingredientId, ingredientId)))
    .limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'สินค้านี้ใช้วัตถุดิบนี้อยู่แล้ว' })
  }

  const [row] = await db.insert(productIngredients).values({ productId, ingredientId, quantity }).returning()
  return db.query.productIngredients.findFirst({ where: eq(productIngredients.id, row.id), with: { ingredient: true } })
})
