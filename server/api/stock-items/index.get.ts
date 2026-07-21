import { asc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const branchId = getEffectiveBranchId(user)
  if (!branchId) {
    // Owner in "all branches" mode
    return db.select().from(stockItems).orderBy(asc(stockItems.name))
  }

  return db.select().from(stockItems).where(eq(stockItems.branchId, branchId)).orderBy(asc(stockItems.name))
})
