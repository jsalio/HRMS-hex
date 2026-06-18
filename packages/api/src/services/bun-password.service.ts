import type { IPasswordService } from '@hrms/core/contracts/auth'

/**
 * Password hashing and verification backed by Bun's native `Bun.password`
 * primitives. Implements the {@link IPasswordService} contract.
 */
export class BunPasswordService implements IPasswordService {
  /**
   * Hashes a plaintext password using Bun's default algorithm.
   *
   * @param password - plaintext password to hash
   * @returns the resulting password hash, safe to persist
   */
  async hash(password: string): Promise<string> {
    return Bun.password.hash(password)
  }

  /**
   * Verifies a plaintext password against a previously stored hash.
   *
   * @param password - plaintext password to check
   * @param hash - stored password hash to compare against
   * @returns true when the password matches the hash, false otherwise
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return Bun.password.verify(password, hash)
  }
}
