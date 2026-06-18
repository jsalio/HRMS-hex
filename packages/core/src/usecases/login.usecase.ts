import type { IUserRepository, ITokenService, IRefreshTokenRepository, IPasswordService, AuthenticatedUser } from '../contracts/auth'
import type { IRoleRepository } from '../contracts/roles'
import { UnauthorizedError } from '../domain/errors'

const REFRESH_TOKEN_TTL_DAYS = 7

interface LoginInput {
  email: string
  password: string
}

interface LoginResult {
  access_token: string
  refresh_token: string
  user: AuthenticatedUser
}

export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly tokenSvc: ITokenService,
    private readonly tokenRepo: IRefreshTokenRepository,
    private readonly passwordSvc: IPasswordService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(input.email)
    if (!user) throw new UnauthorizedError()

    user.assertCanAuthenticate()

    const passwordValid = await this.passwordSvc.verify(input.password, user.passwordHash)
    if (!passwordValid) throw new UnauthorizedError()

    const role = await this.roleRepo.findById(user.roleId)
    if (!role) throw new UnauthorizedError('Role not found')

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      employeeId: user.employeeId ?? undefined,
      role: {
        id: role.id,
        name: role.name,
        permissions: role.toAuthPermissions(),
      },
    }

    const access_token = await this.tokenSvc.generateAccessToken(authenticatedUser)
    const rawRefresh = this.tokenSvc.generateRefreshToken()
    const tokenHash = this.tokenSvc.hashToken(rawRefresh)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

    await Promise.all([
      this.tokenRepo.create({ userId: user.id, tokenHash, expiresAt }),
      this.userRepo.updateLastLogin(user.id),
    ])

    return { access_token, refresh_token: rawRefresh, user: authenticatedUser }
  }
}
