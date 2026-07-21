import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { stockItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const branchId = getEffectiveBranchId(user)
  const items = await db.query.stockItems.findMany({
    with: { ingredient: true },
    where: branchId ? eq(stockItems.branchId, branchId) : undefined
  })
  return items.sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, 'th'))
})
