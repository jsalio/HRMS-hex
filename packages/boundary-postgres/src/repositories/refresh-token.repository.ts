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

export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly sql: Sql) {}

  async create(data: CreateRefreshTokenData): Promise<void> {
    await this.sql`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (${data.userId}, ${data.tokenHash}, ${data.expiresAt})
    `
  }

  async findByHash(hash: string): Promise<StoredRefreshToken | null> {
    const rows = await this.sql<TokenRow[]>`
      SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
      FROM refresh_tokens WHERE token_hash = ${hash}
    `
    return rows[0] ? toStoredToken(rows[0]) : null
  }

  async revoke(tokenId: string): Promise<void> {
    await this.sql`UPDATE refresh_tokens SET revoked_at = now() WHERE id = ${tokenId}`
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`
  }
}
