import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { orders, orderItems, payments, products, productIngredients, stockItems, stockTransactions } from '../../db/schema'

interface CartItem { productId: number, quantity: number }

// Creates an order and marks it paid in a single atomic step, for the common
// counter-service flow where payment always happens immediately after ordering.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const branchId = requireEffectiveBranchId(user)

  const body = await readBody<{ items?: CartItem[], method?: 'cash' | 'transfer' | 'qr', amountReceived?: number }>(event)
  const items = body?.items ?? []
  if (!items.length) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ' })
  }
  for (const item of items) {
    if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw createError({ statusCode: 400, statusMessage: 'ข้อมูลสินค้าไม่ถูกต้อง' })
    }
  }

  const method = body?.method
  if (!method || !['cash', 'transfer', 'qr'].includes(method)) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกช่องทางชำระเงิน' })
  }

  const foundProducts = await db.select().from(products).where(inArray(products.id, items.map(i => i.productId)))
  const productMap = new Map(foundProducts.map(p => [p.id, p]))
  for (const item of items) {
    const product = productMap.get(item.productId)
    if (!product || !product.isActive) {
      throw createError({ statusCode: 400, statusMessage: 'ไม่พบสินค้า หรือสินค้าปิดขายอยู่' })
    }
  }

  const total = items.reduce((sum, item) => sum + productMap.get(item.productId)!.price * item.quantity, 0)

  // Sum how much of each ingredient this cart consumes, across all items sharing it
  const recipeRows = await db.select().from(productIngredients).where(inArray(productIngredients.productId, items.map(i => i.productId)))
  const consumption = new Map<number, number>()
  for (const item of items) {
    for (const recipe of recipeRows) {
      if (recipe.productId !== item.productId) continue
      consumption.set(recipe.ingredientId, (consumption.get(recipe.ingredientId) ?? 0) + recipe.quantity * item.quantity)
    }
  }

  let change = 0
  if (method === 'cash') {
    const received = typeof body?.amountReceived === 'number' ? body.amountReceived : total
    if (received < total) {
      throw createError({ statusCode: 400, statusMessage: 'จำนวนเงินที่รับไม่พอชำระ' })
    }
    change = received - total
  }

  const createdId = db.transaction((tx) => {
    const [order] = tx.insert(orders).values({
      branchId,
      employeeId: user.id,
      status: 'paid'
    }).returning().all()

    tx.insert(orderItems).values(items.map((item) => {
      const product = productMap.get(item.productId)!
      return { orderId: order.id, productId: product.id, quantity: item.quantity, price: product.price }
    })).run()

    tx.insert(payments).values({ orderId: order.id, method, amount: total }).run()

    // Best-effort auto-deduct: if this branch doesn't stock an ingredient the
    // recipe calls for, skip it rather than blocking the sale (payment is
    // always immediate here — see TODO.md section 5/6).
    for (const [ingredientId, quantity] of consumption) {
      const stockItem = tx.select().from(stockItems)
        .where(and(eq(stockItems.branchId, branchId), eq(stockItems.ingredientId, ingredientId)))
        .get()
      if (!stockItem) continue

      tx.update(stockItems).set({ quantity: stockItem.quantity - quantity }).where(eq(stockItems.id, stockItem.id)).run()
      tx.insert(stockTransactions).values({
        stockItemId: stockItem.id,
        branchId,
        employeeId: user.id,
        type: 'out',
        quantity,
        refOrderId: order.id
      }).run()
    }

    return order.id
  })

  return { order: await getOrderDetail(createdId), change }
})
