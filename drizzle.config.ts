import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Direct (non-pooled) endpoint — safer for DDL than going through pgbouncer.
    url: process.env.DATABASE_URL_UNPOOLED!
  }
})
