import fs from 'node:fs'
import path from 'node:path'

// Uploaded images are always <uuid>.webp (see server/api/uploads/image.post.ts) —
// this pattern also rules out path traversal via the filename param.
const FILENAME_RE = /^[0-9a-f-]+\.webp$/i

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')
  if (!filename || !FILENAME_RE.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid filename' })
  }

  const filePath = path.join(uploadsDir, filename)
  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }

  setHeader(event, 'Content-Type', 'image/webp')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return sendStream(event, fs.createReadStream(filePath))
})
