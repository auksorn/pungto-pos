import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { optionGroups } from '../../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const productId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(productId)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  return db.query.optionGroups.findMany({
    where: eq(optionGroups.productId, productId),
    with: { choices: true }
  })
})
