import { asc } from 'drizzle-orm'
import { db } from '../../db'
import { ingredients } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  return db.select().from(ingredients).orderBy(asc(ingredients.name))
})
