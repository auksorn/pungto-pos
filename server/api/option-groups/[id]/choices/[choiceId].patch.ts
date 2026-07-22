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

  const body = await readBody<{ name?: string, priceDelta?: number }>(event)
  const updates: Partial<typeof optionChoices.$inferInsert> = {}
  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อตัวเลือกย่อย' })
    updates.name = name
  }
  if (body?.priceDelta !== undefined) {
    if (typeof body.priceDelta !== 'number' || !Number.isFinite(body.priceDelta)) {
      throw createError({ statusCode: 400, statusMessage: 'ราคาเพิ่มไม่ถูกต้อง' })
    }
    updates.priceDelta = body.priceDelta
  }

  const [choice] = await db.update(optionChoices).set(updates)
    .where(and(eq(optionChoices.id, choiceId), eq(optionChoices.optionGroupId, groupId)))
    .returning()
  if (!choice) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบรายการ' })
  }
  return choice
})
