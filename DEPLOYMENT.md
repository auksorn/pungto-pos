# Deploy Plan — บังโต POS

> **สถานะปัจจุบัน:** ฐานข้อมูลเป็น **Neon Postgres (cloud)** และรูปภาพสินค้า/วัตถุดิบเก็บบน
> **Vercel Blob (cloud)** แล้วทั้งคู่ — แอปไม่มี state ที่ผูกกับดิสก์ของเครื่องรันเลย จึง deploy บน
> Vercel (serverless) ได้ตรง ๆ

## Deploy บน Vercel

### 1. เตรียม Neon Postgres
- สร้างโปรเจกต์ที่ [Neon Console](https://console.neon.tech) (ฟรีสำหรับใช้งานเริ่มต้น)
- คัดลอก connection string 2 แบบจากหน้า Dashboard:
  - **Pooled** (มี `-pooler` ในชื่อ host) → ใช้เป็น `DATABASE_URL`
  - **Direct/Unpooled** → ใช้เป็น `DATABASE_URL_UNPOOLED` (สำหรับรัน migration เท่านั้น)

### 2. เตรียม Vercel Blob
- ในหน้า Vercel project → **Storage** tab → สร้าง Blob store
- คัดลอก token มาใส่ `BLOB_READ_WRITE_TOKEN`

### 3. รัน migration ครั้งแรก (จากเครื่อง local)
```bash
cp .env.example .env
# ใส่ DATABASE_URL, DATABASE_URL_UNPOOLED, BLOB_READ_WRITE_TOKEN, NUXT_SESSION_PASSWORD ใน .env
npm install
npm run db:migrate
npm run db:seed      # สร้างบัญชี owner แรก (username: owner / password: changeme123)
```
Migration รันตรงกับ Neon จากเครื่อง local ก่อน deploy — ไม่ต้องรันเป็นส่วนหนึ่งของ Vercel build

### 4. Deploy
- Import repo นี้เข้า Vercel (New Project → เลือก repo จาก GitHub) — Vercel จะ detect Nuxt
  framework preset ให้อัตโนมัติ ไม่ต้องตั้ง build command เอง
- ตั้ง Environment Variables ในหน้า Project Settings → Environment Variables:
  - `DATABASE_URL` (pooled connection string)
  - `BLOB_READ_WRITE_TOKEN`
  - `NUXT_SESSION_PASSWORD` (32+ ตัวอักษรสุ่ม — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  - ไม่ต้องตั้ง `DATABASE_URL_UNPOOLED` บน Vercel (ใช้แค่ตอนรัน migrate จาก local/CI)
- กด Deploy

### อัปเดตเวอร์ชันใหม่
```bash
npm run db:migrate   # รันจาก local ก่อน push ทุกครั้งที่ schema เปลี่ยน
git push             # Vercel deploy อัตโนมัติจาก push ไปสาขาที่ตั้งไว้ (ปกติคือ main/master)
```

### ข้อควรระวัง
- ร้านต้องมีเน็ตใช้งานได้ตลอดเวลาเปิดร้าน (ทั้ง Neon และ Vercel เป็น cloud) — ถ้าเน็ตร้านหลุด
  ระบบขายหน้าร้านจะใช้งานไม่ได้ทันที ร้านขายเครื่องดื่มที่กังวลเรื่องนี้ควรมีเน็ตสำรอง (4G/5G hotspot)
- Neon มี point-in-time recovery และ database branching ในตัว (ดูที่ Neon Console)
- Vercel Blob เก็บไฟล์แยกจาก deployment — ไม่หายตอน redeploy

## ทางเลือกอื่น: Local server ที่ร้าน

ถ้าไม่อยากพึ่งอินเทอร์เน็ตต่อเนื่อง (ร้านสาขาเดียว เน็ตไม่เสถียร) ยังรันบนเครื่อง local ที่ร้านได้
เหมือนเดิม โดยฐานข้อมูลยังต้องต่อ Neon ผ่านเน็ต (ไม่มี local DB fallback แล้ว) — เหมาะกับกรณีที่มีเน็ต
เสถียรพอสมควรแต่อยากลดค่าใช้จ่าย hosting เท่านั้น:

```bash
git clone <repo> pung-to-pos
cd pung-to-pos
npm install
cp .env.example .env
# ตั้งค่าเหมือนขั้นตอน Vercel ด้านบน (DATABASE_URL, BLOB_READ_WRITE_TOKEN, NUXT_SESSION_PASSWORD)
npm run db:migrate
npm run db:seed
npm run build
node .output/server/index.mjs
```
ค่าเริ่มต้นจะรันที่ port 3000 — ตั้ง `PORT=80` (หรือพอร์ตอื่น) ใน `.env` ถ้าต้องการให้เข้าถึงง่ายกว่านี้
เครื่องอื่นในร้าน (แท็บเล็ต, มือถือ) เข้าใช้งานผ่าน `http://<ip เครื่อง server>:<port>` ในเบราว์เซอร์

**เปลี่ยนรหัสผ่าน owner ทันทีหลัง login ครั้งแรก** (`changeme123` เป็นค่า default จาก seed script)

### รันตลอดเวลา (survive reboot/crash)
- **Windows**: ใช้ [NSSM](https://nssm.cc/) ผูก `node .output/server/index.mjs` เป็น Windows Service
  หรือสร้าง Scheduled Task ที่ trigger ตอนเครื่องเปิด (`At startup`, run as SYSTEM หรือ user ที่ auto-login)
- **Linux**: สร้าง systemd unit (`/etc/systemd/system/pos.service`) ที่ `ExecStart=/usr/bin/node
  /path/to/.output/server/index.mjs`, `Restart=always`, แล้ว `systemctl enable --now pos`

## NAS

ถ้าร้านมี NAS ที่รัน Docker หรือ Node ได้อยู่แล้ว (Synology/QNAP) ก็ใช้แนวทางเดียวกับ local server —
ข้อดีคือ NAS มักมี backup/RAID ในตัวอยู่แล้ว ลดความเสี่ยงข้อมูลหายเมื่อเทียบกับ PC เครื่องเดียว
