#!/usr/bin/env node
/**
 * Database migration runner for MinbarAI
 *
 * Two connection modes (tried in order):
 *
 *   1. Direct Postgres (recommended for production CI/CD)
 *      Set DATABASE_URL in .env.local:
 *      postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
 *
 *   2. Supabase Management API (convenient for local dev — no DB password needed)
 *      Set SUPABASE_ACCESS_TOKEN in .env.local:
 *      Generate at: https://supabase.com/dashboard/account/tokens
 *      (The project ref is derived automatically from NEXT_PUBLIC_SUPABASE_URL)
 *
 * Usage:
 *   npm run migrate              — apply all pending migrations
 *   npm run migrate:dry-run      — preview without applying
 */

'use strict'

require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })   // fallback to .env if .env.local is absent

const fs   = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')
const DRY_RUN        = process.argv.includes('--dry-run')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // https://hjsifxofnqbnrgqkbomx.supabase.co  →  hjsifxofnqbnrgqkbomx
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return m ? m[1] : null
}

function readMigrationFiles() {
  try {
    return fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  } catch {
    console.error(`❌  Migrations directory not found: ${MIGRATIONS_DIR}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Mode 1: Direct Postgres via pg
// ---------------------------------------------------------------------------

async function runWithPg(files) {
  const { Client } = require('pg')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  console.log('✅  Connected via direct Postgres\n')

  try {
    // Ensure tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        id         SERIAL       PRIMARY KEY,
        filename   TEXT         UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `)

    const { rows } = await client.query('SELECT filename FROM public._migrations')
    const applied  = new Set(rows.map((r) => r.filename))
    const pending  = files.filter((f) => !applied.has(f))

    await applyPending(pending, async (sql, filename) => {
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO public._migrations (filename) VALUES ($1)', [filename])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    })
  } finally {
    await client.end()
  }
}

// ---------------------------------------------------------------------------
// Mode 2: Supabase Management API
// ---------------------------------------------------------------------------

async function runWithManagementApi(files) {
  const ref   = getProjectRef()
  const token = process.env.SUPABASE_ACCESS_TOKEN

  if (!ref || !token) {
    console.error('❌  Could not determine Supabase project ref or access token.')
    console.error('   Set SUPABASE_ACCESS_TOKEN in .env.local')
    console.error('   Generate at: https://supabase.com/dashboard/account/tokens')
    process.exit(1)
  }

  const base = `https://api.supabase.com/v1/projects/${ref}/database/query`
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  async function execSql(sql) {
    const res = await fetch(base, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ query: sql }),
    })
    const body = await res.json()
    if (!res.ok) {
      throw new Error(body.message || body.error || JSON.stringify(body))
    }
    return body
  }

  console.log(`✅  Using Supabase Management API (project: ${ref})\n`)

  // Ensure tracking table
  await execSql(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      id         SERIAL       PRIMARY KEY,
      filename   TEXT         UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `)

  const rows    = await execSql('SELECT filename FROM public._migrations')
  const applied = new Set((rows || []).map((r) => r.filename))
  const pending = files.filter((f) => !applied.has(f))

  await applyPending(pending, async (sql, filename) => {
    // Management API does not support multi-statement transactions,
    // so we run the migration then record it in two calls.
    await execSql(sql)
    await execSql(`INSERT INTO public._migrations (filename) VALUES ('${filename.replace(/'/g, "''")}')`)
  })
}

// ---------------------------------------------------------------------------
// Shared: apply pending migrations
// ---------------------------------------------------------------------------

async function applyPending(pending, executor) {
  if (pending.length === 0) {
    console.log('✅  All migrations already applied — nothing to do')
    return
  }

  console.log(`📋  ${pending.length} pending migration(s):`)
  for (const f of pending) console.log(`    → ${f}`)

  if (DRY_RUN) {
    console.log('\n🔍  Dry run — no changes made')
    return
  }

  console.log('')
  for (const filename of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8')
    process.stdout.write(`⏳  Applying ${filename} ... `)
    try {
      await executor(sql, filename)
      console.log('✅')
    } catch (err) {
      console.log('❌')
      console.error(`\n    Error: ${err.message}`)
      console.error('    Fix the migration and re-run.\n')
      process.exit(1)
    }
  }

  console.log(`\n🎉  ${pending.length} migration(s) applied successfully`)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run() {
  const files = readMigrationFiles()

  if (files.length === 0) {
    console.log('📭  No migration files found in supabase/migrations/')
    return
  }

  if (process.env.DATABASE_URL) {
    await runWithPg(files)
  } else if (process.env.SUPABASE_ACCESS_TOKEN) {
    await runWithManagementApi(files)
  } else {
    console.error('❌  No database connection configured.')
    console.error('')
    console.error('   Option A — Direct Postgres (add to .env.local):')
    console.error('   DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres')
    console.error('')
    console.error('   Option B — Supabase Management API (add to .env.local):')
    console.error('   SUPABASE_ACCESS_TOKEN=sbp_...')
    console.error('   Generate at: https://supabase.com/dashboard/account/tokens')
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
