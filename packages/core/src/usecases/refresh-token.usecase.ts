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
    private readonly roleRepo: IRoleRepository,
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

    const resolvedRole = await this.roleRepo.findById(user.roleId)
    if (!resolvedRole) throw new UnauthorizedError('Role not found')

    // Rotation: revoke old, issue new
    await this.tokenRepo.revoke(stored.id)

    const newRawRefresh = this.tokenSvc.generateRefreshToken()
    const newHash = this.tokenSvc.hashToken(newRawRefresh)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await this.tokenRepo.create({ userId: user.id, tokenHash: newHash, expiresAt })

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: {
        id: resolvedRole.id,
        name: resolvedRole.name,
        permissions: resolvedRole.toAuthPermissions(),
      },
    }

    const access_token = await this.tokenSvc.generateAccessToken(authenticatedUser)

    return { access_token, refresh_token: newRawRefresh }
  }
}
