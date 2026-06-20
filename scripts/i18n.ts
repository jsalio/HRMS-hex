#!/usr/bin/env bun
/**
 * i18n management tool for hrms-ui.
 *
 * Commands:
 *   bun scripts/i18n.ts check              — missing keys across all locales
 *   bun scripts/i18n.ts get <key>          — show value of key in all locales
 *   bun scripts/i18n.ts set <key> <es> <en> <pt>  — add / update key in all locales
 *   bun scripts/i18n.ts keys [prefix]      — list all keys (optional filter prefix)
 *   bun scripts/i18n.ts scan <file.ts>     — extract | translate keys from component and check them
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ── Config ────────────────────────────────────────────────────────────────────

const LOCALES = ['es', 'en', 'pt'] as const
const I18N_DIR = resolve(import.meta.dir, '../apps/hrms-ui/src/assets/i18n')

type Locale = typeof LOCALES[number]
type Dict   = Record<string, unknown>

// ── Helpers ───────────────────────────────────────────────────────────────────

function load(locale: Locale): Dict {
  return JSON.parse(readFileSync(`${I18N_DIR}/${locale}.json`, 'utf8')) as Dict
}

function save(locale: Locale, data: Dict): void {
  writeFileSync(`${I18N_DIR}/${locale}.json`, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

/** Flatten nested object to dot-notation keys. */
function flatten(obj: Dict, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flatten(v as Dict, key))
    } else {
      result[key] = String(v ?? '')
    }
  }
  return result
}

/** Get value at dot-notation path. Returns undefined when absent. */
function getKey(obj: Dict, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Dict)[p]
  }
  return cur === undefined ? undefined : String(cur)
}

/** Set value at dot-notation path, creating intermediate objects as needed. */
function setKey(obj: Dict, path: string, value: string): void {
  const parts = path.split('.')
  let cur: Dict = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (cur[p] === undefined || typeof cur[p] !== 'object') {
      cur[p] = {}
    }
    cur = cur[p] as Dict
  }
  cur[parts[parts.length - 1]] = value
}

// ── ANSI colors ───────────────────────────────────────────────────────────────

const R = '\x1b[31m'   // red
const G = '\x1b[32m'   // green
const Y = '\x1b[33m'   // yellow
const B = '\x1b[34m'   // blue
const D = '\x1b[2m'    // dim
const Z = '\x1b[0m'    // reset

// ── Commands ──────────────────────────────────────────────────────────────────

/** check — find keys present in one locale but missing in others. */
function cmdCheck(): void {
  const files = Object.fromEntries(LOCALES.map(l => [l, flatten(load(l))])) as Record<Locale, Record<string, string>>
  const allKeys = new Set<string>()
  for (const f of Object.values(files)) Object.keys(f).forEach(k => allKeys.add(k))

  const missing: Record<string, Locale[]> = {}
  for (const key of allKeys) {
    const absent = LOCALES.filter(l => !(key in files[l]))
    if (absent.length) missing[key] = absent
  }

  const total = allKeys.size
  const missingCount = Object.keys(missing).length

  if (missingCount === 0) {
    console.log(`${G}✓ All ${total} keys are present in all locales.${Z}`)
    return
  }

  console.log(`${Y}⚠ ${missingCount} key(s) missing across locales (${total} total):${Z}\n`)
  for (const [key, locales] of Object.entries(missing).sort()) {
    console.log(`  ${R}✗${Z} ${key}`)
    console.log(`    ${D}missing in: ${locales.join(', ')}${Z}`)
  }
}

/** get — show value of a dot-notation key in all locales. */
function cmdGet(key: string): void {
  if (!key) { console.error(`${R}error: key required${Z}`); process.exit(1) }
  let found = false
  for (const locale of LOCALES) {
    const val = getKey(load(locale), key)
    if (val !== undefined) {
      console.log(`  ${B}${locale}${Z}  ${val}`)
      found = true
    } else {
      console.log(`  ${R}${locale}${Z}  ${D}(missing)${Z}`)
    }
  }
  if (!found) console.log(`\n${Y}Key not found in any locale: ${key}${Z}`)
}

/** set — add or update a key in all locales. */
function cmdSet(key: string, values: Partial<Record<Locale, string>>): void {
  if (!key) { console.error(`${R}error: key required${Z}`); process.exit(1) }

  for (const locale of LOCALES) {
    const val = values[locale]
    if (!val) {
      console.log(`  ${Y}skip${Z}  ${locale}  ${D}(no value provided)${Z}`)
      continue
    }
    const data = load(locale)
    const existing = getKey(data, key)
    setKey(data, key, val)
    save(locale, data)
    const action = existing !== undefined ? `${Y}updated${Z}` : `${G}added${Z}`
    console.log(`  ${action}  ${locale}  "${val}"`)
  }
  console.log(`\n${G}✓ ${key}${Z}`)
}

/** keys — list all flattened keys, optionally filtered by prefix. */
function cmdKeys(prefix?: string): void {
  const base = flatten(load('es'))
  const keys = Object.keys(base).filter(k => !prefix || k.startsWith(prefix)).sort()
  if (!keys.length) {
    console.log(`${Y}No keys found${prefix ? ` with prefix "${prefix}"` : ''}.${Z}`)
    return
  }
  for (const k of keys) console.log(`  ${D}·${Z} ${k}`)
  console.log(`\n${D}${keys.length} key(s)${prefix ? ` matching "${prefix}"` : ''}${Z}`)
}

/** scan — extract | translate keys AND .set('key') signals from a .ts file and check them. */
function cmdScan(filePath: string): void {
  if (!filePath) { console.error(`${R}error: file path required${Z}`); process.exit(1) }
  const src = readFileSync(resolve(filePath), 'utf8')

  const found = new Map<string, string>()  // key → source

  // Pattern 1 — template pipe:  'key' | translate  or  "key" | translate
  const rePipe = /['"]([a-z][a-z0-9_.]+(?:\.[a-z0-9_]+)+)['"]\s*\|\s*translate/g
  let m: RegExpExecArray | null
  while ((m = rePipe.exec(src)) !== null) found.set(m[1], 'pipe')

  // Pattern 2 — signal / variable assignment:  .set('key')  this.x = 'key'  signal('key')
  // Heuristic: quoted string that looks like a dot-path i18n key (≥2 segments, all lowercase/digits/underscore)
  const reSet = /(?:\.set|=\s*signal)\(\s*['"]([a-z][a-z0-9_]+(?:\.[a-z0-9_]+){1,})['"]\s*\)/g
  while ((m = reSet.exec(src)) !== null) {
    if (!found.has(m[1])) found.set(m[1], 'signal.set')
  }

  if (!found.size) {
    console.log(`${D}No i18n keys found in ${filePath}${Z}`)
    return
  }

  const files = Object.fromEntries(LOCALES.map(l => [l, flatten(load(l))])) as Record<Locale, Record<string, string>>
  let ok = 0
  let missing = 0

  console.log(`\n${B}Keys found in ${filePath}:${Z}\n`)
  for (const [key, src] of [...found.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const absent = LOCALES.filter(l => !(key in files[l]))
    const tag = src === 'signal.set' ? ` ${D}[signal]${Z}` : ''
    if (absent.length) {
      console.log(`  ${R}✗${Z} ${key}${tag}  ${D}missing in: ${absent.join(', ')}${Z}`)
      missing++
    } else {
      console.log(`  ${G}✓${Z} ${key}${tag}`)
      ok++
    }
  }
  console.log(`\n${D}${ok} ok · ${missing > 0 ? R : G}${missing} missing${Z}`)
}

// ── Router ────────────────────────────────────────────────────────────────────

const [,, cmd, ...rest] = process.argv

switch (cmd) {
  case 'check':
    cmdCheck()
    break

  case 'get':
    cmdGet(rest[0])
    break

  case 'set': {
    // bun scripts/i18n.ts set <key> <es> <en> <pt>
    const [key, es, en, pt] = rest
    if (!key || !es || !en || !pt) {
      console.error(`${R}usage: i18n set <key> <es-value> <en-value> <pt-value>${Z}`)
      process.exit(1)
    }
    cmdSet(key, { es, en, pt })
    break
  }

  case 'keys':
    cmdKeys(rest[0])
    break

  case 'scan':
    cmdScan(rest[0])
    break

  default:
    console.log(`
${B}i18n — hrms-ui translation manager${Z}

  ${G}check${Z}                         detect missing keys across all locales
  ${G}get${Z} <key>                     show value in es / en / pt
  ${G}set${Z} <key> <es> <en> <pt>      add or update key in all locales
  ${G}keys${Z} [prefix]                 list all keys (optional prefix filter)
  ${G}scan${Z} <component.ts>           extract | translate keys and check them

Examples:
  bun scripts/i18n.ts check
  bun scripts/i18n.ts get recruitment.posting_form.title
  bun scripts/i18n.ts set recruitment.posting_form.title "Nueva vacante" "New posting" "Nova vaga"
  bun scripts/i18n.ts keys recruitment
  bun scripts/i18n.ts scan apps/hrms-ui/src/app/recruitment/job-posting-form-page.component.ts
`)
}
