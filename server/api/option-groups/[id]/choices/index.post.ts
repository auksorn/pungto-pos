import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { optionChoices, optionGroups } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const groupId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(groupId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, priceDelta?: number }>(event)
  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อตัวเลือกย่อย' })
  }
  const priceDelta = typeof body?.priceDelta === 'number' && Number.isFinite(body.priceDelta) ? body.priceDelta : 0

  const [group] = await db.select({ id: optionGroups.id }).from(optionGroups).where(eq(optionGroups.id, groupId)).limit(1)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบตัวเลือก' })
  }

  const [choice] = await db.insert(optionChoices).values({ optionGroupId: groupId, name, priceDelta }).returning()
  return choice
})
