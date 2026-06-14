export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY'

export interface AttendanceRecordData {
  id: string
  employeeId: string
  date: string
  checkIn: Date | null
  checkOut: Date | null
  hoursWorked: number | null
  status: AttendanceStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AttendanceSummary {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  totalHours: number
}

export interface AttendanceListQuery {
  employeeId?: string
  from?: string
  to?: string
  status?: AttendanceStatus
  page?: number
  limit?: number
}

export interface IAttendanceRepository {
  findAll(query: AttendanceListQuery): Promise<{ data: AttendanceRecordData[]; total: number }>
  findById(id: string): Promise<AttendanceRecordData | null>
  findByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecordData | null>
  createCheckIn(employeeId: string, timestamp: Date): Promise<AttendanceRecordData>
  updateCheckOut(id: string, timestamp: Date): Promise<AttendanceRecordData>
  update(id: string, data: Partial<Pick<AttendanceRecordData, 'checkIn' | 'checkOut' | 'status' | 'notes'>>): Promise<AttendanceRecordData>
  getSummary(employeeId: string, from: string, to: string): Promise<AttendanceSummary>
}
