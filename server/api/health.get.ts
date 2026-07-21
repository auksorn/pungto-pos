import { db } from '../db'
import { branches } from '../db/schema'

export default defineEventHandler(async () => {
  const rows = await db.select().from(branches)
  return { ok: true, branches: rows.length }
})
