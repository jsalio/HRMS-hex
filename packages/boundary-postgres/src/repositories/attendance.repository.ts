import type { Sql } from 'postgres'
import type {
  IAttendanceRepository, AttendanceRecordData, AttendanceListQuery,
  AttendanceSummary, AttendanceStatus,
} from '@hrms/core/contracts/attendance'

/** Maps a raw attendance_records table row to an AttendanceRecordData. */
function toData(row: any): AttendanceRecordData {
  return {
    id:          row.id,
    employeeId:  row.employee_id,
    date:        typeof row.date === 'string' ? row.date : row.date.toISOString().slice(0, 10),
    checkIn:     row.check_in  ?? null,
    checkOut:    row.check_out ?? null,
    hoursWorked: row.hours_worked != null ? Number(row.hours_worked) : null,
    status:      row.status as AttendanceStatus,
    notes:       row.notes ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

/**
 * Postgres adapter implementing IAttendanceRepository over the `attendance_records` table.
 */
export class AttendanceRepository implements IAttendanceRepository {
  /**
   * @param sql - Postgres client used to execute attendance queries
   */
  constructor(private readonly sql: Sql) {}

  /**
   * Reads a paginated, optionally filtered page of attendance records.
   *
   * @param query - pagination and optional employee, status and date-range filters
   * @returns the matching records for the page and the total count across all pages
   */
  async findAll(query: AttendanceListQuery): Promise<{ data: AttendanceRecordData[]; total: number }> {
    const limit  = Math.min(query.limit ?? 20, 100)
    const offset = ((query.page ?? 1) - 1) * limit

    const rows = await this.sql`
      SELECT * FROM attendance_records
      WHERE TRUE
        ${query.employeeId ? this.sql`AND employee_id = ${query.employeeId}` : this.sql``}
        ${query.status     ? this.sql`AND status = ${query.status}`          : this.sql``}
        ${query.from       ? this.sql`AND date >= ${query.from}`             : this.sql``}
        ${query.to         ? this.sql`AND date <= ${query.to}`               : this.sql``}
      ORDER BY date DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const [{ count }] = await this.sql`
      SELECT COUNT(*)::int as count FROM attendance_records
      WHERE TRUE
        ${query.employeeId ? this.sql`AND employee_id = ${query.employeeId}` : this.sql``}
        ${query.status     ? this.sql`AND status = ${query.status}`          : this.sql``}
        ${query.from       ? this.sql`AND date >= ${query.from}`             : this.sql``}
        ${query.to         ? this.sql`AND date <= ${query.to}`               : this.sql``}
    `

    return { data: rows.map(toData), total: count }
  }

  /**
   * Reads a single attendance record by its identifier.
   *
   * @param id - identifier of the attendance record to read
   * @returns the matching record, or null when none exists
   */
  async findById(id: string): Promise<AttendanceRecordData | null> {
    const rows = await this.sql`SELECT * FROM attendance_records WHERE id = ${id}`
    return rows[0] ? toData(rows[0]) : null
  }

  /**
   * Reads the attendance record for a given employee on a given day.
   *
   * @param employeeId - identifier of the employee
   * @param date - calendar day in ISO `YYYY-MM-DD` form
   * @returns the matching record, or null when none exists
   */
  async findByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecordData | null> {
    const rows = await this.sql`
      SELECT * FROM attendance_records WHERE employee_id = ${employeeId} AND date = ${date}
    `
    return rows[0] ? toData(rows[0]) : null
  }

  /**
   * Persists a new check-in record for an employee, marking them present.
   *
   * @param employeeId - identifier of the employee checking in
   * @param timestamp - moment of the check-in; its date determines the record's day
   * @returns the created attendance record
   */
  async createCheckIn(employeeId: string, timestamp: Date): Promise<AttendanceRecordData> {
    const date = timestamp.toISOString().slice(0, 10)
    const rows = await this.sql`
      INSERT INTO attendance_records (employee_id, date, check_in, status)
      VALUES (${employeeId}, ${date}, ${timestamp}, 'PRESENT')
      RETURNING *
    `
    return toData(rows[0])
  }

  /**
   * Records the check-out time on an existing attendance record.
   *
   * @param id - identifier of the attendance record to close out
   * @param timestamp - moment of the check-out
   * @returns the updated attendance record
   */
  async updateCheckOut(id: string, timestamp: Date): Promise<AttendanceRecordData> {
    const rows = await this.sql`
      UPDATE attendance_records
      SET check_out = ${timestamp}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toData(rows[0])
  }

  /**
   * Applies a partial update to an attendance record, leaving omitted fields unchanged.
   *
   * @param id - identifier of the attendance record to update
   * @param data - subset of check-in, check-out, status and notes fields to overwrite
   * @returns the updated attendance record
   */
  async update(
    id: string,
    data: Partial<Pick<AttendanceRecordData, 'checkIn' | 'checkOut' | 'status' | 'notes'>>
  ): Promise<AttendanceRecordData> {
    const rows = await this.sql`
      UPDATE attendance_records SET
        check_in   = ${data.checkIn   !== undefined ? data.checkIn   : this.sql`check_in`},
        check_out  = ${data.checkOut  !== undefined ? data.checkOut  : this.sql`check_out`},
        status     = ${data.status    !== undefined ? data.status    : this.sql`status`},
        notes      = ${data.notes     !== undefined ? data.notes     : this.sql`notes`},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toData(rows[0])
  }

  /**
   * Aggregates an employee's attendance over a date range into summary counters.
   *
   * @param employeeId - identifier of the employee to summarize
   * @param from - inclusive start day in ISO `YYYY-MM-DD` form
   * @param to - inclusive end day in ISO `YYYY-MM-DD` form
   * @returns totals for days, present, absent and late days plus total hours worked
   */
  async getSummary(employeeId: string, from: string, to: string): Promise<AttendanceSummary> {
    const [row] = await this.sql`
      SELECT
        COUNT(*)::int                                                          AS total_days,
        COUNT(*) FILTER (WHERE status IN ('PRESENT','LATE'))::int             AS present_days,
        COUNT(*) FILTER (WHERE status = 'ABSENT')::int                        AS absent_days,
        COUNT(*) FILTER (WHERE status = 'LATE')::int                          AS late_days,
        COALESCE(SUM(hours_worked), 0)::numeric                               AS total_hours
      FROM attendance_records
      WHERE employee_id = ${employeeId}
        AND date BETWEEN ${from} AND ${to}
    `
    return {
      totalDays:   row.total_days,
      presentDays: row.present_days,
      absentDays:  row.absent_days,
      lateDays:    row.late_days,
      totalHours:  Number(row.total_hours),
    }
  }
}
