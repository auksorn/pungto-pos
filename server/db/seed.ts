import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { db } from './index'
import { branches, employees, categories, products, ingredients, stockItems, productIngredients, optionGroups, optionChoices } from './schema'

// Every step below is idempotent (checked by natural key: name/username) so
// this script is safe to re-run against a database that already has data —
// it only fills in whatever demo rows are still missing.

async function ensureBranch(name: string) {
  const [existing] = await db.select().from(branches).where(eq(branches.name, name)).limit(1)
  if (existing) return existing
  const [created] = await db.insert(branches).values({ name }).returning()
  console.log(`Created branch: ${created!.name}`)
  return created!
}

async function ensureEmployee(opts: { username: string, name: string, role: 'owner' | 'manager' | 'staff', branchId: number | null, code?: string }) {
  const [existing] = await db.select().from(employees).where(eq(employees.username, opts.username)).limit(1)
  if (existing) {
    if (opts.code && !existing.code) {
      const [updated] = await db.update(employees).set({ code: opts.code }).where(eq(employees.id, existing.id)).returning()
      console.log(`Set clock-in code for ${updated!.username}: ${opts.code}`)
      return updated!
    }
    return existing
  }
  const passwordHash = await bcrypt.hash('changeme123', 10)
  const [created] = await db.insert(employees).values({ ...opts, passwordHash }).returning()
  console.log(`Created employee: ${created!.username} (${created!.role}) / password: changeme123`)
  return created!
}

async function ensureCategory(name: string, sortOrder: number) {
  const [existing] = await db.select().from(categories).where(eq(categories.name, name)).limit(1)
  if (existing) return existing
  const [created] = await db.insert(categories).values({ name, sortOrder }).returning()
  console.log(`Created category: ${created!.name}`)
  return created!
}

async function ensureProduct(opts: { name: string, price: number, categoryId: number }) {
  const [existing] = await db.select().from(products).where(eq(products.name, opts.name)).limit(1)
  if (existing) return existing
  const [created] = await db.insert(products).values(opts).returning()
  console.log(`Created product: ${created!.name}`)
  return created!
}

async function ensureIngredient(opts: { name: string, unit: string, costPerUnit: number }) {
  const [existing] = await db.select().from(ingredients).where(eq(ingredients.name, opts.name)).limit(1)
  if (existing) return existing
  const [created] = await db.insert(ingredients).values(opts).returning()
  console.log(`Created ingredient: ${created!.name}`)
  return created!
}

async function ensureStockItem(branchId: number, ingredientId: number, quantity: number, minThreshold: number) {
  const [existing] = await db.select().from(stockItems)
    .where(and(eq(stockItems.branchId, branchId), eq(stockItems.ingredientId, ingredientId)))
    .limit(1)
  if (existing) return existing
  const [created] = await db.insert(stockItems).values({ branchId, ingredientId, quantity, minThreshold }).returning()
  return created!
}

async function ensureRecipe(productId: number, ingredientId: number, quantity: number) {
  const rows = await db.select().from(productIngredients).where(eq(productIngredients.productId, productId))
  if (rows.some(r => r.ingredientId === ingredientId)) return
  await db.insert(productIngredients).values({ productId, ingredientId, quantity })
}

async function ensureOptionGroup(productId: number, name: string, isRequired: boolean, choices: Array<{ name: string, priceDelta: number }>) {
  const rows = await db.select().from(optionGroups).where(eq(optionGroups.productId, productId))
  const existing = rows.find(g => g.name === name)
  if (existing) return existing
  const [group] = await db.insert(optionGroups).values({ productId, name, isRequired }).returning()
  await db.insert(optionChoices).values(choices.map(c => ({ optionGroupId: group!.id, name: c.name, priceDelta: c.priceDelta })))
  console.log(`Created option group: ${group!.name}`)
  return group!
}

async function seed() {
  const mainBranch = await ensureBranch('บังโต สาขาหลัก')
  await ensureBranch('บังโต สาขา 2 (สาขาย่อย)')

  await ensureEmployee({ username: 'owner', name: 'เจ้าของร้าน', role: 'owner', branchId: mainBranch.id, code: '1111' })
  await ensureEmployee({ username: 'manager1', name: 'ผู้จัดการสาขาหลัก', role: 'manager', branchId: mainBranch.id, code: '2222' })
  await ensureEmployee({ username: 'staff1', name: 'พนักงานสาขาหลัก', role: 'staff', branchId: mainBranch.id, code: '3333' })

  const drinks = await ensureCategory('เครื่องดื่ม', 0)
  const snacks = await ensureCategory('ขนม', 1)

  const milkTea = await ensureProduct({ name: 'ชานมไข่มุก', price: 45, categoryId: drinks.id })
  await ensureProduct({ name: 'ชาไทย', price: 40, categoryId: drinks.id })
  await ensureProduct({ name: 'โกโก้เย็น', price: 45, categoryId: drinks.id })
  await ensureProduct({ name: 'มัชฉะลาเต้', price: 55, categoryId: drinks.id })
  await ensureProduct({ name: 'คุกกี้ช็อกโกแลตชิพ', price: 25, categoryId: snacks.id })
  await ensureProduct({ name: 'บราวนี่', price: 35, categoryId: snacks.id })

  const tea = await ensureIngredient({ name: 'ใบชา', unit: 'กรัม', costPerUnit: 0.8 })
  const milk = await ensureIngredient({ name: 'นมสด', unit: 'มล.', costPerUnit: 0.05 })
  const pearls = await ensureIngredient({ name: 'ไข่มุก', unit: 'กรัม', costPerUnit: 0.3 })
  const sugar = await ensureIngredient({ name: 'น้ำเชื่อม', unit: 'มล.', costPerUnit: 0.1 })

  for (const ingredient of [tea, milk, pearls, sugar]) {
    await ensureStockItem(mainBranch.id, ingredient.id, 5000, 1000)
  }

  await ensureRecipe(milkTea.id, tea.id, 10)
  await ensureRecipe(milkTea.id, milk.id, 150)
  await ensureRecipe(milkTea.id, pearls.id, 50)
  await ensureRecipe(milkTea.id, sugar.id, 20)

  await ensureOptionGroup(milkTea.id, 'ความหวาน', true, [
    { name: 'หวานปกติ', priceDelta: 0 },
    { name: 'หวานน้อย', priceDelta: 0 },
    { name: 'ไม่หวาน', priceDelta: 0 }
  ])
  await ensureOptionGroup(milkTea.id, 'ไซส์', true, [
    { name: 'ปกติ', priceDelta: 0 },
    { name: 'ใหญ่', priceDelta: 10 }
  ])

  console.log('Seed complete.')
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
