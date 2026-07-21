import { asc } from 'drizzle-orm'
import { db } from '../../db'
import { branches } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  return db.select().from(branches).orderBy(asc(branches.name))
})
