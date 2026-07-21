import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './index'
import { branches, employees } from './schema'

async function seed() {
  let [mainBranch] = await db.select().from(branches).limit(1)
  if (!mainBranch) {
    [mainBranch] = await db.insert(branches).values({
      name: 'บังโต สาขาหลัก'
    }).returning()
    console.log(`Created branch: ${mainBranch.name}`)
  }

  const [existingOwner] = await db.select().from(employees).where(eq(employees.username, 'owner')).limit(1)
  if (existingOwner) {
    console.log('Owner account already exists, skipping.')
    return
  }

  const passwordHash = await bcrypt.hash('changeme123', 10)
  await db.insert(employees).values({
    branchId: mainBranch.id,
    name: 'เจ้าของร้าน',
    username: 'owner',
    passwordHash,
    role: 'owner'
  })

  console.log('Created owner account -> username: owner / password: changeme123')
  console.log('Please change this password after first login.')
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
