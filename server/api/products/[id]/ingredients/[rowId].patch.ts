import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { productIngredients } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const productId = Number(getRouterParam(event, 'id'))
  const rowId = Number(getRouterParam(event, 'rowId'))
  if (!Number.isInteger(productId) || !Number.isInteger(rowId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ quantity?: number }>(event)
  const quantity = body?.quantity
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกปริมาณที่ใช้' })
  }

  const [row] = await db.update(productIngredients).set({ quantity })
    .where(and(eq(productIngredients.id, rowId), eq(productIngredients.productId, productId)))
    .returning()
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบรายการ' })
  }
  return db.query.productIngredients.findFirst({ where: eq(productIngredients.id, row.id), with: { ingredient: true } })
})
