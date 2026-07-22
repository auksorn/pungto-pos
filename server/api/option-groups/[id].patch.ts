import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { optionGroups } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, isRequired?: boolean }>(event)
  const updates: Partial<typeof optionGroups.$inferInsert> = {}
  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อตัวเลือก' })
    updates.name = name
  }
  if (body?.isRequired !== undefined) updates.isRequired = body.isRequired

  const [group] = await db.update(optionGroups).set(updates).where(eq(optionGroups.id, id)).returning()
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบตัวเลือก' })
  }
  return group
})
