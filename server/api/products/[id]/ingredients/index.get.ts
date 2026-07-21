import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { productIngredients } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const productId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(productId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  return db.query.productIngredients.findMany({
    where: eq(productIngredients.productId, productId),
    with: { ingredient: true }
  })
})
