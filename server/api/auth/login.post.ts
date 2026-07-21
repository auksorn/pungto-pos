import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { employees, branches } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string, password?: string }>(event)
  const username = body?.username?.trim()
  const password = body?.password

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' })
  }

  const [employee] = await db.select().from(employees).where(eq(employees.username, username)).limit(1)
  if (!employee || !employee.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
  }

  const valid = await bcrypt.compare(password, employee.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
  }

  let branchName: string | null = null
  if (employee.branchId) {
    const [branch] = await db.select().from(branches).where(eq(branches.id, employee.branchId)).limit(1)
    branchName = branch?.name ?? null
  }

  await setUserSession(event, {
    user: {
      id: employee.id,
      username: employee.username,
      name: employee.name,
      role: employee.role,
      branchId: employee.branchId,
      activeBranchId: employee.branchId,
      branchName
    }
  })

  return { ok: true }
})
