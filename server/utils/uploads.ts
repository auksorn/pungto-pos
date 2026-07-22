import path from 'node:path'

// Runtime-writable directory, alongside the SQLite file and its backups —
// kept outside the build output (unlike public/) so uploads written after
// `nuxt build` still resolve correctly in production. See server/db/backup.ts
// for the same DATABASE_URL-relative convention.
const dbPath = process.env.DATABASE_URL ?? './data/pos.db'
export const uploadsDir = path.join(path.dirname(dbPath), 'uploads')
