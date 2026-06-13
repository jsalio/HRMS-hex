import type { IPasswordService } from '@hrms/core/contracts/auth'

export class BunPasswordService implements IPasswordService {
  async hash(password: string): Promise<string> {
    return Bun.password.hash(password)
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash)
  }
}
