import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

// Copies the live SQLite file to data/backups/ using better-sqlite3's online
// backup API (safe to run while the app is serving traffic — it doesn't lock
// out concurrent readers/writers the way a plain file copy of a WAL-mode DB
// could). Intended to be run on a schedule (cron / Windows Task Scheduler) —
// see DEPLOYMENT.md.
const KEEP_LAST = 14

async function backup() {
  const dbPath = process.env.DATABASE_URL ?? './data/pos.db'
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`)
  }

  const backupDir = path.join(path.dirname(dbPath), 'backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destPath = path.join(backupDir, `pos-${stamp}.db`)

  const source = new Database(dbPath, { readonly: true })
  await source.backup(destPath)
  source.close()
  console.log(`Backed up ${dbPath} -> ${destPath}`)

  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('pos-') && f.endsWith('.db'))
    .sort()
  const stale = files.slice(0, Math.max(0, files.length - KEEP_LAST))
  for (const file of stale) {
    fs.unlinkSync(path.join(backupDir, file))
    console.log(`Removed old backup: ${file}`)
  }
}

backup().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
