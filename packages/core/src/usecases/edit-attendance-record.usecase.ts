import type { EditAttendanceRecordRepository, AttendanceRecordData } from '../contracts/attendance'
import { NotFoundError, ValidationError } from '../domain/errors'

/**
 * Applies manual corrections to an existing attendance record.
 */
export class EditAttendanceRecordUseCase {
  /**
   * @param attendanceRepo - capabilities to load and persist the attendance record
   */
  constructor(private readonly attendanceRepo: EditAttendanceRecordRepository) {}

  /**
   * Updates an attendance record after validating check-in/check-out ordering.
   *
   * @param id - identifier of the attendance record to edit
   * @param data - optional check-in, check-out, status and notes corrections
   * @returns the updated attendance record
   * @throws {NotFoundError} when no attendance record exists with the given id
   * @throws {ValidationError} when the resulting check-out is not after the check-in
   */
  async execute(id: string, data: Partial<Pick<AttendanceRecordData, 'checkIn' | 'checkOut' | 'status' | 'notes'>>): Promise<AttendanceRecordData> {
    const record = await this.attendanceRepo.findById(id)
    if (!record) throw new NotFoundError(`Attendance record ${id} not found`)

    if (data.checkIn && data.checkOut && data.checkOut <= data.checkIn) {
      throw new ValidationError('check_out must be after check_in')
    }
    if (data.checkOut && !data.checkIn && record.checkIn && data.checkOut <= record.checkIn) {
      throw new ValidationError('check_out must be after check_in')
    }

    return this.attendanceRepo.update(id, data)
  }
}
