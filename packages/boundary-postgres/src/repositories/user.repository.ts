import type { Sql } from 'postgres'
import { User } from '@hrms/core/domain/user'
import type { IUserRepository, CreateUserData } from '@hrms/core/contracts/auth'

interface UserRow {
  id: string
  email: string
  password_hash: string
  role_id: string
  employee_id: string | null
  is_active: boolean
  last_login_at: Date | null
}

function toUser(row: UserRow): User {
  return new User({
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    roleId: row.role_id,
    employeeId: row.employee_id,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
  })
}

export class UserRepository implements IUserRepository {
  constructor(private readonly sql: Sql) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, email, password_hash, role_id, employee_id, is_active, last_login_at
      FROM users WHERE email = ${email}
    `
    return rows[0] ? toUser(rows[0]) : null
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, email, password_hash, role_id, employee_id, is_active, last_login_at
      FROM users WHERE id = ${id}
    `
    return rows[0] ? toUser(rows[0]) : null
  }

  async create(data: CreateUserData): Promise<User> {
    const [row] = await this.sql<UserRow[]>`
      INSERT INTO users (email, password_hash, role_id, employee_id)
      VALUES (${data.email}, ${data.passwordHash}, ${data.roleId}, ${data.employeeId ?? null})
      RETURNING id, email, password_hash, role_id, employee_id, is_active, last_login_at
    `
    if (!row) throw new Error('User creation failed')
    return toUser(row)
  }

  async deactivate(id: string): Promise<User> {
    const [row] = await this.sql<UserRow[]>`
      UPDATE users SET is_active = false, updated_at = now()
      WHERE id = ${id}
      RETURNING id, email, password_hash, role_id, employee_id, is_active, last_login_at
    `
    if (!row) throw new Error(`User ${id} not found`)
    return toUser(row)
  }

  async setEmployee(userId: string, employeeId: string): Promise<void> {
    await this.sql`UPDATE users SET employee_id = ${employeeId}, updated_at = now() WHERE id = ${userId}`
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.sql`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = ${userId}`
  }
}
