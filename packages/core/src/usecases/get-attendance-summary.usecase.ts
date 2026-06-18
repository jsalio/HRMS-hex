import type { GetAttendanceSummaryRepository, AttendanceSummary } from '../contracts/attendance'

/**
 * Computes an aggregated attendance summary for an employee over a date range.
 */
export class GetAttendanceSummaryUseCase {
  /**
   * @param attendanceRepo - capability to compute the attendance summary
   */
  constructor(private readonly attendanceRepo: GetAttendanceSummaryRepository) {}

  /**
   * Produces the attendance summary for an employee between two dates.
   *
   * @param employeeId - identifier of the employee to summarise
   * @param from - inclusive start date of the range
   * @param to - inclusive end date of the range
   * @returns aggregated attendance metrics for the employee
   */
  execute(employeeId: string, from: string, to: string): Promise<AttendanceSummary> {
    return this.attendanceRepo.getSummary(employeeId, from, to)
  }
}
