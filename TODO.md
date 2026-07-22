# TODO - ระบบ POS ร้านบังโต

ร้านขายเครื่องดื่ม (ชานมไข่มุก, มัชฉะ ฯลฯ) และขนมเล็กๆน้อยๆ
Stack: Nuxt 3 (fullstack) + SQLite

## 0. Project Setup
- [x] Init Nuxt 3 project (`nuxi init`, Nuxt UI template, npm)
- [x] เลือก ORM สำหรับ SQLite (Drizzle ORM + better-sqlite3)
- [x] ตั้งค่า SQLite database file + migration tool (drizzle-kit, `data/pos.db`)
- [x] ตั้งค่า UI framework (Nuxt UI / Tailwind v4, มากับ template)
- [x] ตั้งค่า ESLint/Prettier, tsconfig (มากับ template)
- [x] โครงสร้าง server API (`server/api/**`) และ layer สำหรับ multi-branch — ครบทุกโดเมน (auth, branches, employees, categories, products, option-groups, ingredients, stock-items, orders, reports, time-entries) ใช้ `requireRole`/`getEffectiveBranchId`/`requireEffectiveBranchId` ร่วมกันเป็น layer กลาง

## 1. Data Model (Schema Design)
- [x] `branches` (สาขา) - id, name, address, phone, is_active
- [x] `employees` (พนักงาน) - id, branch_id, name, username, password_hash, role (owner/manager/staff)
- [x] `categories` (หมวดหมู่สินค้า) - เช่น เครื่องดื่ม, ขนม
- [x] `products` (สินค้า/เมนู) - id, category_id, name, price, image, is_active
- [x] `option_groups` / `option_choices` (ตัวเลือก เช่น หวานน้อย/ไข่มุก/ไซส์) - price adjustment
- [x] `ingredients` (แคตตาล็อกวัตถุดิบกลาง ใช้ร่วมกันทุกสาขา) - id, name, unit
- [x] `stock_items` (สต๊อกของแต่ละสาขา) - id, branch_id, ingredient_id, quantity, min_threshold
- [x] `product_ingredients` (recipe mapping: 1 สินค้า ใช้วัตถุดิบอะไรบ้าง ปริมาณเท่าไหร่ — อ้างอิง ingredient_id ไม่ผูกกับสาขา)
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
- [x] CRUD จัดการพนักงาน (เพิ่ม/แก้ไข, กำหนดสาขาที่สังกัดและตำแหน่ง — owner เท่านั้น, ไม่มีลบจริงเพราะพนักงานถูกอ้างอิงในประวัติออเดอร์/สต๊อก ใช้ปิดใช้งานแทน เหมือนสาขา/สินค้า; ห้ามปิดใช้งานบัญชีตัวเอง)
- [x] Clock-in/Clock-out (track เวลาเข้างานแต่ละคน) — พนักงานแต่ละคนมี "รหัสเข้างาน" (PIN 4-8 หลัก, ตั้ง/แก้ไขได้ในหน้าจัดการพนักงาน) กดปุ่ม "เข้า-ออกงาน" ที่หัวเว็บ (ทุก role เห็น ไม่ต้อง login ด้วยบัญชีของตัวเองก่อน — ใช้ได้แม้เครื่อง POS ล็อกอินค้างไว้ด้วยบัญชีอื่น) แล้วกรอกรหัสของตัวเอง ระบบจะเข้า/ออกงานให้อัตโนมัติตามรหัสที่กรอก, หน้า "เวลาเข้างาน" สรุปประวัติทั้งหมด (owner/manager, กรองตามช่วงวันที่)

> Login: [app/pages/login.vue](app/pages/login.vue) · API: [server/api/auth/](server/api/auth/) · Middleware: [app/middleware/auth.global.ts](app/middleware/auth.global.ts)
> จัดการพนักงาน: [app/pages/employees/index.vue](app/pages/employees/index.vue) (owner เท่านั้น, ตั้งรหัสเข้างานที่นี่) · API: [server/api/employees/](server/api/employees/)
> เวลาเข้างาน: ปุ่ม "เข้า-ออกงาน" ใน [app/app.vue](app/app.vue) (กรอกรหัส PIN, ทุก role) · หน้า [app/pages/time-entries/index.vue](app/pages/time-entries/index.vue) (owner/manager) · API: [server/api/time-entries/](server/api/time-entries/) (`POST /kiosk` รับรหัส PIN ใช้ได้ทุก role ที่ login ไว้, `GET /` ดูประวัติจำกัด owner/manager)
> Seed ข้อมูลตัวอย่าง: `npm run db:seed` สร้างบัญชี `owner`/`manager1`/`staff1` (รหัสผ่านเริ่มต้นทั้งหมด `changeme123`, รหัสเข้างาน `1111`/`2222`/`3333` ตามลำดับ — เปลี่ยนหลัง login ครั้งแรก) พร้อมสาขา/เมนู/สต๊อกตัวอย่าง

## 3. จัดการสาขา (Multi-branch)
- [x] CRUD สาขา (เพิ่ม/แก้ไข/ปิดสาขา — owner เท่านั้น, ปิดสาขาใช้ soft-delete เหมือนสินค้า)
- [x] Switch branch สำหรับ owner (เลือกสาขาใดสาขาหนึ่ง หรือ "ทุกสาขา") — manager/staff ยังคงผูกกับสาขาที่สังกัดตายตัว (`employees.branch_id`), ยังไม่มีการ "เลือกสาขาตอน login" แยกต่างหาก (ใช้ switcher ในหัวเว็บแทน)
- [x] แยกข้อมูล order, stock ตามสาขา (ผ่าน `branch_id` + effective branch จาก session) — report ยังไม่มี (ดูข้อ 8)
- [x] Dashboard เปรียบเทียบยอดขายระหว่างสาขา (สำหรับแอดมิน) — ตาราง "เปรียบเทียบยอดขายระหว่างสาขา" ในหน้ารายงาน (แสดงเมื่อมีมากกว่า 1 สาขาในผลลัพธ์ เฉพาะโหมด "ทุกสาขา" ของ owner)

> หน้าจัดการ: [app/pages/branches/index.vue](app/pages/branches/index.vue) (owner เท่านั้น) · API: [server/api/branches/](server/api/branches/)
> Branch switcher: dropdown ในหัวเว็บ (เฉพาะ owner) · API: `POST /api/auth/branch` (`branchId: number | null`, null = ทุกสาขา) · การขาย/รับสต๊อกต้องเลือกสาขาใดสาขาหนึ่งก่อนเสมอ (โหมดทุกสาขาดูได้อย่างเดียว)

## 4. จัดการเมนู/สินค้า
- [x] CRUD หมวดหมู่สินค้า (บล็อกการลบถ้ายังมีสินค้าอยู่ในหมวดหมู่)
- [x] CRUD สินค้า (ชื่อ, ราคา, รูป, หมวดหมู่, เปิด/ปิดขาย — ปิดขายใช้ soft-delete เพื่อไม่กระทบประวัติออเดอร์ในอนาคต)
- [x] ตั้งค่าตัวเลือกสินค้า (ความหวาน, ท็อปปิ้ง/ไข่มุก, ไซส์, ร้อน/เย็น) พร้อมราคาเพิ่ม — ปุ่ม "ตัวเลือกสินค้า" ในหน้าจัดการเมนู เพิ่ม/ลบกลุ่มตัวเลือกและตัวเลือกย่อยได้ (แต่ละกลุ่มเลือกได้ 1 ค่า/กลุ่ม ไม่ใช่ multi-select); เชื่อมกับหน้า POS แล้ว (เลือกตัวเลือกตอนเพิ่มลงตะกร้า, ราคาคำนวณจาก DB ฝั่ง server เสมอกันการปลอมราคา) และแสดงในใบเสร็จ
- [x] เชื่อมสินค้ากับสูตร/วัตถุดิบที่ใช้ (สำหรับตัดสต๊อกอัตโนมัติ) — ปุ่ม "สูตร/วัตถุดิบ" ในหน้าจัดการเมนู เพิ่ม/ลบ/แก้ปริมาณวัตถุดิบต่อสินค้าได้ (อ้างอิง ingredient กลาง ใช้ได้ทุกสาขา)

> หน้าจัดการ: [app/pages/menu/index.vue](app/pages/menu/index.vue) (จำกัดสิทธิ์ owner/manager) · API: [server/api/categories/](server/api/categories/), [server/api/products/](server/api/products/), [server/api/products/[id]/ingredients/](server/api/products/%5Bid%5D/ingredients/), [server/api/ingredients/](server/api/ingredients/), [server/api/products/[id]/options/](server/api/products/%5Bid%5D/options/) (option groups), [server/api/option-groups/](server/api/option-groups/) (แก้ไข/ลบกลุ่ม + จัดการตัวเลือกย่อย)

## 5. ระบบรับออเดอร์ (Order Taking)
- [x] หน้าจอ POS เลือกสินค้า + จำนวน (สินค้าที่มีตัวเลือกจะเปิด modal ให้เลือกก่อนใส่ตะกร้า — บรรทัดตะกร้าแยกกันตามตัวเลือกที่ต่างกัน)
- [x] ตะกร้าออเดอร์ (เพิ่ม/ลบ/แก้ไขจำนวน)
- [x] รองรับหมายเลขโต๊ะ/ชื่อลูกค้า/เลขคิว (ถ้าต้องการ) — ช่องข้อความอิสระ "โต๊ะ/ชื่อลูกค้า/คิว" ในตะกร้า (คอลัมน์ `orders.note`, ไม่บังคับกรอก) แสดงในใบเสร็จและใบสั่งเตรียมเครื่องดื่ม
- [x] ~~บันทึกออเดอร์เป็นสถานะ "รอชำระ" (open order)~~ — ตัดออกแล้ว ร้านนี้ชำระเงินทันทีหลังสั่งเสมอ ไม่มีแนวคิดออเดอร์ค้างชำระ (ดูข้อ 6)
- [x] ~~แก้ไข/ยกเลิกออเดอร์ก่อนชำระเงิน~~ — ตัดออกแล้ว ด้วยเหตุผลเดียวกัน
- [x] พิมพ์/แสดงใบสั่งสำหรับเตรียมเครื่องดื่ม (kitchen ticket) — optional — หน้า `/pos/orders/:id/ticket` แสดงชื่อสินค้า+ตัวเลือก+จำนวนตัวใหญ่ ไม่มีราคา พร้อมปุ่มพิมพ์ เข้าถึงได้จากปุ่มในหน้าใบเสร็จ

## 6. ระบบคิดเงิน (Checkout/Billing)
- [x] flow เดียว: ตะกร้า → "ชำระเงิน" เปิด modal ทันที → ยืนยัน → สร้างออเดอร์และชำระเงินในคำขอเดียว (atomic transaction ไม่มีออเดอร์ค้างถ้าชำระไม่สำเร็จ) → หน้าใบเสร็จ
- [x] คำนวณยอดรวม, ส่วนลด (ถ้ามี) — กรอกส่วนลดเป็นจำนวนเงิน (บาท) ตอนชำระเงินได้ (ไม่เกินยอดรวม), แสดงแยกยอดรวม/ส่วนลด/ยอดชำระในใบเสร็จ
- [ ] VAT — **ยังไม่ทำ โดยตั้งใจ**: ต้องรู้ก่อนว่าร้านจดทะเบียน VAT หรือไม่ และราคาที่ตั้งไว้ตอนนี้รวม VAT แล้วหรือยัง (จะกระทบทั้งการคำนวณและใบเสร็จที่ถูกต้องตามกฎหมาย) — ใส่ผิดจะเป็นปัญหาบัญชี/ภาษีจริง ต้องถามเจ้าของร้านก่อนทำ
- [x] เลือกช่องทางชำระเงิน (เงินสด/โอน/QR พร้อมเพย์)
- [x] คำนวณเงินทอน (กรณีเงินสด)
- [x] พิมพ์/แสดงใบเสร็จ (receipt) — ปุ่ม "พิมพ์ใบเสร็จ" (`window.print()`) + CSS สำหรับพิมพ์ (ซ่อนเมนู/ปุ่มที่ไม่เกี่ยวข้อง, ตั้ง page margin)
- [x] ปิดออเดอร์ → ตัดสต๊อกอัตโนมัติตาม recipe — ตัดในธุรกรรมเดียวกับ checkout แบบ best-effort: ถ้าสาขานั้นไม่มีวัตถุดิบชิ้นนั้นในสต๊อก จะข้ามการตัด (ไม่บล็อกการขาย เพราะร้านนี้ต้องชำระเงินสำเร็จเสมอ)

> POS (ตะกร้า+ชำระเงินทันที): [app/pages/pos/index.vue](app/pages/pos/index.vue) · หน้าใบเสร็จ: [app/pages/pos/orders/[id].vue](app/pages/pos/orders/%5Bid%5D.vue) · API: [server/api/orders/](server/api/orders/) (`POST /checkout` = สร้าง+จ่ายในคำขอเดียว — endpoint เดียวที่สร้างออเดอร์ได้)

## 7. จัดการสต๊อก (Inventory)
- [x] CRUD วัตถุดิบ/สต๊อกต่อสาขา (เพิ่ม/แก้ไข/ลบ — จำกัดสิทธิ์ owner/manager, ลบไม่ได้ถ้ามีประวัติรายการ) — ชื่อ/หน่วยนับมาจาก ingredient กลาง (ดูข้อ 1), แก้ไขได้แค่สต๊อกขั้นต่ำต่อสาขา
- [x] รับสินค้าเข้าสต๊อก (stock in) พร้อมบันทึกผู้ทำรายการ (เพิ่มคอลัมน์ `employee_id` ใน `stock_transactions`)
- [x] ตัดสต๊อกอัตโนมัติเมื่อขายสินค้า (ตาม recipe mapping) — ดูข้อ 6
- [x] ปรับสต๊อกด้วยมือ (stock adjustment) พร้อมเหตุผล (ต้องระบุเหตุผลสำหรับ เบิกออก/ปรับยอด)
- [x] แจ้งเตือนสต๊อกใกล้หมด (min threshold) — badge "สต๊อกใกล้หมด" ในหน้าจัดการสต๊อก
- [x] ประวัติการเคลื่อนไหวสต๊อก (stock transaction log) — ปุ่มไอคอนนาฬิกาในหน้าจัดการสต๊อก เปิด modal แสดงประวัติ (ประเภท, จำนวน +/-, ผู้ทำรายการ, เหตุผล, ลิงก์ออเดอร์ถ้าตัดจากการขาย) เรียงล่าสุดก่อน

> หน้าจัดการ: [app/pages/stock/index.vue](app/pages/stock/index.vue) (ทุกคนทำรายการเข้า/ออกได้ แก้ไข/ลบวัตถุดิบจำกัด owner/manager) · API: [server/api/stock-items/](server/api/stock-items/), [server/api/ingredients/](server/api/ingredients/)
> เพิ่มวัตถุดิบใหม่จากหน้าสต๊อกได้โดยพิมพ์ชื่อ+หน่วยตรงๆ (ระบบจะ reuse ingredient เดิมถ้าชื่อซ้ำและหน่วยตรงกัน หรือสร้างใหม่ถ้ายังไม่มี)

## 8. รายงาน/Dashboard
- [x] ยอดขายรายวัน/รายเดือน ต่อสาขา — เลือกช่วงวันที่ (พรีเซ็ต/กำหนดเอง) + สลับกลุ่มรายวัน/รายเดือน สโคปตามสาขาที่เลือก (หรือทุกสาขา)
- [x] สินค้าขายดี — จัดอันดับตามจำนวนที่ขายได้ (top 10)
- [x] สรุปยอดตามช่องทางชำระเงิน
- [x] มูลค่าสต๊อกคงเหลือ / รายการใกล้หมด — เพิ่ม `ingredients.cost_per_unit` (แก้ไขได้จากหน้าจัดการสต๊อก/เมนู) การ์ด "มูลค่าสต๊อกคงเหลือ" ในหน้ารายงาน = Σ (quantity × cost_per_unit) ต่อสาขา (วัตถุดิบที่ยังไม่ตั้งต้นทุนจะไม่ถูกนับ มีข้อความเตือนจำนวนรายการที่ยังไม่ระบุ)
- [x] สรุปยอดขายตามพนักงาน (optional)

> หน้ารายงาน: [app/pages/reports/index.vue](app/pages/reports/index.vue) (จำกัดสิทธิ์ owner/manager) · API: [server/api/reports/summary.get.ts](server/api/reports/summary.get.ts) (`GET ?from&to&groupBy=day|month`)

## 9. Non-functional / Deployment
- [x] Responsive UI สำหรับ tablet (หน้าจอขายหน้าร้าน) — หน้า POS ใช้ layout แบบสินค้า+ตะกร้าคู่กันตั้งแต่จอ ≥768px (md) แทนที่จะรอจอเดสก์ท็อป (เดิม ≥1024px), ปรับจำนวนคอลัมน์ตารางสินค้า/การ์ดสรุปในหน้ารายงานให้ไล่ระดับตามความกว้างจอถี่ขึ้น — **หมายเหตุ: ตรวจสอบด้วยการอ่านโค้ด/breakpoint เท่านั้น ไม่มีเครื่องมือ screenshot บนแท็บเล็ตจริงในสภาพแวดล้อมนี้ ควรลองเปิดจริงบนแท็บเล็ตก่อนใช้งานหน้าร้าน**
- [x] Backup ฐานข้อมูล SQLite (scheduled backup) — `npm run db:backup` ใช้ better-sqlite3 online backup API คัดลอกไป `data/backups/` (เก็บ 14 ไฟล์ล่าสุด) ปลอดภัยรันตอนแอปทำงานอยู่; วิธีตั้งให้รันอัตโนมัติทุกวันดูใน [DEPLOYMENT.md](DEPLOYMENT.md)
- [x] Error handling + validation (server-side) — ตรวจสอบทุก endpoint ใน `server/api/**` เพิ่มการตรวจสิทธิ์ตามสาขา (branch-scope) ที่ขาดใน stock-items PATCH/DELETE, เพิ่ม validation ที่ขาดสำหรับ ingredientId/minThreshold/categoryId/sortOrder, ลดข้อมูลที่ health check เปิดเผยแบบไม่ล็อกอิน
- [x] Seed data สำหรับทดสอบ (เมนู, สาขา, พนักงานตัวอย่าง) — `npm run db:seed` เพิ่มสาขาที่ 2, บัญชี manager/staff ตัวอย่าง, สินค้า/หมวดหมู่/วัตถุดิบ (พร้อมต้นทุน)/สูตร/ตัวเลือกสินค้าตัวอย่าง — รันซ้ำได้ปลอดภัย (idempotent ตรวจจาก name/username เดิม)
- [x] Deploy plan (เช่น host บน VPS/NAS, หรือ local server ที่ร้าน) — ดู [DEPLOYMENT.md](DEPLOYMENT.md): แนะนำ local server ที่ร้านเป็นหลัก (ไม่พึ่งเน็ต/ไม่มีค่าใช้จ่ายรายเดือน) พร้อมทางเลือก VPS/NAS

## Suggested build order (MVP first)
1. Setup + schema + auth (พนักงาน login)
2. จัดการเมนู/สินค้า (ยังไม่ต้องมี option ซับซ้อน)
3. รับออเดอร์ + คิดเงิน (flow หลักของร้าน)
4. จัดการสต๊อกแบบพื้นฐาน (manual in/out)
5. Multi-branch support
6. ตัดสต๊อกอัตโนมัติจาก recipe + รายงาน
7. ตัวเลือกสินค้าขั้นสูง (หวาน/ไข่มุก/ไซส์) + ระบบพนักงานแบบละเอียด (role, clock-in)
