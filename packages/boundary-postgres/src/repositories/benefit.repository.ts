import type { Sql } from 'postgres'
import type {
  IBenefitRepository,
  BenefitPlanData, EmployeeBenefitData, CreateBenefitPlanInput,
} from '@hrms/core/contracts/benefits'
import type { BenefitPlanType } from '@hrms/core/domain/benefit-plan'

/** Maps a raw benefit_plans row to a BenefitPlanData. */
function toPlanData(row: any): BenefitPlanData {
  return {
    id:          row.id,
    name:        row.name,
    type:        row.type as BenefitPlanType,
    description: row.description ?? null,
    provider:    row.provider ?? null,
    cost:        row.cost !== null && row.cost !== undefined ? Number(row.cost) : null,
    isActive:    row.is_active,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

/** Maps a raw employee_benefits row (optionally joined with its plan) to an EmployeeBenefitData. */
function toEnrollmentData(row: any): EmployeeBenefitData {
  return {
    id:           row.id,
    employeeId:   row.employee_id,
    planId:       row.plan_id,
    enrolledAt:   typeof row.enrolled_at === 'string' ? row.enrolled_at : row.enrolled_at.toISOString().slice(0, 10),
    unenrolledAt: row.unenrolled_at
      ? (typeof row.unenrolled_at === 'string' ? row.unenrolled_at : row.unenrolled_at.toISOString().slice(0, 10))
      : null,
    plan: row.bp_id ? toPlanData({
      id: row.bp_id, name: row.bp_name, type: row.bp_type,
      description: row.bp_description, provider: row.bp_provider, cost: row.bp_cost,
      is_active: row.bp_is_active, created_at: row.bp_created_at, updated_at: row.bp_updated_at,
    }) : undefined,
  }
}

/**
 * Postgres adapter implementing IBenefitRepository over the `benefit_plans`
 * and `employee_benefits` tables.
 */
export class BenefitRepository implements IBenefitRepository {
  /**
   * @param sql - Postgres client used to execute benefit queries
   */
  constructor(private readonly sql: Sql) {}

  /**
   * Reads every benefit plan ordered by name.
   *
   * @returns all benefit plans including inactive ones
   */
  async findAll(): Promise<BenefitPlanData[]> {
    const rows = await this.sql`SELECT * FROM benefit_plans ORDER BY name`
    return rows.map(toPlanData)
  }

  /**
   * Reads a single benefit plan by its identifier.
   *
   * @param id - identifier of the plan to read
   * @returns the matching plan, or null when none exists
   */
  async findById(id: string): Promise<BenefitPlanData | null> {
    const rows = await this.sql`SELECT * FROM benefit_plans WHERE id = ${id}`
    return rows[0] ? toPlanData(rows[0]) : null
  }

  /**
   * Reads a benefit plan by its unique name.
   *
   * @param name - the exact plan name to look up
   * @returns the matching plan, or null when none exists
   */
  async findByName(name: string): Promise<BenefitPlanData | null> {
    const rows = await this.sql`SELECT * FROM benefit_plans WHERE name = ${name}`
    return rows[0] ? toPlanData(rows[0]) : null
  }

  /**
   * Persists a new benefit plan.
   *
   * @param data - fields for the new plan
   * @returns the created plan with its generated id
   */
  async create(data: CreateBenefitPlanInput): Promise<BenefitPlanData> {
    const rows = await this.sql`
      INSERT INTO benefit_plans (name, type, description, provider, cost)
      VALUES (${data.name}, ${data.type}, ${data.description ?? null}, ${data.provider ?? null}, ${data.cost ?? null})
      RETURNING *
    `
    return toPlanData(rows[0])
  }

  /**
   * Updates the supplied fields on an existing benefit plan.
   *
   * @param id - identifier of the plan to update
   * @param data - partial set of fields to change
   * @returns the updated plan record
   */
  async update(id: string, data: Partial<CreateBenefitPlanInput> & { isActive?: boolean }): Promise<BenefitPlanData> {
    const rows = await this.sql`
      UPDATE benefit_plans SET
        name        = COALESCE(${data.name        ?? null}, name),
        type        = COALESCE(${data.type        ?? null}, type),
        description = COALESCE(${data.description ?? null}, description),
        provider    = COALESCE(${data.provider    ?? null}, provider),
        cost        = COALESCE(${data.cost        ?? null}, cost),
        is_active   = COALESCE(${data.isActive    ?? null}, is_active),
        updated_at  = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toPlanData(rows[0])
  }

  /**
   * Reads all benefit enrollments of an employee, joined with plan details.
   *
   * @param employeeId - identifier of the employee whose enrollments are read
   * @returns enrollment records including embedded plan data
   */
  async findByEmployee(employeeId: string): Promise<EmployeeBenefitData[]> {
    const rows = await this.sql`
      SELECT
        eb.id, eb.employee_id, eb.plan_id, eb.enrolled_at, eb.unenrolled_at,
        bp.id          AS bp_id,
        bp.name        AS bp_name,
        bp.type        AS bp_type,
        bp.description AS bp_description,
        bp.provider    AS bp_provider,
        bp.cost        AS bp_cost,
        bp.is_active   AS bp_is_active,
        bp.created_at  AS bp_created_at,
        bp.updated_at  AS bp_updated_at
      FROM employee_benefits eb
      JOIN benefit_plans bp ON bp.id = eb.plan_id
      WHERE eb.employee_id = ${employeeId}
      ORDER BY eb.enrolled_at DESC
    `
    return rows.map(toEnrollmentData)
  }

  /**
   * Reads a specific enrollment record for an employee–plan pair.
   *
   * @param employeeId - the employee's identifier
   * @param planId - the plan's identifier
   * @returns the enrollment record, or null when none exists
   */
  async findEnrollment(employeeId: string, planId: string): Promise<EmployeeBenefitData | null> {
    const rows = await this.sql`
      SELECT * FROM employee_benefits
      WHERE employee_id = ${employeeId} AND plan_id = ${planId}
    `
    return rows[0] ? toEnrollmentData(rows[0]) : null
  }

  /**
   * Creates an enrollment record.
   *
   * @param employeeId - the employee to enroll
   * @param planId - the plan to enroll the employee in
   * @param enrolledAt - ISO date string for the enrollment start date
   * @returns the created enrollment record
   */
  async enroll(employeeId: string, planId: string, enrolledAt: string): Promise<EmployeeBenefitData> {
    const rows = await this.sql`
      INSERT INTO employee_benefits (employee_id, plan_id, enrolled_at)
      VALUES (${employeeId}, ${planId}, ${enrolledAt})
      ON CONFLICT (employee_id, plan_id) DO UPDATE
        SET enrolled_at = EXCLUDED.enrolled_at, unenrolled_at = NULL
      RETURNING *
    `
    return toEnrollmentData(rows[0])
  }

  /**
   * Sets the unenrollment date on an existing enrollment record.
   *
   * @param employeeId - the employee to unenroll
   * @param planId - the plan to unenroll the employee from
   * @param unenrolledAt - ISO date string for the effective unenrollment date
   * @returns the updated enrollment record with unenrolledAt set
   */
  async unenroll(employeeId: string, planId: string, unenrolledAt: string): Promise<EmployeeBenefitData> {
    const rows = await this.sql`
      UPDATE employee_benefits
      SET unenrolled_at = ${unenrolledAt}
      WHERE employee_id = ${employeeId} AND plan_id = ${planId}
      RETURNING *
    `
    return toEnrollmentData(rows[0])
  }
}
