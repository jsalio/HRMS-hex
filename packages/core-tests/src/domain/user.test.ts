import { describe, it, expect } from 'bun:test'
import { User } from '@hrms/core/domain/user'
import { UnauthorizedError } from '@hrms/core/domain/errors'

describe('User entity', () => {
  // Test 1.6
  it('given_active_user_when_assertCanAuthenticate_then_does_not_throw', () => {
    const user = new User({ id: 'u1', email: 'a@b.com', passwordHash: 'h', isActive: true, roleId: 'r1' })
    expect(() => user.assertCanAuthenticate()).not.toThrow()
  })

  // Test 1.7
  it('given_inactive_user_when_assertCanAuthenticate_then_throws_UnauthorizedError', () => {
    const user = new User({ id: 'u2', email: 'a@b.com', passwordHash: 'h', isActive: false, roleId: 'r1' })
    expect(() => user.assertCanAuthenticate()).toThrow(UnauthorizedError)
  })
})
