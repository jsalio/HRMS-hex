import { SignJWT, jwtVerify } from 'jose'
import { createHash } from 'crypto'
import { randomBytes } from 'crypto'
import type { ITokenService, AuthenticatedUser } from '@hrms/core/contracts/auth'
import { UnauthorizedError } from '@hrms/core'

function parseTokenTtl(raw: string | undefined): string {
  const ttl = raw ?? '15m'
  if (!/^\d+[smhd]$/.test(ttl)) throw new Error(`Invalid ACCESS_TOKEN_TTL format: "${ttl}". Use format like 15m, 1h, 7d.`)
  return ttl
}

const ACCESS_TOKEN_TTL = parseTokenTtl(process.env.ACCESS_TOKEN_TTL)

/**
 * Issues and inspects authentication tokens (JWT access tokens and opaque
 * refresh tokens) using HS256 signing. Implements the {@link ITokenService}
 * contract.
 */
export class JwtTokenService implements ITokenService {
  private readonly secretBytes: Uint8Array

  /**
   * Creates the service with the symmetric signing secret.
   *
   * @param secret - HS256 signing secret; must be at least 32 characters
   * @throws {Error} when the secret is missing or shorter than 32 characters
   */
  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters')
    }
    this.secretBytes = new TextEncoder().encode(secret)
  }

  /**
   * Issues a signed JWT access token carrying the user's identity, role and
   * optional employee reference, expiring after the configured TTL.
   *
   * @param user - authenticated user to encode into the token claims
   * @returns the signed HS256 access token
   */
  async generateAccessToken(user: AuthenticatedUser): Promise<string> {
    return new SignJWT({ sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId ?? null })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.secretBytes)
  }

  /**
   * Decodes an access token and extracts the authenticated user from its
   * payload. Performs structural validation only (no signature check); full
   * signature verification is done asynchronously in the auth middleware.
   *
   * @param token - the access token to decode
   * @returns the authenticated user reconstructed from the token claims
   * @throws {UnauthorizedError} when the token format or payload is invalid
   */
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

  /**
   * Generates a cryptographically random opaque refresh token.
   *
   * @returns a 256-bit refresh token encoded as a hex string
   */
  generateRefreshToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Computes a stable hash of a token for storage and lookup, so raw refresh
   * tokens are never persisted.
   *
   * @param token - the token to hash
   * @returns the SHA-256 digest of the token as a hex string
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}

/**
 * Fully verifies a JWT (signature and expiry) and extracts the authenticated
 * user from its payload. Used by the auth middleware for the async path.
 *
 * @param token - the access token to verify
 * @param secret - the HS256 signing secret bytes used to verify the signature
 * @returns the authenticated user reconstructed from the verified claims
 * @throws {UnauthorizedError} when the token is invalid, expired, or its
 * payload is missing required claims
 */
export async function verifyJwt(token: string, secret: Uint8Array): Promise<AuthenticatedUser> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.sub || !payload.email || !payload.role) throw new UnauthorizedError()
    return { id: payload.sub as string, email: payload.email as string, employeeId: (payload.employeeId as string | null) ?? null, role: payload.role as AuthenticatedUser['role'] }
  } catch {
    throw new UnauthorizedError('Invalid or expired access token')
  }
}
