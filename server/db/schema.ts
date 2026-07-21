import { relations, sql } from 'drizzle-orm'
import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ---------- Branches & Employees ----------

export const branches = sqliteTable('branches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  branchId: integer('branch_id').references(() => branches.id),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'manager', 'staff'] }).notNull().default('staff'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// ---------- Menu ----------

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0)
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id').references(() => categories.id),
  name: text('name').notNull(),
  price: real('price').notNull(),
  imageUrl: text('image_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// Option groups e.g. "ความหวาน", "ไซส์" with choices e.g. "หวานน้อย" (+0), "ไซส์ใหญ่" (+10)
export const optionGroups = sqliteTable('option_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(false)
})

export const optionChoices = sqliteTable('option_choices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  optionGroupId: integer('option_group_id').notNull().references(() => optionGroups.id),
  name: text('name').notNull(),
  priceDelta: real('price_delta').notNull().default(0)
})

// ---------- Inventory ----------

// Master catalog of raw materials, shared across branches (e.g. "นมสด" is the
// same ingredient everywhere — only its stock quantity is per-branch).
export const ingredients = sqliteTable('ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  unit: text('unit').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// Per-branch stock level for an ingredient
export const stockItems = sqliteTable('stock_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id),
  quantity: real('quantity').notNull().default(0),
  minThreshold: real('min_threshold').notNull().default(0)
}, table => [
  uniqueIndex('stock_items_branch_ingredient_unique').on(table.branchId, table.ingredientId)
])

// Recipe: how much of each ingredient a product consumes, regardless of branch
export const productIngredients = sqliteTable('product_ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id),
  quantity: real('quantity').notNull()
})

export const stockTransactions = sqliteTable('stock_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  stockItemId: integer('stock_item_id').notNull().references(() => stockItems.id),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  type: text('type', { enum: ['in', 'out', 'adjust'] }).notNull(),
  quantity: real('quantity').notNull(),
  reason: text('reason'),
  refOrderId: integer('ref_order_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// ---------- Orders & Payments ----------

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  status: text('status', { enum: ['open', 'paid', 'cancelled'] }).notNull().default('open'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  options: text('options', { mode: 'json' }).$type<Array<{ groupId: number, choiceId: number, name: string, priceDelta: number }>>(),
  quantity: integer('quantity').notNull().default(1),
  price: real('price').notNull()
})

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id),
  method: text('method', { enum: ['cash', 'transfer', 'qr'] }).notNull(),
  amount: real('amount').notNull(),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

// ---------- Relations ----------

export const branchesRelations = relations(branches, ({ many }) => ({
  employees: many(employees),
  stockItems: many(stockItems),
  orders: many(orders)
}))

export const employeesRelations = relations(employees, ({ one, many }) => ({
  branch: one(branches, { fields: [employees.branchId], references: [branches.id] }),
  orders: many(orders)
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products)
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  optionGroups: many(optionGroups),
  ingredients: many(productIngredients)
}))

export const optionGroupsRelations = relations(optionGroups, ({ one, many }) => ({
  product: one(products, { fields: [optionGroups.productId], references: [products.id] }),
  choices: many(optionChoices)
}))

export const optionChoicesRelations = relations(optionChoices, ({ one }) => ({
  group: one(optionGroups, { fields: [optionChoices.optionGroupId], references: [optionGroups.id] })
}))

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  stockItems: many(stockItems),
  productIngredients: many(productIngredients)
}))

export const stockItemsRelations = relations(stockItems, ({ one, many }) => ({
  branch: one(branches, { fields: [stockItems.branchId], references: [branches.id] }),
  ingredient: one(ingredients, { fields: [stockItems.ingredientId], references: [ingredients.id] }),
  transactions: many(stockTransactions)
}))

export const stockTransactionsRelations = relations(stockTransactions, ({ one }) => ({
  stockItem: one(stockItems, { fields: [stockTransactions.stockItemId], references: [stockItems.id] }),
  employee: one(employees, { fields: [stockTransactions.employeeId], references: [employees.id] })
}))

export const productIngredientsRelations = relations(productIngredients, ({ one }) => ({
  product: one(products, { fields: [productIngredients.productId], references: [products.id] }),
  ingredient: one(ingredients, { fields: [productIngredients.ingredientId], references: [ingredients.id] })
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  branch: one(branches, { fields: [orders.branchId], references: [branches.id] }),
  employee: one(employees, { fields: [orders.employeeId], references: [employees.id] }),
  items: many(orderItems),
  payments: many(payments)
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] })
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] })
}))
