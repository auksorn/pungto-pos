import { asc } from 'drizzle-orm'
import { db } from '../../db'
import { categories } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  return db.select().from(categories).orderBy(asc(categories.sortOrder))
})
