import { relations } from 'drizzle-orm'
import { pgTable, text, integer, serial, boolean, doublePrecision, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'

// ---------- Branches & Employees ----------

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'manager', 'staff'] }).notNull().default('staff'),
  isActive: boolean('is_active').notNull().default(true),
  // Short numeric PIN staff punch into the shared clock-in kiosk with — separate
  // from username/password so nobody has to log the shared terminal in/out of
  // their own account just to clock in. Nullable: not every employee needs one.
  code: text('code').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// Clock-in/out: one open row (clockOut = null) per employee at a time
export const timeEntries = pgTable('time_entries', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  clockIn: timestamp('clock_in', { withTimezone: true }).notNull().defaultNow(),
  clockOut: timestamp('clock_out', { withTimezone: true })
})

// ---------- Menu ----------

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0)
})

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id),
  name: text('name').notNull(),
  price: doublePrecision('price').notNull(),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// Option groups e.g. "ความหวาน", "ไซส์" with choices e.g. "หวานน้อย" (+0), "ไซส์ใหญ่" (+10)
export const optionGroups = pgTable('option_groups', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  isRequired: boolean('is_required').notNull().default(false)
})

export const optionChoices = pgTable('option_choices', {
  id: serial('id').primaryKey(),
  optionGroupId: integer('option_group_id').notNull().references(() => optionGroups.id),
  name: text('name').notNull(),
  priceDelta: doublePrecision('price_delta').notNull().default(0)
})

// ---------- Inventory ----------

// Master catalog of raw materials, shared across branches (e.g. "นมสด" is the
// same ingredient everywhere — only its stock quantity is per-branch).
export const ingredients = pgTable('ingredients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  unit: text('unit').notNull(),
  // Cost per unit (บาท), shared across branches like the rest of the catalog.
  // Nullable/0 means "unknown" — reports fall back to showing item counts
  // instead of a currency value for ingredients with no cost set.
  costPerUnit: doublePrecision('cost_per_unit').notNull().default(0),
  // Uploaded photo, compressed server-side — see server/api/uploads/image.post.ts
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// Per-branch stock level for an ingredient
export const stockItems = pgTable('stock_items', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id),
  quantity: doublePrecision('quantity').notNull().default(0),
  minThreshold: doublePrecision('min_threshold').notNull().default(0)
}, table => [
  uniqueIndex('stock_items_branch_ingredient_unique').on(table.branchId, table.ingredientId)
])

// Recipe: how much of each ingredient a product consumes, regardless of branch
export const productIngredients = pgTable('product_ingredients', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  ingredientId: integer('ingredient_id').notNull().references(() => ingredients.id),
  quantity: doublePrecision('quantity').notNull()
})

export const stockTransactions = pgTable('stock_transactions', {
  id: serial('id').primaryKey(),
  stockItemId: integer('stock_item_id').notNull().references(() => stockItems.id),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  type: text('type', { enum: ['in', 'out', 'adjust'] }).notNull(),
  quantity: doublePrecision('quantity').notNull(),
  reason: text('reason'),
  refOrderId: integer('ref_order_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// ---------- Orders & Payments ----------

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').notNull().references(() => branches.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  status: text('status', { enum: ['open', 'paid', 'cancelled'] }).notNull().default('open'),
  // Free-text: table number, customer name, or queue number — whatever this
  // branch finds useful. Optional, shown on the receipt/kitchen ticket.
  note: text('note'),
  discountAmount: doublePrecision('discount_amount').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  options: jsonb('options').$type<Array<{ groupId: number, choiceId: number, name: string, priceDelta: number }>>(),
  quantity: integer('quantity').notNull().default(1),
  price: doublePrecision('price').notNull()
})

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  method: text('method', { enum: ['cash', 'transfer', 'qr'] }).notNull(),
  amount: doublePrecision('amount').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow()
})

// ---------- Relations ----------

export const branchesRelations = relations(branches, ({ many }) => ({
  employees: many(employees),
  stockItems: many(stockItems),
  orders: many(orders)
}))

export const employeesRelations = relations(employees, ({ one, many }) => ({
  branch: one(branches, { fields: [employees.branchId], references: [branches.id] }),
  orders: many(orders),
  timeEntries: many(timeEntries)
}))

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  employee: one(employees, { fields: [timeEntries.employeeId], references: [employees.id] }),
  branch: one(branches, { fields: [timeEntries.branchId], references: [branches.id] })
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
