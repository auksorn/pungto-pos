import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { employees } from '../../db/schema'

const CODE_RE = /^\d{4,8}$/

// Resolves a staff PIN to { id, name } — used by the POS page to identify
// who's actually taking orders on a shared terminal, separate from whichever
// account the terminal happens to be logged in as. Read-only; checkout itself
// re-resolves the code server-side rather than trusting a client-sent id.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readBody<{ code?: string }>(event)
  const code = body?.code?.trim()
  if (!code || !CODE_RE.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกรหัสพนักงานให้ถูกต้อง' })
  }

  const [employee] = await db.select({ id: employees.id, name: employees.name, isActive: employees.isActive })
    .from(employees).where(eq(employees.code, code)).limit(1)
  if (!employee || !employee.isActive) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบรหัสพนักงานนี้ หรือบัญชีถูกปิดใช้งาน' })
  }

  return { id: employee.id, name: employee.name }
})
