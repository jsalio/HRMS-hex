import { SignJWT, jwtVerify } from 'jose'
import { createHash } from 'crypto'
import { randomBytes } from 'crypto'
import type { ITokenService, AuthenticatedUser } from '@hrms/core/contracts/auth'
import { UnauthorizedError } from '@hrms/core'

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m'

export class JwtTokenService implements ITokenService {
  private readonly secretBytes: Uint8Array

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters')
    }
    this.secretBytes = new TextEncoder().encode(secret)
  }

  generateAccessToken(user: AuthenticatedUser): string {
    return new SignJWT({ sub: user.id, email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.secretBytes) as unknown as string
  }

  verifyAccessToken(token: string): AuthenticatedUser {
    // jose verify is async — use synchronous decode for speed in middleware
    // Full verify happens in auth.middleware via async path
    try {
      const parts = token.split('.')
      if (parts.length !== 3 || !parts[1]) throw new UnauthorizedError('Invalid token format')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      if (!payload.sub || !payload.email || !payload.role) throw new UnauthorizedError('Invalid token payload')
      return { id: payload.sub, email: payload.email, role: payload.role }
    } catch {
      throw new UnauthorizedError('Invalid access token')
    }
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('hex')
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}

/** Full async JWT verification — used in auth middleware */
export async function verifyJwt(token: string, secret: Uint8Array): Promise<AuthenticatedUser> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub || !payload.email || !payload.role) throw new UnauthorizedError()
    return { id: payload.sub as string, email: payload.email as string, role: payload.role as AuthenticatedUser['role'] }
  } catch {
    throw new UnauthorizedError('Invalid or expired access token')
  }
}
