import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import * as schema from './schema'

type Db = ReturnType<typeof drizzleNeon<typeof schema>>

function isNeonUrl(url: string): boolean {
  return url.includes('neon.tech')
}

function getDb(): Db {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Check your .env.local file.')
  }

  if (isNeonUrl(url)) {
    const sql = neon(url)
    return drizzleNeon(sql, { schema })
  }

  // Local Postgres (OrbStack / Docker)
  const pool = new pg.Pool({ connectionString: url })
  return drizzleNode(pool, { schema }) as unknown as Db
}

// Lazy singleton — only connects when first accessed at runtime
let _db: Db | undefined

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    if (!_db) {
      _db = getDb()
    }
    return Reflect.get(_db, prop)
  },
})
