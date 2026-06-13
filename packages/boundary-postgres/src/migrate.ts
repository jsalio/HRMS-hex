import { sql } from './client'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const migrationsDir = join(import.meta.dir, 'migrations')

const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  const migrationSql = readFileSync(join(migrationsDir, file), 'utf-8')
  console.log(`Running migration ${file}...`)
  await sql.unsafe(migrationSql)
  console.log(`✓ ${file}`)
}

console.log('All migrations complete.')
await sql.end()
