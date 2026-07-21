# TODO - ระบบ POS ร้านบังโต

ร้านขายเครื่องดื่ม (ชานมไข่มุก, มัชฉะ ฯลฯ) และขนมเล็กๆน้อยๆ
Stack: Nuxt 3 (fullstack) + SQLite

## 0. Project Setup
- [x] Init Nuxt 3 project (`nuxi init`, Nuxt UI template, npm)
- [x] เลือก ORM สำหรับ SQLite (Drizzle ORM + better-sqlite3)
- [x] ตั้งค่า SQLite database file + migration tool (drizzle-kit, `data/pos.db`)
- [x] ตั้งค่า UI framework (Nuxt UI / Tailwind v4, มากับ template)
- [x] ตั้งค่า ESLint/Prettier, tsconfig (มากับ template)
- [ ] โครงสร้าง server API (`server/api/**`) และ layer สำหรับ multi-branch (มีแค่ `/api/health` ตอนนี้)

## 1. Data Model (Schema Design)
- [x] `branches` (สาขา) - id, name, address, phone, is_active
- [x] `employees` (พนักงาน) - id, branch_id, name, username, password_hash, role (owner/manager/staff)
- [x] `categories` (หมวดหมู่สินค้า) - เช่น เครื่องดื่ม, ขนม
- [x] `products` (สินค้า/เมนู) - id, category_id, name, price, image, is_active
- [x] `option_groups` / `option_choices` (ตัวเลือก เช่น หวานน้อย/ไข่มุก/ไซส์) - price adjustment
- [x] `stock_items` (วัตถุดิบ/สต๊อก) - id, branch_id, name, unit, quantity, min_threshold
- [x] `product_ingredients` (recipe mapping: 1 สินค้า ใช้วัตถุดิบอะไรบ้าง ปริมาณเท่าไหร่)
- [x] `orders` - id, branch_id, employee_id, status (open/paid/cancelled), created_at
- [x] `order_items` - order_id, product_id, options (json), quantity, price
- [x] `payments` - order_id, method (cash/transfer/qr), amount, received_at
- [x] `stock_transactions` - stock_item_id, branch_id, type (in/out/adjust), quantity, reason, ref_order_id

> Schema: [server/db/schema.ts](server/db/schema.ts) · Migrations: `server/db/migrations` · DB client: [server/db/index.ts](server/db/index.ts)
> Scripts: `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`

## 2. Authentication & Employee Management
- [x] ระบบ login พนักงาน (username/password, bcrypt hash)
- [x] Session (sealed cookie ผ่าน `nuxt-auth-utils`) + global middleware ป้องกัน route
- [x] แบ่ง role: owner, manager, staff (เก็บใน schema + session)
- [ ] CRUD จัดการพนักงาน (เพิ่ม/ลบ/แก้ไข, กำหนดสาขาที่สังกัด) — ตอนนี้มีแค่ seed script สร้าง owner คนแรก
- [ ] Clock-in/Clock-out (ถ้าต้องการ track เวลาเข้างาน) — optional

> Login: [app/pages/login.vue](app/pages/login.vue) · API: [server/api/auth/](server/api/auth/) · Middleware: [app/middleware/auth.global.ts](app/middleware/auth.global.ts)
> Seed a first owner account: `npm run db:seed` (username: `owner` / password: `changeme123` — เปลี่ยนหลัง login ครั้งแรก)

## 3. จัดการสาขา (Multi-branch)
- [x] CRUD สาขา (เพิ่ม/แก้ไข/ปิดสาขา — owner เท่านั้น, ปิดสาขาใช้ soft-delete เหมือนสินค้า)
- [x] Switch branch สำหรับ owner (เลือกสาขาใดสาขาหนึ่ง หรือ "ทุกสาขา") — manager/staff ยังคงผูกกับสาขาที่สังกัดตายตัว (`employees.branch_id`), ยังไม่มีการ "เลือกสาขาตอน login" แยกต่างหาก (ใช้ switcher ในหัวเว็บแทน)
- [x] แยกข้อมูล order, stock ตามสาขา (ผ่าน `branch_id` + effective branch จาก session) — report ยังไม่มี (ดูข้อ 8)
- [ ] Dashboard เปรียบเทียบยอดขายระหว่างสาขา (สำหรับแอดมิน) — โหมด "ทุกสาขา" ตอนนี้แค่แสดงสต๊อกรวม ยังไม่มีสรุปยอดขาย

> หน้าจัดการ: [app/pages/branches/index.vue](app/pages/branches/index.vue) (owner เท่านั้น) · API: [server/api/branches/](server/api/branches/)
> Branch switcher: dropdown ในหัวเว็บ (เฉพาะ owner) · API: `POST /api/auth/branch` (`branchId: number | null`, null = ทุกสาขา) · การขาย/รับสต๊อกต้องเลือกสาขาใดสาขาหนึ่งก่อนเสมอ (โหมดทุกสาขาดูได้อย่างเดียว)

## 4. จัดการเมนู/สินค้า
- [x] CRUD หมวดหมู่สินค้า (บล็อกการลบถ้ายังมีสินค้าอยู่ในหมวดหมู่)
- [x] CRUD สินค้า (ชื่อ, ราคา, รูป, หมวดหมู่, เปิด/ปิดขาย — ปิดขายใช้ soft-delete เพื่อไม่กระทบประวัติออเดอร์ในอนาคต)
- [ ] ตั้งค่าตัวเลือกสินค้า (ความหวาน, ท็อปปิ้ง/ไข่มุก, ไซส์, ร้อน/เย็น) พร้อมราคาเพิ่ม — schema มีแล้ว (`option_groups`/`option_choices`) แต่ยังไม่มี UI
- [ ] เชื่อมสินค้ากับสูตร/วัตถุดิบที่ใช้ (สำหรับตัดสต๊อกอัตโนมัติ)

> หน้าจัดการ: [app/pages/menu/index.vue](app/pages/menu/index.vue) (จำกัดสิทธิ์ owner/manager) · API: [server/api/categories/](server/api/categories/), [server/api/products/](server/api/products/)

## 5. ระบบรับออเดอร์ (Order Taking)
- [x] หน้าจอ POS เลือกสินค้า + จำนวน (ยังไม่รวมตัวเลือกสินค้า เช่น ความหวาน/ไซส์)
- [x] ตะกร้าออเดอร์ (เพิ่ม/ลบ/แก้ไขจำนวน)
- [ ] รองรับหมายเลขโต๊ะ/ชื่อลูกค้า/เลขคิว (ถ้าต้องการ)
- [x] ~~บันทึกออเดอร์เป็นสถานะ "รอชำระ" (open order)~~ — ตัดออกแล้ว ร้านนี้ชำระเงินทันทีหลังสั่งเสมอ ไม่มีแนวคิดออเดอร์ค้างชำระ (ดูข้อ 6)
- [x] ~~แก้ไข/ยกเลิกออเดอร์ก่อนชำระเงิน~~ — ตัดออกแล้ว ด้วยเหตุผลเดียวกัน
- [ ] พิมพ์/แสดงใบสั่งสำหรับเตรียมเครื่องดื่ม (kitchen ticket) — optional

## 6. ระบบคิดเงิน (Checkout/Billing)
- [x] flow เดียว: ตะกร้า → "ชำระเงิน" เปิด modal ทันที → ยืนยัน → สร้างออเดอร์และชำระเงินในคำขอเดียว (atomic transaction ไม่มีออเดอร์ค้างถ้าชำระไม่สำเร็จ) → หน้าใบเสร็จ
- [ ] คำนวณยอดรวม, ส่วนลด (ถ้ามี), VAT (ถ้ามี) — ยังไม่มีส่วนลด/VAT (ไม่ระบุว่าจำเป็น)
- [x] เลือกช่องทางชำระเงิน (เงินสด/โอน/QR พร้อมเพย์)
- [x] คำนวณเงินทอน (กรณีเงินสด)
- [ ] พิมพ์/แสดงใบเสร็จ (receipt) — มีหน้าใบเสร็จสรุปแล้ว แต่ยังไม่มีรูปแบบสำหรับพิมพ์
- [ ] ปิดออเดอร์ → ตัดสต๊อกอัตโนมัติตาม recipe — รอทำหลังมีระบบสต๊อกพื้นฐาน (ข้อ 7)

> POS (ตะกร้า+ชำระเงินทันที): [app/pages/pos/index.vue](app/pages/pos/index.vue) · หน้าใบเสร็จ: [app/pages/pos/orders/[id].vue](app/pages/pos/orders/%5Bid%5D.vue) · API: [server/api/orders/](server/api/orders/) (`POST /checkout` = สร้าง+จ่ายในคำขอเดียว — endpoint เดียวที่สร้างออเดอร์ได้)

## 7. จัดการสต๊อก (Inventory)
- [x] CRUD วัตถุดิบ/สต๊อกต่อสาขา (เพิ่ม/แก้ไข/ลบ — จำกัดสิทธิ์ owner/manager, ลบไม่ได้ถ้ามีประวัติรายการหรือถูกใช้ในสูตรสินค้า)
- [x] รับสินค้าเข้าสต๊อก (stock in) พร้อมบันทึกผู้ทำรายการ (เพิ่มคอลัมน์ `employee_id` ใน `stock_transactions`)
- [ ] ตัดสต๊อกอัตโนมัติเมื่อขายสินค้า (ตาม recipe mapping) — รอทำ (ต้องมี UI ผูกสูตรสินค้ากับวัตถุดิบก่อน ดูข้อ 4)
- [x] ปรับสต๊อกด้วยมือ (stock adjustment) พร้อมเหตุผล (ต้องระบุเหตุผลสำหรับ เบิกออก/ปรับยอด)
- [x] แจ้งเตือนสต๊อกใกล้หมด (min threshold) — badge "สต๊อกใกล้หมด" ในหน้าจัดการสต๊อก
- [x] ประวัติการเคลื่อนไหวสต๊อก (stock transaction log) — API พร้อมใช้ (`GET /api/stock-items/:id/transactions`), ยังไม่มี UI แสดงประวัติในหน้าเว็บ

> หน้าจัดการ: [app/pages/stock/index.vue](app/pages/stock/index.vue) (ทุกคนทำรายการเข้า/ออกได้ แก้ไข/ลบวัตถุดิบจำกัด owner/manager) · API: [server/api/stock-items/](server/api/stock-items/)

## 8. รายงาน/Dashboard
- [ ] ยอดขายรายวัน/รายเดือน ต่อสาขา
- [ ] สินค้าขายดี
- [ ] สรุปยอดตามช่องทางชำระเงิน
- [ ] มูลค่าสต๊อกคงเหลือ / รายการใกล้หมด
- [ ] สรุปยอดขายตามพนักงาน (optional)

## 9. Non-functional / Deployment
- [ ] Responsive UI สำหรับ tablet (หน้าจอขายหน้าร้าน)
- [ ] Backup ฐานข้อมูล SQLite (scheduled backup)
- [ ] Error handling + validation (server-side)
- [ ] Seed data สำหรับทดสอบ (เมนู, สาขา, พนักงานตัวอย่าง)
- [ ] Deploy plan (เช่น host บน VPS/NAS, หรือ local server ที่ร้าน)

## Suggested build order (MVP first)
1. Setup + schema + auth (พนักงาน login)
2. จัดการเมนู/สินค้า (ยังไม่ต้องมี option ซับซ้อน)
3. รับออเดอร์ + คิดเงิน (flow หลักของร้าน)
4. จัดการสต๊อกแบบพื้นฐาน (manual in/out)
5. Multi-branch support
6. ตัดสต๊อกอัตโนมัติจาก recipe + รายงาน
7. ตัวเลือกสินค้าขั้นสูง (หวาน/ไข่มุก/ไซส์) + ระบบพนักงานแบบละเอียด (role, clock-in)
