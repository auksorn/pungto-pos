import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { branches, employees } from '../../db/schema'

const ROLES = ['owner', 'manager', 'staff'] as const

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner'])

  const body = await readBody<{ name?: string, username?: string, password?: string, role?: string, branchId?: number | null }>(event)
  const name = body?.name?.trim()
  const username = body?.username?.trim()
  const password = body?.password
  const role = body?.role

  if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อพนักงาน' })
  if (!username) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อผู้ใช้' })
  if (!password || password.length < 6) throw createError({ statusCode: 400, statusMessage: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
  if (!role || !ROLES.includes(role as typeof ROLES[number])) throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกตำแหน่ง' })

  const [existingUsername] = await db.select().from(employees).where(eq(employees.username, username)).limit(1)
  if (existingUsername) throw createError({ statusCode: 409, statusMessage: 'มีชื่อผู้ใช้นี้อยู่แล้ว' })

  const branchId = body?.branchId ?? null
  if (branchId) {
    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1)
    if (!branch) throw createError({ statusCode: 400, statusMessage: 'ไม่พบสาขาที่เลือก' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const [employee] = await db.insert(employees).values({
    name,
    username,
    passwordHash,
    role: role as typeof ROLES[number],
    branchId
  }).returning()

  const { passwordHash: _omit, ...safe } = employee!
  return safe
})
