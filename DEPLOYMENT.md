# Deploy Plan — บังโต POS

ร้านนี้มีสาขาเดียวถึงไม่กี่สาขา และต้องใช้งานได้ต่อเนื่องแม้เน็ตร้านมีปัญหา ทางเลือกที่เหมาะสมที่สุดคือ
**รันบนเครื่อง local ที่ร้าน** (PC/mini-PC ราคาไม่แพง หรือ NAS ที่รัน Node ได้) แทนการพึ่ง VPS/cloud
ต่างประเทศ — ไม่มีค่าใช้จ่ายรายเดือน ไม่มี latency เวลาใช้งานจริง และขายของได้ต่อแม้เน็ตหลุด (เฉพาะ
Wi-Fi ในร้านยังใช้ได้ระหว่างเครื่อง POS กับเครื่อง server)

> ถ้าในอนาคตมีหลายสาขาที่ต้องดูข้อมูลรวมศูนย์แบบเรียลไทม์ข้ามสาขา ค่อยพิจารณาย้ายไป VPS/cloud
> (ดูหัวข้อ "ทางเลือก: VPS/Cloud" ด้านล่าง) — ไม่ใช่ความจำเป็นตอนนี้

## แนวทางหลัก: Local server ที่ร้าน

### สิ่งที่ต้องมี
- เครื่อง PC/mini-PC 1 เครื่องเปิดทิ้งไว้ตลอดเวลาเปิดร้าน (Windows/Linux ก็ได้) ต่อ Wi-Fi/LAN เดียวกับ
  แท็บเล็ต/เครื่องคิดเงินที่ใช้หน้าจอ POS
- Node.js 20+ ติดตั้งบนเครื่องนั้น
- (ถ้าต้องการให้รันตลอดแม้เครื่อง restart) ตัว process manager — Windows ใช้ NSSM หรือ Task
  Scheduler; Linux ใช้ `systemd` หรือ `pm2`

### ขั้นตอน
```bash
git clone <repo> pung-to-pos
cd pung-to-pos
npm install
cp .env.example .env
# แก้ .env: ตั้ง NUXT_SESSION_PASSWORD ด้วยค่าสุ่ม (คำสั่งอยู่ใน .env.example)
npm run db:migrate
npm run db:seed      # สร้างบัญชี owner แรก (username: owner / password: changeme123)
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

### Backup
- `npm run db:backup` คัดลอกไฟล์ `data/pos.db` แบบ online-safe ไปที่ `data/backups/pos-<timestamp>.db`
  (เก็บ 14 ไฟล์ล่าสุด ลบของเก่าอัตโนมัติ)
- ตั้งให้รันอัตโนมัติทุกวัน:
  - **Windows**: Task Scheduler → สร้าง task รันคำสั่ง `npm run db:backup` (working directory =
    โฟลเดอร์โปรเจกต์) ทุกวันตอนดึก
  - **Linux**: cron — `0 3 * * * cd /path/to/pung-to-pos && npm run db:backup`
- ควรมีสำเนาไฟล์ backup อยู่นอกเครื่อง server ด้วย (เช่น sync โฟลเดอร์ `data/backups/` ขึ้น Google
  Drive/Dropbox ผ่านแอปที่ติดตั้งไว้บนเครื่องนั้น) กันกรณีเครื่อง/ฮาร์ดดิสก์เสีย — ไม่มีในสโคปโค้ด
  ตอนนี้ เพราะขึ้นกับบริการที่ร้านเลือกใช้เอง

### อัปเดตเวอร์ชันใหม่
```bash
git pull
npm install
npm run db:migrate   # รันทุกครั้งที่มี schema เปลี่ยน แม้ไม่มี migration ใหม่ก็ไม่มีผล
npm run build
# restart service/process
```
แนะนำให้ `npm run db:backup` ก่อน migrate ทุกครั้ง เผื่อ migration มีปัญหา

## ทางเลือก: VPS/Cloud

ถ้าต้องการเข้าถึงจากนอกร้าน (เช่น เจ้าของดูยอดขายจากบ้าน) หรือมีหลายสาขาที่อยากรวมศูนย์ข้อมูล:
- Deploy เหมือนขั้นตอน local ข้างบนบน VPS เล็ก ๆ (เช่น 1 vCPU / 1GB RAM ก็เพียงพอ เพราะ SQLite +
  Nuxt เบามาก)
- ต้องมี reverse proxy (nginx/Caddy) + TLS (Let's Encrypt) ถ้าจะเปิดออกอินเทอร์เน็ตจริง — ห้ามเปิด
  พอร์ต 3000 ตรงออก public โดยไม่มี HTTPS เพราะรหัสผ่าน login จะวิ่งแบบ plaintext
  ได้
- SQLite ไฟล์เดียวบน VPS ยังใช้ได้กับสเกลระดับร้านเดียว/ไม่กี่สาขา แต่ถ้าจะให้หลายสาขาเขียนพร้อมกัน
  หนักๆ ควรพิจารณา Postgres แทนในอนาคต (ต้องแก้ `server/db/index.ts` + `drizzle.config.ts` — ไม่ได้
  ทำไว้ตอนนี้)
- ข้อเสีย: ถ้าเน็ตร้านหลุด ระบบขายหน้าร้านจะใช้งานไม่ได้ทันที (ต่างจาก local server) — ร้านขาย
  เครื่องดื่มแบบนี้ควรเลี่ยงจุดอ่อนนี้ถ้าเป็นไปได้

## NAS

ถ้าร้านมี NAS ที่รัน Docker หรือ Node ได้อยู่แล้ว (Synology/QNAP) ก็ใช้แนวทางเดียวกับ local server —
ข้อดีคือ NAS มักมี backup/RAID ในตัวอยู่แล้ว ลดความเสี่ยงข้อมูลหายเมื่อเทียบกับ PC เครื่องเดียว
