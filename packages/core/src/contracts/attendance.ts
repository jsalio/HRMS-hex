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

// ── Atomic capabilities — each defined once, one responsibility ──────────────

/** Capability: read a paginated list of attendance records matching a query. */
export interface IFindAllAttendance {
  /** @returns the matching records plus the total count, in repository order */
  findAll(query: AttendanceListQuery): Promise<{ data: AttendanceRecordData[]; total: number }>
}

/** Capability: read a single attendance record by identifier. */
export interface IFindAttendanceById {
  /** @returns the record with the given id, or null if none exists */
  findById(id: string): Promise<AttendanceRecordData | null>
}

/** Capability: read an employee's attendance record for a specific date. */
export interface IFindAttendanceByEmployeeAndDate {
  /** @returns the record for the employee on the date, or null if none exists */
  findByEmployeeAndDate(employeeId: string, date: string): Promise<AttendanceRecordData | null>
}

/** Capability: persist a new check-in for an employee. */
export interface ICreateCheckIn {
  /** Persists a new check-in record and returns it. */
  createCheckIn(employeeId: string, timestamp: Date): Promise<AttendanceRecordData>
}

/** Capability: record the check-out time on an existing record. */
export interface IUpdateCheckOut {
  /** Persists the check-out time on the record and returns the updated entity. */
  updateCheckOut(id: string, timestamp: Date): Promise<AttendanceRecordData>
}

/** Capability: persist arbitrary corrections to an existing attendance record. */
export interface IUpdateAttendance {
  /** Persists changes to an attendance record and returns the updated entity. */
  update(id: string, data: Partial<Pick<AttendanceRecordData, 'checkIn' | 'checkOut' | 'status' | 'notes'>>): Promise<AttendanceRecordData>
}

/** Capability: compute an attendance summary for an employee over a date range. */
export interface IGetAttendanceSummary {
  /** @returns aggregated attendance metrics for the employee between two dates */
  getSummary(employeeId: string, from: string, to: string): Promise<AttendanceSummary>
}

// ── Use-case contracts — composed from exactly the needed capabilities ───────

/** Dependencies of the list-attendance-records use case. */
export type ListAttendanceRecordsRepository = IFindAllAttendance

/** Dependencies of the get-attendance-summary use case. */
export type GetAttendanceSummaryRepository = IGetAttendanceSummary

/** Dependencies of the check-in use case. */
export type CheckInRepository = IFindAttendanceByEmployeeAndDate & ICreateCheckIn

/** Dependencies of the check-out use case. */
export type CheckOutRepository = IFindAttendanceByEmployeeAndDate & IUpdateCheckOut

/** Dependencies of the edit-attendance-record use case. */
export type EditAttendanceRecordRepository = IFindAttendanceById & IUpdateAttendance

// ── Full persistence port — the single adapter implements every capability ───

/**
 * Persistence port for attendance records. Implemented by one adapter in the
 * boundary layer, which therefore satisfies every composed use-case contract above.
 */
export interface IAttendanceRepository
  extends IFindAllAttendance, IFindAttendanceById, IFindAttendanceByEmployeeAndDate,
          ICreateCheckIn, IUpdateCheckOut, IUpdateAttendance, IGetAttendanceSummary {}
