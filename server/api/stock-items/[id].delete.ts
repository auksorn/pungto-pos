import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems, stockTransactions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [usedInTransaction] = await db.select({ id: stockTransactions.id }).from(stockTransactions).where(eq(stockTransactions.stockItemId, id)).limit(1)
  if (usedInTransaction) {
    throw createError({ statusCode: 409, statusMessage: 'ไม่สามารถลบได้ เนื่องจากมีประวัติการเคลื่อนไหวสต๊อกแล้ว' })
  }

  const [item] = await db.delete(stockItems).where(eq(stockItems.id, id)).returning()
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  return { ok: true }
})
