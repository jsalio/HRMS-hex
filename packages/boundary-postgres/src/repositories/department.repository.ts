import type { Sql } from 'postgres'
import type { IDepartmentRepository, Department } from '@hrms/core/contracts/employees'

interface DeptRow {
  id: string
  name: string
  created_at: Date
}

/** Maps a raw departments table row to a Department domain object. */
function toDept(row: DeptRow): Department {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

/**
 * Postgres adapter implementing IDepartmentRepository over the `departments` table.
 */
export class DepartmentRepository implements IDepartmentRepository {
  /**
   * @param sql - Postgres client used to execute department queries
   */
  constructor(private readonly sql: Sql) {}

  /**
   * Reads every department ordered alphabetically by name.
   *
   * @returns all departments stored in the system
   */
  async findAll(): Promise<Department[]> {
    const rows = await this.sql<DeptRow[]>`
      SELECT id, name, created_at FROM departments ORDER BY name
    `
    return rows.map(toDept)
  }

  /**
   * Reads a single department by its identifier.
   *
   * @param id - identifier of the department to read
   * @returns the matching department, or null when none exists
   */
  async findById(id: string): Promise<Department | null> {
    const rows = await this.sql<DeptRow[]>`
      SELECT id, name, created_at FROM departments WHERE id = ${id}
    `
    return rows[0] ? toDept(rows[0]) : null
  }

  /**
   * Reads a single department by its unique name.
   *
   * @param name - name of the department to read
   * @returns the matching department, or null when none exists
   */
  async findByName(name: string): Promise<Department | null> {
    const rows = await this.sql<DeptRow[]>`
      SELECT id, name, created_at FROM departments WHERE name = ${name}
    `
    return rows[0] ? toDept(rows[0]) : null
  }

  /**
   * Persists a new department with the given name.
   *
   * @param name - name for the new department
   * @returns the created department
   * @throws {Error} when the insert returns no row
   */
  async create(name: string): Promise<Department> {
    const [row] = await this.sql<DeptRow[]>`
      INSERT INTO departments (name) VALUES (${name})
      RETURNING id, name, created_at
    `
    if (!row) throw new Error('Department creation failed')
    return toDept(row)
  }
}
