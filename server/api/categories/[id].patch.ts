import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { categories } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, sortOrder?: number }>(event)
  const updates: Partial<typeof categories.$inferInsert> = {}
  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อหมวดหมู่' })
    updates.name = name
  }
  if (body?.sortOrder !== undefined) updates.sortOrder = body.sortOrder

  const [category] = await db.update(categories).set(updates).where(eq(categories.id, id)).returning()
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบหมวดหมู่' })
  }
  return category
})
