import type { Sql } from 'postgres'
import type {
  IEmployeeRepository, EmployeeSummary, EmployeeDetail, EmployeeOnboarding,
  EmployeeListQuery, EmployeeListResult, CreateEmployeeInput, UpdateEmployeeInput,
  EmployeeStatus, OnboardingStepName,
} from '@hrms/core/contracts/employees'
import { ONBOARDING_STEPS } from '@hrms/core/contracts/employees'

interface EmployeeRow {
  id: string
  full_name: string
  document_id: string
  corporate_email: string
  department_id: string
  department_name: string
  job_title: string
  salary: string
  status: EmployeeStatus
  hire_date: Date
  termination_date: Date | null
  created_at: Date
  updated_at: Date
}

interface OnboardingRow {
  id: string
  employee_id: string
  step: OnboardingStepName
  completed: boolean
  completed_at: Date | null
  notes: string | null
  created_at: Date
}

function toSummary(row: EmployeeRow): EmployeeSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    documentId: row.document_id,
    corporateEmail: row.corporate_email,
    department: { id: row.department_id, name: row.department_name },
    jobTitle: row.job_title,
    salary: Number(row.salary),
    status: row.status,
    hireDate: row.hire_date,
  }
}

function toOnboarding(row: OnboardingRow): EmployeeOnboarding {
  return {
    id: row.id,
    employeeId: row.employee_id,
    step: row.step,
    completed: row.completed,
    completedAt: row.completed_at,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export class EmployeeRepository implements IEmployeeRepository {
  constructor(private readonly sql: Sql) {}

  async findAll(query: EmployeeListQuery): Promise<EmployeeListResult> {
    const page  = query.page  ?? 1
    const limit = query.limit ?? 20
    const offset = (page - 1) * limit

    const rows = await this.sql<(EmployeeRow & { total_count: string })[]>`
      SELECT
        e.id, e.full_name, e.document_id, e.corporate_email,
        e.department_id, d.name AS department_name,
        e.job_title, e.salary, e.status, e.hire_date,
        e.termination_date, e.created_at, e.updated_at,
        COUNT(*) OVER() AS total_count
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE
        (${query.departmentId ?? null}::uuid IS NULL OR e.department_id = ${query.departmentId ?? null}::uuid)
        AND (${query.status ?? null}::text IS NULL OR e.status = ${query.status ?? null}::text)
        AND (
          ${query.search ?? null}::text IS NULL OR
          e.full_name       ILIKE ${'%' + (query.search ?? '') + '%'} OR
          e.corporate_email ILIKE ${'%' + (query.search ?? '') + '%'} OR
          e.document_id     ILIKE ${'%' + (query.search ?? '') + '%'}
        )
      ORDER BY e.full_name
      LIMIT ${limit} OFFSET ${offset}
    `

    return {
      data: rows.map(toSummary),
      total: rows[0] ? Number(rows[0].total_count) : 0,
      page,
    }
  }

  async findById(id: string): Promise<EmployeeDetail | null> {
    const rows = await this.sql<EmployeeRow[]>`
      SELECT
        e.id, e.full_name, e.document_id, e.corporate_email,
        e.department_id, d.name AS department_name,
        e.job_title, e.salary, e.status, e.hire_date,
        e.termination_date, e.created_at, e.updated_at
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.id = ${id}
    `
    if (!rows[0]) return null

    const onboarding = await this.findOnboarding(id)
    const summary = toSummary(rows[0])
    return {
      ...summary,
      terminationDate: rows[0].termination_date,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
      onboarding,
    }
  }

  async findByEmail(email: string): Promise<EmployeeSummary | null> {
    const rows = await this.sql<EmployeeRow[]>`
      SELECT e.id, e.full_name, e.document_id, e.corporate_email,
        e.department_id, d.name AS department_name,
        e.job_title, e.salary, e.status, e.hire_date,
        e.termination_date, e.created_at, e.updated_at
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.corporate_email = ${email}
    `
    return rows[0] ? toSummary(rows[0]) : null
  }

  async findByDocumentId(documentId: string): Promise<EmployeeSummary | null> {
    const rows = await this.sql<EmployeeRow[]>`
      SELECT e.id, e.full_name, e.document_id, e.corporate_email,
        e.department_id, d.name AS department_name,
        e.job_title, e.salary, e.status, e.hire_date,
        e.termination_date, e.created_at, e.updated_at
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.document_id = ${documentId}
    `
    return rows[0] ? toSummary(rows[0]) : null
  }

  async create(input: CreateEmployeeInput): Promise<EmployeeDetail> {
    return this.sql.begin(async (tx) => {
      const [empRow] = await tx<EmployeeRow[]>`
        INSERT INTO employees
          (full_name, document_id, corporate_email, department_id, job_title, salary, hire_date)
        VALUES
          (${input.fullName}, ${input.documentId}, ${input.corporateEmail},
           ${input.departmentId}, ${input.jobTitle}, ${input.salary}, ${input.hireDate})
        RETURNING
          id, full_name, document_id, corporate_email, department_id,
          job_title, salary, status, hire_date, termination_date, created_at, updated_at
      `
      if (!empRow) throw new Error('Employee creation failed')

      // Fetch department name for the response
      const [deptRow] = await tx<{ name: string }[]>`
        SELECT name FROM departments WHERE id = ${input.departmentId}
      `

      const onboardingRows = await tx<OnboardingRow[]>`
        INSERT INTO employee_onboarding (employee_id, step)
        SELECT ${empRow.id}, step FROM unnest(${ONBOARDING_STEPS}::text[]) AS step
        RETURNING id, employee_id, step, completed, completed_at, notes, created_at
      `

      const row: EmployeeRow = { ...empRow, department_name: deptRow!.name }
      const summary = toSummary(row)
      return {
        ...summary,
        terminationDate: empRow.termination_date,
        createdAt: empRow.created_at,
        updatedAt: empRow.updated_at,
        onboarding: onboardingRows.map(toOnboarding),
      }
    })
  }

  async update(id: string, input: UpdateEmployeeInput): Promise<EmployeeSummary> {
    const [row] = await this.sql<EmployeeRow[]>`
      UPDATE employees SET
        full_name     = COALESCE(${input.fullName     ?? null}, full_name),
        department_id = COALESCE(${input.departmentId ?? null}::uuid, department_id),
        job_title     = COALESCE(${input.jobTitle     ?? null}, job_title),
        salary        = COALESCE(${input.salary       ?? null}::numeric, salary),
        status        = COALESCE(${input.status       ?? null}, status),
        updated_at    = now()
      WHERE id = ${id}
      RETURNING id, full_name, document_id, corporate_email, department_id,
                job_title, salary, status, hire_date, termination_date, created_at, updated_at
    `
    if (!row) throw new Error(`Employee ${id} not found`)

    const [deptRow] = await this.sql<{ name: string }[]>`
      SELECT name FROM departments WHERE id = ${row.department_id}
    `
    return toSummary({ ...row, department_name: deptRow!.name })
  }

  async terminate(id: string, terminationDate: Date): Promise<EmployeeSummary> {
    const [row] = await this.sql<EmployeeRow[]>`
      UPDATE employees SET
        status           = 'INACTIVE',
        termination_date = ${terminationDate},
        updated_at       = now()
      WHERE id = ${id}
      RETURNING id, full_name, document_id, corporate_email, department_id,
                job_title, salary, status, hire_date, termination_date, created_at, updated_at
    `
    if (!row) throw new Error(`Employee ${id} not found`)

    const [deptRow] = await this.sql<{ name: string }[]>`
      SELECT name FROM departments WHERE id = ${row.department_id}
    `
    return toSummary({ ...row, department_name: deptRow!.name })
  }

  async findOnboarding(employeeId: string): Promise<EmployeeOnboarding[]> {
    const rows = await this.sql<OnboardingRow[]>`
      SELECT id, employee_id, step, completed, completed_at, notes, created_at
      FROM employee_onboarding
      WHERE employee_id = ${employeeId}
      ORDER BY ARRAY_POSITION(ARRAY['documents','equipment','training','access','complete'], step)
    `
    return rows.map(toOnboarding)
  }

  async updateOnboardingStep(
    employeeId: string,
    step: OnboardingStepName,
    completed: boolean,
    notes?: string,
  ): Promise<EmployeeOnboarding> {
    const [row] = await this.sql<OnboardingRow[]>`
      UPDATE employee_onboarding SET
        completed    = ${completed},
        completed_at = ${completed ? this.sql`now()` : this.sql`NULL`},
        notes        = COALESCE(${notes ?? null}, notes)
      WHERE employee_id = ${employeeId} AND step = ${step}
      RETURNING id, employee_id, step, completed, completed_at, notes, created_at
    `
    if (!row) throw new Error(`Onboarding step ${step} not found for employee ${employeeId}`)
    return toOnboarding(row)
  }
}
