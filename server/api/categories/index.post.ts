import { db } from '../../db'
import { categories } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const body = await readBody<{ name?: string, sortOrder?: number }>(event)
  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อหมวดหมู่' })
  }
  if (body?.sortOrder !== undefined && (typeof body.sortOrder !== 'number' || !Number.isFinite(body.sortOrder))) {
    throw createError({ statusCode: 400, statusMessage: 'ลำดับการแสดงไม่ถูกต้อง' })
  }

  const [category] = await db.insert(categories).values({
    name,
    sortOrder: body?.sortOrder ?? 0
  }).returning()

  return category
})
