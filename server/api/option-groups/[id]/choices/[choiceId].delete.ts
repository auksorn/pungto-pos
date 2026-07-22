import { and, eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { optionChoices } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const groupId = Number(getRouterParam(event, 'id'))
  const choiceId = Number(getRouterParam(event, 'choiceId'))
  if (!Number.isInteger(groupId) || !Number.isInteger(choiceId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [choice] = await db.delete(optionChoices)
    .where(and(eq(optionChoices.id, choiceId), eq(optionChoices.optionGroupId, groupId)))
    .returning()
  if (!choice) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบรายการ' })
  }
  return { ok: true }
})
