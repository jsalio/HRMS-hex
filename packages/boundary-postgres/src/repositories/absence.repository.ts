import type { Sql } from 'postgres'
import type {
  IAbsenceRepository,
  AbsenceTypeData, AbsenceBalanceData, AbsenceRequestData,
  AbsenceRequestQuery, CreateAbsenceRequestInput,
  AbsenceStatus,
} from '@hrms/core/contracts/absences'

/** Maps a raw absence_types table row to an AbsenceTypeData. */
function toTypeData(row: any): AbsenceTypeData {
  return {
    id: row.id,
    name: row.name,
    annualAllowanceDays: Number(row.annual_allowance_days),
    requiresApproval: row.requires_approval,
    createdAt: row.created_at,
  }
}

/** Maps a raw absence_balances row (optionally joined with its type) to an AbsenceBalanceData. */
function toBalanceData(row: any): AbsenceBalanceData {
  return {
    id: row.id,
    employeeId: row.employee_id,
    absenceTypeId: row.absence_type_id,
    year: row.year,
    allocatedDays: Number(row.allocated_days),
    usedDays: Number(row.used_days),
    pendingDays: Number(row.pending_days),
    absenceType: row.at_id ? {
      id: row.at_id, name: row.at_name,
      annualAllowanceDays: Number(row.at_allowance),
      requiresApproval: row.at_requires_approval,
      createdAt: row.at_created_at,
    } : undefined,
  }
}

/** Maps a raw absence_requests row (optionally joined with its type) to an AbsenceRequestData. */
function toRequestData(row: any): AbsenceRequestData {
  return {
    id: row.id,
    employeeId: row.employee_id,
    absenceTypeId: row.absence_type_id,
    startDate: typeof row.start_date === 'string' ? row.start_date : row.start_date.toISOString().slice(0, 10),
    endDate: typeof row.end_date === 'string' ? row.end_date : row.end_date.toISOString().slice(0, 10),
    workingDays: Number(row.working_days),
    reason: row.reason,
    status: row.status as AbsenceStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    absenceType: row.at_id ? {
      id: row.at_id, name: row.at_name,
      annualAllowanceDays: Number(row.at_allowance),
      requiresApproval: row.at_requires_approval,
      createdAt: row.at_created_at,
    } : undefined,
  }
}

/**
 * Postgres adapter implementing IAbsenceRepository over the `absence_types`,
 * `absence_balances` and `absence_requests` tables.
 */
export class AbsenceRepository implements IAbsenceRepository {
  /**
   * @param sql - Postgres client used to execute absence queries
   */
  constructor(private readonly sql: Sql) {}

  /**
   * Reads every absence type ordered alphabetically by name.
   *
   * @returns all absence types configured in the system
   */
  async findAbsenceTypes(): Promise<AbsenceTypeData[]> {
    const rows = await this.sql`SELECT * FROM absence_types ORDER BY name`
    return rows.map(toTypeData)
  }

  /**
   * Reads a single absence type by its identifier.
   *
   * @param id - identifier of the absence type to read
   * @returns the matching absence type, or null when none exists
   */
  async findAbsenceTypeById(id: string): Promise<AbsenceTypeData | null> {
    const rows = await this.sql`SELECT * FROM absence_types WHERE id = ${id}`
    return rows[0] ? toTypeData(rows[0]) : null
  }

  /**
   * Reads an employee's absence balances for a given year, each joined with its type.
   *
   * @param employeeId - identifier of the employee whose balances are read
   * @param year - calendar year of the balances
   * @returns the employee's balances for that year
   */
  async findBalancesByEmployee(employeeId: string, year: number): Promise<AbsenceBalanceData[]> {
    const rows = await this.sql`
      SELECT ab.*,
             at.id as at_id, at.name as at_name,
             at.annual_allowance_days as at_allowance,
             at.requires_approval as at_requires_approval,
             at.created_at as at_created_at
      FROM absence_balances ab
      JOIN absence_types at ON at.id = ab.absence_type_id
      WHERE ab.employee_id = ${employeeId} AND ab.year = ${year}
    `
    return rows.map(toBalanceData)
  }

  /**
   * Returns the existing balance for an employee, type and year, creating it if absent.
   * When it already exists, its allocation is raised to at least the requested value.
   *
   * @param employeeId - identifier of the employee
   * @param absenceTypeId - identifier of the absence type
   * @param year - calendar year of the balance
   * @param allocatedDays - days to allocate; existing allocations are never lowered below this
   * @returns the existing or newly created balance
   */
  async findOrCreateBalance(
    employeeId: string, absenceTypeId: string, year: number, allocatedDays: number
  ): Promise<AbsenceBalanceData> {
    const rows = await this.sql`
      INSERT INTO absence_balances (employee_id, absence_type_id, year, allocated_days)
      VALUES (${employeeId}, ${absenceTypeId}, ${year}, ${allocatedDays})
      ON CONFLICT (employee_id, absence_type_id, year) DO UPDATE
        SET allocated_days = GREATEST(absence_balances.allocated_days, EXCLUDED.allocated_days)
      RETURNING *
    `
    return toBalanceData(rows[0])
  }

  /**
   * Adds days to a balance's pending total, reserving them for a request.
   *
   * @param balanceId - identifier of the balance to adjust
   * @param days - number of days to reserve as pending
   * @returns the updated balance
   */
  async reservePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData> {
    const rows = await this.sql`
      UPDATE absence_balances
      SET pending_days = pending_days + ${days}
      WHERE id = ${balanceId}
      RETURNING *
    `
    return toBalanceData(rows[0])
  }

  /**
   * Removes days from a balance's pending total, never dropping below zero.
   *
   * @param balanceId - identifier of the balance to adjust
   * @param days - number of pending days to release
   * @returns the updated balance
   */
  async releasePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData> {
    const rows = await this.sql`
      UPDATE absence_balances
      SET pending_days = GREATEST(0, pending_days - ${days})
      WHERE id = ${balanceId}
      RETURNING *
    `
    return toBalanceData(rows[0])
  }

  /**
   * Confirms reserved days on a balance, moving them from pending to used.
   *
   * @param balanceId - identifier of the balance to adjust
   * @param days - number of days to confirm as used
   * @returns the updated balance
   */
  async approveBalance(balanceId: string, days: number): Promise<AbsenceBalanceData> {
    const rows = await this.sql`
      UPDATE absence_balances
      SET pending_days = GREATEST(0, pending_days - ${days}),
          used_days    = used_days + ${days}
      WHERE id = ${balanceId}
      RETURNING *
    `
    return toBalanceData(rows[0])
  }

  /**
   * Reads a paginated, optionally filtered page of absence requests, each joined with its type.
   *
   * @param query - pagination and optional employee, status and date-range filters
   * @returns the matching requests for the page and the total count across all pages
   */
  async findRequests(query: AbsenceRequestQuery): Promise<{ data: AbsenceRequestData[]; total: number }> {
    const limit  = Math.min(query.limit ?? 20, 100)
    const offset = ((query.page ?? 1) - 1) * limit

    const rows = await this.sql`
      SELECT ar.*,
             at.id as at_id, at.name as at_name,
             at.annual_allowance_days as at_allowance,
             at.requires_approval as at_requires_approval,
             at.created_at as at_created_at
      FROM absence_requests ar
      JOIN absence_types at ON at.id = ar.absence_type_id
      WHERE TRUE
        ${query.employeeId ? this.sql`AND ar.employee_id = ${query.employeeId}` : this.sql``}
        ${query.status     ? this.sql`AND ar.status = ${query.status}`          : this.sql``}
        ${query.from       ? this.sql`AND ar.start_date >= ${query.from}`       : this.sql``}
        ${query.to         ? this.sql`AND ar.end_date   <= ${query.to}`         : this.sql``}
      ORDER BY ar.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const [{ count }] = await this.sql`
      SELECT COUNT(*)::int as count FROM absence_requests ar
      WHERE TRUE
        ${query.employeeId ? this.sql`AND ar.employee_id = ${query.employeeId}` : this.sql``}
        ${query.status     ? this.sql`AND ar.status = ${query.status}`          : this.sql``}
        ${query.from       ? this.sql`AND ar.start_date >= ${query.from}`       : this.sql``}
        ${query.to         ? this.sql`AND ar.end_date   <= ${query.to}`         : this.sql``}
    `

    return { data: rows.map(toRequestData), total: count }
  }

  /**
   * Reads a single absence request by its identifier, joined with its type.
   *
   * @param id - identifier of the absence request to read
   * @returns the matching request, or null when none exists
   */
  async findRequestById(id: string): Promise<AbsenceRequestData | null> {
    const rows = await this.sql`
      SELECT ar.*,
             at.id as at_id, at.name as at_name,
             at.annual_allowance_days as at_allowance,
             at.requires_approval as at_requires_approval,
             at.created_at as at_created_at
      FROM absence_requests ar
      JOIN absence_types at ON at.id = ar.absence_type_id
      WHERE ar.id = ${id}
    `
    return rows[0] ? toRequestData(rows[0]) : null
  }

  /**
   * Reads pending or approved requests of the same type that overlap a date range,
   * used to detect conflicting absences.
   *
   * @param employeeId - identifier of the employee
   * @param absenceTypeId - identifier of the absence type to check
   * @param startDate - inclusive range start in ISO `YYYY-MM-DD` form
   * @param endDate - inclusive range end in ISO `YYYY-MM-DD` form
   * @returns the overlapping requests, empty when there is no conflict
   */
  async findOverlapping(
    employeeId: string, absenceTypeId: string, startDate: string, endDate: string
  ): Promise<AbsenceRequestData[]> {
    const rows = await this.sql`
      SELECT * FROM absence_requests
      WHERE employee_id     = ${employeeId}
        AND absence_type_id = ${absenceTypeId}
        AND status          IN ('PENDING', 'APPROVED')
        AND start_date      <= ${endDate}
        AND end_date        >= ${startDate}
    `
    return rows.map(toRequestData)
  }

  /**
   * Persists a new absence request in its initial state.
   *
   * @param input - employee, type, date range, working days and optional reason for the request
   * @returns the created absence request
   */
  async createRequest(input: CreateAbsenceRequestInput): Promise<AbsenceRequestData> {
    const rows = await this.sql`
      INSERT INTO absence_requests
        (employee_id, absence_type_id, start_date, end_date, working_days, reason)
      VALUES
        (${input.employeeId}, ${input.absenceTypeId}, ${input.startDate},
         ${input.endDate}, ${input.workingDays}, ${input.reason ?? null})
      RETURNING *
    `
    return toRequestData(rows[0])
  }

  /**
   * Updates an absence request's status and review metadata. The review timestamp
   * is set when a reviewer is provided and cleared otherwise.
   *
   * @param id - identifier of the request to update
   * @param status - new status for the request
   * @param reviewedBy - identifier of the reviewer, or null when not yet reviewed
   * @param reviewNotes - notes recorded by the reviewer, or null
   * @returns the updated absence request
   */
  async updateRequestStatus(
    id: string, status: AbsenceStatus, reviewedBy: string | null, reviewNotes: string | null
  ): Promise<AbsenceRequestData> {
    const rows = await this.sql`
      UPDATE absence_requests
      SET status      = ${status},
          reviewed_by = ${reviewedBy},
          reviewed_at = ${reviewedBy ? this.sql`now()` : null},
          review_notes = ${reviewNotes},
          updated_at  = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toRequestData(rows[0])
  }
}
