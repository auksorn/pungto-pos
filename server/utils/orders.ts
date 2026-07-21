import { eq } from 'drizzle-orm'
import { db } from '../db'
import { orders } from '../db/schema'

export function getOrderDetail(id: number) {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: { with: { product: true } },
      employee: { columns: { id: true, name: true, username: true, role: true } },
      payments: true
    }
  })
}
