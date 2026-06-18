import type { ListAttendanceRecordsRepository, AttendanceListQuery, AttendanceRecordData } from '../contracts/attendance'

/**
 * Retrieves a paginated list of attendance records matching a query.
 */
export class ListAttendanceRecordsUseCase {
  /**
   * @param attendanceRepo - capability to read attendance records
   */
  constructor(private readonly attendanceRepo: ListAttendanceRecordsRepository) {}

  /**
   * Lists attendance records matching the supplied filters.
   *
   * @param query - employee, date range, status and pagination filters
   * @returns the matching records plus the total count
   */
  execute(query: AttendanceListQuery): Promise<{ data: AttendanceRecordData[]; total: number }> {
    return this.attendanceRepo.findAll(query)
  }
}
