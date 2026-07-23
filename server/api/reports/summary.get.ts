import { and, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '../../db'
import { branches, employees, orderItems, orders, payments, products, stockItems } from '../../db/schema'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseLocalDate(value: string) {
  const parts = value.split('-').map(Number)
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!)
}

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, ['owner', 'manager'])
  const branchId = getEffectiveBranchId(user)

  const query = getQuery(event)
  const from = typeof query.from === 'string' && DATE_RE.test(query.from) ? query.from : new Date().toISOString().slice(0, 10)
  const to = typeof query.to === 'string' && DATE_RE.test(query.to) ? query.to : from
  const groupBy = query.groupBy === 'month' ? 'month' : 'day'

  const fromDate = parseLocalDate(from)
  const toDate = new Date(parseLocalDate(to).getTime() + 24 * 60 * 60 * 1000)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
    throw createError({ statusCode: 400, statusMessage: 'ช่วงวันที่ไม่ถูกต้อง' })
  }

  const paidInRange = and(
    eq(orders.status, 'paid'),
    gte(orders.createdAt, fromDate),
    lt(orders.createdAt, toDate),
    branchId ? eq(orders.branchId, branchId) : undefined
  )

  const revenueExpr = sql<number>`coalesce(sum(${payments.amount}), 0)`
  const orderCountExpr = sql<number>`count(distinct ${orders.id})`

  const [totals] = await db.select({ revenue: revenueExpr, orderCount: orderCountExpr })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(paidInRange)

  const periodExpr = groupBy === 'month'
    ? sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM')`
    : sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD')`

  const trend = await db.select({ period: periodExpr, revenue: revenueExpr, orderCount: orderCountExpr })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(paidInRange)
    .groupBy(periodExpr)
    .orderBy(periodExpr)

  const byBranch = await db.select({ branchId: orders.branchId, branchName: branches.name, revenue: revenueExpr, orderCount: orderCountExpr })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .innerJoin(branches, eq(branches.id, orders.branchId))
    .where(paidInRange)
    .groupBy(orders.branchId, branches.name)
    .orderBy(desc(revenueExpr))

  const methodAmountExpr = sql<number>`coalesce(sum(${payments.amount}), 0)`
  const methodCountExpr = sql<number>`count(*)`
  const byPaymentMethod = await db.select({ method: payments.method, amount: methodAmountExpr, count: methodCountExpr })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(paidInRange)
    .groupBy(payments.method)
    .orderBy(desc(methodAmountExpr))

  const quantityExpr = sql<number>`coalesce(sum(${orderItems.quantity}), 0)`
  const itemRevenueExpr = sql<number>`coalesce(sum(${orderItems.price} * ${orderItems.quantity}), 0)`
  const topProducts = await db.select({ productId: orderItems.productId, name: products.name, quantity: quantityExpr, revenue: itemRevenueExpr })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(paidInRange)
    .groupBy(orderItems.productId, products.name)
    .orderBy(desc(quantityExpr))
    .limit(10)

  const byEmployee = await db.select({ employeeId: orders.employeeId, name: employees.name, revenue: revenueExpr, orderCount: orderCountExpr })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .innerJoin(employees, eq(employees.id, orders.employeeId))
    .where(paidInRange)
    .groupBy(orders.employeeId, employees.name)
    .orderBy(desc(revenueExpr))

  // Current stock snapshot (not date-ranged). Ingredients with no cost set
  // (costPerUnit = 0, the default for anything never priced) don't contribute
  // to totalValue — there's no way to tell "free" apart from "unknown cost".
  const stockRows = await db.query.stockItems.findMany({
    where: branchId ? eq(stockItems.branchId, branchId) : undefined,
    with: { ingredient: true, branch: true }
  })
  const lowStockItems = stockRows
    .filter(r => r.quantity <= r.minThreshold)
    .sort((a, b) => (a.quantity - a.minThreshold) - (b.quantity - b.minThreshold))
    .map(r => ({ ingredientName: r.ingredient.name, unit: r.ingredient.unit, branchName: r.branch.name, quantity: r.quantity, minThreshold: r.minThreshold }))
  const totalValue = stockRows.reduce((sum, r) => sum + r.quantity * r.ingredient.costPerUnit, 0)
  const uncostedCount = stockRows.filter(r => r.ingredient.costPerUnit <= 0).length

  return {
    from,
    to,
    groupBy,
    totals: {
      revenue: totals?.revenue ?? 0,
      orderCount: totals?.orderCount ?? 0,
      avgOrder: totals?.orderCount ? totals.revenue / totals.orderCount : 0
    },
    trend,
    byBranch,
    byPaymentMethod,
    topProducts,
    byEmployee,
    stock: {
      totalItems: stockRows.length,
      totalValue,
      uncostedCount,
      lowStockCount: lowStockItems.length,
      lowStockItems
    }
  }
})
