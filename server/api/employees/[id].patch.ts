import bcrypt from 'bcryptjs'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '../../db'
import { branches, employees } from '../../db/schema'

const ROLES = ['owner', 'manager', 'staff'] as const

export default defineEventHandler(async (event) => {
  const { user } = await requireRole(event, ['owner'])

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody<{ name?: string, username?: string, password?: string, role?: string, branchId?: number | null, isActive?: boolean }>(event)

  if (id === user.id && body?.isActive === false) {
    throw createError({ statusCode: 400, statusMessage: 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้' })
  }

  const updates: Partial<typeof employees.$inferInsert> = {}

  if (body?.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อพนักงาน' })
    updates.name = name
  }

  if (body?.username !== undefined) {
    const username = body.username.trim()
    if (!username) throw createError({ statusCode: 400, statusMessage: 'กรุณากรอกชื่อผู้ใช้' })
    const [existing] = await db.select().from(employees).where(and(eq(employees.username, username), ne(employees.id, id))).limit(1)
    if (existing) throw createError({ statusCode: 409, statusMessage: 'มีชื่อผู้ใช้นี้อยู่แล้ว' })
    updates.username = username
  }

  if (body?.password) {
    if (body.password.length < 6) throw createError({ statusCode: 400, statusMessage: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
    updates.passwordHash = await bcrypt.hash(body.password, 10)
  }

  if (body?.role !== undefined) {
    if (!ROLES.includes(body.role as typeof ROLES[number])) throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกตำแหน่ง' })
    updates.role = body.role as typeof ROLES[number]
  }

  if (body?.branchId !== undefined) {
    if (body.branchId) {
      const [branch] = await db.select().from(branches).where(eq(branches.id, body.branchId)).limit(1)
      if (!branch) throw createError({ statusCode: 400, statusMessage: 'ไม่พบสาขาที่เลือก' })
    }
    updates.branchId = body.branchId
  }

  if (body?.isActive !== undefined) updates.isActive = body.isActive

  const [employee] = await db.update(employees).set(updates).where(eq(employees.id, id)).returning()
  if (!employee) {
    throw createError({ statusCode: 404, statusMessage: 'ไม่พบพนักงาน' })
  }

  const { passwordHash: _omit, ...safe } = employee
  return safe
})
