import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { employees, timeEntries } from '../../db/schema'

const CODE_RE = /^\d{4,8}$/

// Any logged-in session can call this (it's meant for a shared POS terminal),
// but the code — not the session's own account — decides whose time entry
// gets toggled, so staff don't have to log the terminal in/out of their own
// account just to punch in.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody<{ code?: string }>(event)
  const code = body?.code?.trim()
  if (!code || !CODE_RE.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกรหัสพนักงานให้ถูกต้อง' })
  }

  const [employee] = await db.select().from(employees).where(eq(employees.code, code)).limit(1)
  if (!employee || !employee.isActive) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบรหัสพนักงานนี้ หรือบัญชีถูกปิดใช้งาน' })
  }
  if (!employee.branchId) {
    throw createError({ statusCode: 400, statusMessage: 'พนักงานคนนี้ยังไม่ได้สังกัดสาขา กรุณาติดต่อผู้ดูแลระบบ' })
  }

  const existing = await db.query.timeEntries.findFirst({
    where: and(eq(timeEntries.employeeId, employee.id), isNull(timeEntries.clockOut))
  })

  if (existing) {
    const [entry] = await db.update(timeEntries).set({ clockOut: new Date() }).where(eq(timeEntries.id, existing.id)).returning()
    return { action: 'out' as const, employeeName: employee.name, entry: entry! }
  }

  const [entry] = await db.insert(timeEntries).values({ employeeId: employee.id, branchId: employee.branchId }).returning()
  return { action: 'in' as const, employeeName: employee.name, entry: entry! }
})
