import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { orders, orderItems, payments, products, productIngredients, stockItems, stockTransactions, optionGroups } from '../../db/schema'

interface CartItem { productId: number, quantity: number, options?: Array<{ groupId: number, choiceId: number }> }
interface ResolvedOption { groupId: number, choiceId: number, name: string, priceDelta: number }

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

  // Resolve each item's chosen options against the DB (never trust client-sent
  // names/prices — only groupId/choiceId are taken from the request body).
  const optionGroupRows = await db.query.optionGroups.findMany({
    where: inArray(optionGroups.productId, items.map(i => i.productId)),
    with: { choices: true }
  })
  const groupsByProduct = new Map<number, typeof optionGroupRows>()
  for (const group of optionGroupRows) {
    const list = groupsByProduct.get(group.productId) ?? []
    list.push(group)
    groupsByProduct.set(group.productId, list)
  }

  const resolvedItems = items.map((item) => {
    const product = productMap.get(item.productId)!
    const resolvedOptions: ResolvedOption[] = []
    for (const group of groupsByProduct.get(item.productId) ?? []) {
      const selection = item.options?.find(o => o.groupId === group.id)
      if (!selection) {
        if (group.isRequired) {
          throw createError({ statusCode: 400, statusMessage: `กรุณาเลือก "${group.name}" สำหรับ ${product.name}` })
        }
        continue
      }
      const choice = group.choices.find(c => c.id === selection.choiceId)
      if (!choice) {
        throw createError({ statusCode: 400, statusMessage: 'ตัวเลือกสินค้าไม่ถูกต้อง' })
      }
      resolvedOptions.push({ groupId: group.id, choiceId: choice.id, name: choice.name, priceDelta: choice.priceDelta })
    }
    const unitPrice = product.price + resolvedOptions.reduce((sum, o) => sum + o.priceDelta, 0)
    return { item, product, unitPrice, resolvedOptions }
  })

  const total = resolvedItems.reduce((sum, r) => sum + r.unitPrice * r.item.quantity, 0)

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

    tx.insert(orderItems).values(resolvedItems.map(({ item, product, unitPrice, resolvedOptions }) => ({
      orderId: order.id,
      productId: product.id,
      quantity: item.quantity,
      price: unitPrice,
      options: resolvedOptions.length ? resolvedOptions : null
    }))).run()

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
