import { db } from '../../db'
import { stockItems } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, ['owner', 'manager'])
  const branchId = requireEffectiveBranchId(user)

  const body = await readBody<{ name?: string, unit?: string, minThreshold?: number }>(event)
  const name = body?.name?.trim()
  const unit = body?.unit?.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อวัตถุดิบ' })
  }
  if (!unit) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกหน่วยนับ' })
  }

  const [item] = await db.insert(stockItems).values({
    branchId,
    name,
    unit,
    minThreshold: body?.minThreshold ?? 0
  }).returning()

  return item
})
