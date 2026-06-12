import type { IRefreshTokenRepository, ITokenService, IUserRepository, AuthenticatedUser } from '../contracts/auth'
import type { IRoleRepository } from '../contracts/roles'
import { UnauthorizedError } from '../domain/errors'

interface RefreshInput {
  refreshToken: string
}

interface RefreshResult {
  access_token: string
  refresh_token: string
}

export class RefreshTokenUseCase {
  constructor(
    private readonly tokenRepo: IRefreshTokenRepository,
    private readonly userRepo: IUserRepository,
    private readonly tokenSvc: ITokenService,
    private readonly roleRepo?: IRoleRepository,
  ) {}

  async execute(input: RefreshInput): Promise<RefreshResult> {
    const hash = this.tokenSvc.hashToken(input.refreshToken)
    const stored = await this.tokenRepo.findByHash(hash)

    if (!stored) throw new UnauthorizedError('Refresh token not found')
    if (stored.revokedAt !== null) throw new UnauthorizedError('Refresh token revoked')
    if (stored.expiresAt < new Date()) throw new UnauthorizedError('Refresh token expired')

    const user = await this.userRepo.findById(stored.userId)
    if (!user) throw new UnauthorizedError('User not found')
    user.assertCanAuthenticate()

    // Rotation: revoke old, issue new
    await this.tokenRepo.revoke(stored.id)

    const newRawRefresh = this.tokenSvc.generateRefreshToken()
    const newHash = this.tokenSvc.hashToken(newRawRefresh)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await this.tokenRepo.create({ userId: user.id, tokenHash: newHash, expiresAt })

    // Build AuthenticatedUser with minimal info for access token
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: { id: user.roleId, name: '', permissions: [] },
    }

    const access_token = this.tokenSvc.generateAccessToken(authenticatedUser)

    return { access_token, refresh_token: newRawRefresh }
  }
}
