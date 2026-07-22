import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

// Raw upload size cap, checked before we even try to decode it — compression
// happens after this gate, not instead of it, so an oversized file can't be
// used to force a large decode.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_DIMENSION = 1000

export default defineEventHandler(async (event) => {
  await requireRole(event, ['owner', 'manager'])

  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.data?.length)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'กรุณาเลือกไฟล์รูปภาพ' })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'ไฟล์รูปภาพใหญ่เกินไป (สูงสุด 10MB)' })
  }

  let compressed: Buffer
  try {
    compressed = await sharp(file.data)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'ไฟล์ที่อัปโหลดไม่ใช่รูปภาพที่รองรับ' })
  }

  fs.mkdirSync(uploadsDir, { recursive: true })
  const filename = `${randomUUID()}.webp`
  fs.writeFileSync(path.join(uploadsDir, filename), compressed)

  return { url: `/uploads/${filename}` }
})
