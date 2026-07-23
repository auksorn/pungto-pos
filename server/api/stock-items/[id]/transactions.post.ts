import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { stockItems, stockTransactions } from '../../../db/schema'

type TxType = 'in' | 'out' | 'adjust'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const stockItemId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(stockItemId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const [item] = await db.select().from(stockItems).where(eq(stockItems.id, stockItemId)).limit(1)
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบวัตถุดิบ' })
  }
  if (user.role !== 'owner' && item.branchId !== user.branchId) {
    throw createError({ statusCode: 403, statusMessage: 'ไม่มีสิทธิ์เข้าถึง' })
  }

  const body = await readBody<{ type?: TxType, quantity?: number, reason?: string }>(event)
  const type = body?.type
  if (!type || !['in', 'out', 'adjust'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาระบุประเภทรายการ' })
  }
  if (typeof body?.quantity !== 'number' || !Number.isFinite(body.quantity) || body.quantity === 0) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกจำนวนที่ถูกต้อง' })
  }
  if ((type === 'out' || type === 'adjust') && !body?.reason?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาระบุเหตุผล' })
  }
  if ((type === 'in' || type === 'out') && body.quantity < 0) {
    throw createError({ statusCode: 400, statusMessage: 'จำนวนต้องมากกว่า 0' })
  }

  const delta = type === 'out' ? -body.quantity : body.quantity
  const newQuantity = item.quantity + delta
  if (newQuantity < 0) {
    throw createError({ statusCode: 400, statusMessage: 'สต๊อกไม่พอสำหรับรายการนี้' })
  }

  const reason = body?.reason?.trim() || null

  const updated = await db.transaction(async (tx) => {
    await tx.insert(stockTransactions).values({
      stockItemId,
      branchId: item.branchId,
      employeeId: user.id,
      type,
      quantity: body.quantity!,
      reason
    })

    const [updatedItem] = await tx.update(stockItems).set({ quantity: newQuantity }).where(eq(stockItems.id, stockItemId)).returning()
    return updatedItem
  })

  return updated
})
