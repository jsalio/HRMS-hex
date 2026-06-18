import type { Sql } from 'postgres'
import type { IRefreshTokenRepository, StoredRefreshToken, CreateRefreshTokenData } from '@hrms/core/contracts/auth'

interface TokenRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  revoked_at: Date | null
  created_at: Date
}

/** Maps a raw refresh_tokens table row to a StoredRefreshToken. */
function toStoredToken(row: TokenRow): StoredRefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }
}

/**
 * Postgres adapter implementing IRefreshTokenRepository over the `refresh_tokens` table.
 */
export class RefreshTokenRepository implements IRefreshTokenRepository {
  /**
   * @param sql - Postgres client used to execute refresh-token queries
   */
  constructor(private readonly sql: Sql) {}

  /**
   * Persists a new refresh token for a user.
   *
   * @param data - owning user, token hash and expiry of the token to store
   */
  async create(data: CreateRefreshTokenData): Promise<void> {
    await this.sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (${data.userId}, ${data.tokenHash}, ${data.expiresAt})
    `
  }

  /**
   * Reads a stored refresh token by its hashed value.
   *
   * @param hash - hash of the refresh token to look up
   * @returns the matching stored token, or null when none exists
   */
  async findByHash(hash: string): Promise<StoredRefreshToken | null> {
    const rows = await this.sql<TokenRow[]>`
      SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
      FROM refresh_tokens WHERE token_hash = ${hash}
    `
    return rows[0] ? toStoredToken(rows[0]) : null
  }

  /**
   * Revokes a single refresh token by marking it revoked.
   *
   * @param tokenId - identifier of the token to revoke
   */
  async revoke(tokenId: string): Promise<void> {
    await this.sql`UPDATE refresh_tokens SET revoked_at = now() WHERE id = ${tokenId}`
  }

  /**
   * Revokes every active refresh token belonging to a user.
   *
   * @param userId - identifier of the user whose tokens are revoked
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`
  }
}
