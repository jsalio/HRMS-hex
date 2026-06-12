import type { Context, Next } from 'hono'
import { createMiddleware } from 'hono/factory'
import { verifyJwt } from '../services/jwt-token.service'

// Read secret lazily so tests can set process.env.JWT_SECRET before first request
function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(s)
}

export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const user = await verifyJwt(token, getSecret())
    c.set('user', user)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
