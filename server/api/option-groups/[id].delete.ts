import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { optionChoices, optionGroups } from '../../db/schema'

// Option groups/choices aren't referenced by any FK (past orders store a JSON
// snapshot of what was chosen, not a live reference), so this is a hard delete.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const deleted = db.transaction((tx) => {
    tx.delete(optionChoices).where(eq(optionChoices.optionGroupId, id)).run()
    return tx.delete(optionGroups).where(eq(optionGroups.id, id)).returning().all()
  })
  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบตัวเลือก' })
  }
  return { ok: true }
})
