export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const order = await getOrderDetail(id)
  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบออเดอร์' })
  }
  if (user.role !== 'owner' && order.branchId !== user.branchId) {
    throw createError({ statusCode: 403, statusMessage: 'ไม่มีสิทธิ์เข้าถึง' })
  }
  return order
})
