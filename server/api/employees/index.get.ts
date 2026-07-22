import { asc } from 'drizzle-orm'
import { db } from '../../db'
import { employees } from '../../db/schema'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner'])

  return db.query.employees.findMany({
    columns: { passwordHash: false },
    with: { branch: true },
    orderBy: asc(employees.name)
  })
})
