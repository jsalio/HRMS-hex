import type { Sql } from 'postgres'
import type { IDepartmentRepository, Department } from '@hrms/core/contracts/employees'

interface DeptRow {
  id: string
  name: string
  created_at: Date
}

function toDept(row: DeptRow): Department {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

export class DepartmentRepository implements IDepartmentRepository {
  constructor(private readonly sql: Sql) {}

  async findAll(): Promise<Department[]> {
    const rows = await this.sql<DeptRow[]>`
      SELECT id, name, created_at FROM departments ORDER BY name
    `
    return rows.map(toDept)
  }

  async findById(id: string): Promise<Department | null> {
    const rows = await this.sql<DeptRow[]>`
      SELECT id, name, created_at FROM departments WHERE id = ${id}
    `
    return rows[0] ? toDept(rows[0]) : null
  }

  async findByName(name: string): Promise<Department | null> {
    const rows = await this.sql<DeptRow[]>`
      SELECT id, name, created_at FROM departments WHERE name = ${name}
    `
    return rows[0] ? toDept(rows[0]) : null
  }

  async create(name: string): Promise<Department> {
    const [row] = await this.sql<DeptRow[]>`
      INSERT INTO departments (name) VALUES (${name})
      RETURNING id, name, created_at
    `
    if (!row) throw new Error('Department creation failed')
    return toDept(row)
  }
}
