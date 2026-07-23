import { sql } from 'drizzle-orm'
import { db } from '../db'

// Public by design — used for uptime/liveness checks, so it deliberately
// doesn't require a session. Only confirms the DB is reachable; no data.
export default defineEventHandler(async () => {
  await db.execute(sql`select 1`)
  return { ok: true }
})
