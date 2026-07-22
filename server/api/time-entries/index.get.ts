import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { db } from '../../db'
import { timeEntries } from '../../db/schema'

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

  const fromDate = parseLocalDate(from)
  const toDate = new Date(parseLocalDate(to).getTime() + 24 * 60 * 60 * 1000)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
    throw createError({ statusCode: 400, statusMessage: 'ช่วงวันที่ไม่ถูกต้อง' })
  }

  return db.query.timeEntries.findMany({
    where: and(
      gte(timeEntries.clockIn, fromDate),
      lt(timeEntries.clockIn, toDate),
      branchId ? eq(timeEntries.branchId, branchId) : undefined
    ),
    with: {
      employee: { columns: { id: true, name: true } },
      branch: { columns: { id: true, name: true } }
    },
    orderBy: desc(timeEntries.clockIn)
  })
})
