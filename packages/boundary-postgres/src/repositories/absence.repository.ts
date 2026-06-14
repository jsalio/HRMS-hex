import type { Sql } from 'postgres'
import type {
  IAbsenceRepository,
  AbsenceTypeData, AbsenceBalanceData, AbsenceRequestData,
  AbsenceRequestQuery, CreateAbsenceRequestInput,
  AbsenceStatus,
} from '@hrms/core/contracts/absences'

function toTypeData(row: any): AbsenceTypeData {
  return {
    id: row.id,
    name: row.name,
    annualAllowanceDays: Number(row.annual_allowance_days),
    requiresApproval: row.requires_approval,
    createdAt: row.created_at,
  }
}

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

export class AbsenceRepository implements IAbsenceRepository {
  constructor(private readonly sql: Sql) {}

  async findAbsenceTypes(): Promise<AbsenceTypeData[]> {
    const rows = await this.sql`SELECT * FROM absence_types ORDER BY name`
    return rows.map(toTypeData)
  }

  async findAbsenceTypeById(id: string): Promise<AbsenceTypeData | null> {
    const rows = await this.sql`SELECT * FROM absence_types WHERE id = ${id}`
    return rows[0] ? toTypeData(rows[0]) : null
  }

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

  async reservePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData> {
    const rows = await this.sql`
      UPDATE absence_balances
      SET pending_days = pending_days + ${days}
      WHERE id = ${balanceId}
      RETURNING *
    `
    return toBalanceData(rows[0])
  }

  async releasePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData> {
    const rows = await this.sql`
      UPDATE absence_balances
      SET pending_days = GREATEST(0, pending_days - ${days})
      WHERE id = ${balanceId}
      RETURNING *
    `
    return toBalanceData(rows[0])
  }

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
