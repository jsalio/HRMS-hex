import type { Sql } from 'postgres'
import type {
  IAttendanceRepository, AttendanceRecordData, AttendanceListQuery,
  AttendanceSummary, AttendanceStatus,
} from '@hrms/core/contracts/attendance'

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

export class AttendanceRepository implements IAttendanceRepository {
  constructor(private readonly sql: Sql) {}

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

  async findById(id: string): Promise<AttendanceRecordData | null> {
    const rows = await this.sql`SELECT * FROM attendance_records WHERE id = ${id}`
    return rows[0] ? toData(rows[0]) : null
  }

  async findByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecordData | null> {
    const rows = await this.sql`
      SELECT * FROM attendance_records WHERE employee_id = ${employeeId} AND date = ${date}
    `
    return rows[0] ? toData(rows[0]) : null
  }

  async createCheckIn(employeeId: string, timestamp: Date): Promise<AttendanceRecordData> {
    const date = timestamp.toISOString().slice(0, 10)
    const rows = await this.sql`
      INSERT INTO attendance_records (employee_id, date, check_in, status)
      VALUES (${employeeId}, ${date}, ${timestamp}, 'PRESENT')
      RETURNING *
    `
    return toData(rows[0])
  }

  async updateCheckOut(id: string, timestamp: Date): Promise<AttendanceRecordData> {
    const rows = await this.sql`
      UPDATE attendance_records
      SET check_out = ${timestamp}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `
    return toData(rows[0])
  }

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
