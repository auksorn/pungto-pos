import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { branches } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, address?: string, phone?: string, isActive?: boolean }>(event)
  const updates: Partial<typeof branches.$inferInsert> = {}
  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อสาขา' })
    updates.name = name
  }
  if (body?.address !== undefined) updates.address = body.address.trim() || null
  if (body?.phone !== undefined) updates.phone = body.phone.trim() || null
  if (body?.isActive !== undefined) updates.isActive = body.isActive

  const [branch] = await db.update(branches).set(updates).where(eq(branches.id, id)).returning()
  if (!branch) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบสาขา' })
  }
  return branch
})
