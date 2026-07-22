import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems, stockTransactions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [existing] = await db.select().from(stockItems).where(eq(stockItems.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  if (user.role !== 'owner' && existing.branchId !== user.branchId) {
    throw createError({ statusCode: 403, statusMessage: 'ไม่มีสิทธิ์เข้าถึง' })
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
