import { sql } from './client'
import { readFileSync } from 'fs'
import { join } from 'path'

const migrationPath = join(import.meta.dir, 'migrations', '001_auth_roles.sql')
const migrationSql = readFileSync(migrationPath, 'utf-8')

console.log('Running migration 001_auth_roles...')
await sql.unsafe(migrationSql)
console.log('Migration complete.')
await sql.end()
