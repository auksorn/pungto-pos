import { asc } from 'drizzle-orm'
import { db } from '../../db'
import { products } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  return db.query.products.findMany({
    with: { category: true, optionGroups: { with: { choices: true } } },
    orderBy: asc(products.name)
  })
})
