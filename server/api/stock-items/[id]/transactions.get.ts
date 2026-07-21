import { desc, eq } from 'drizzle-orm'
import { db } from '../../../db'
import { stockItems, stockTransactions } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const stockItemId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(stockItemId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [item] = await db.select().from(stockItems).where(eq(stockItems.id, stockItemId)).limit(1)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  if (user.role !== 'owner' && item.branchId !== user.branchId) {
    throw createError({ statusCode: 403, statusMessage: 'ไม่มีสิทธิ์เข้าถึง' })
  }

  return db.query.stockTransactions.findMany({
    where: eq(stockTransactions.stockItemId, stockItemId),
    with: { employee: { columns: { id: true, name: true } } },
    orderBy: desc(stockTransactions.createdAt)
  })
})
