import { db } from '../../db'
import { branches } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner'])

  const body = await readBody<{ name?: string, address?: string, phone?: string }>(event)
  const name = body?.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อสาขา' })
  }

  const [branch] = await db.insert(branches).values({
    name,
    address: body?.address?.trim() || null,
    phone: body?.phone?.trim() || null
  }).returning()

  return branch
})
