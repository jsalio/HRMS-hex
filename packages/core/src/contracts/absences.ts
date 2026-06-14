export type AbsenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface AbsenceTypeData {
  id: string
  name: string
  annualAllowanceDays: number
  requiresApproval: boolean
  createdAt: Date
}

export interface AbsenceBalanceData {
  id: string
  employeeId: string
  absenceTypeId: string
  year: number
  allocatedDays: number
  usedDays: number
  pendingDays: number
  absenceType?: AbsenceTypeData
}

export interface AbsenceRequestData {
  id: string
  employeeId: string
  absenceTypeId: string
  startDate: string
  endDate: string
  workingDays: number
  reason: string | null
  status: AbsenceStatus
  reviewedBy: string | null
  reviewedAt: Date | null
  reviewNotes: string | null
  createdAt: Date
  updatedAt: Date
  absenceType?: AbsenceTypeData
}

export interface IAbsenceRepository {
  findAbsenceTypes(): Promise<AbsenceTypeData[]>
  findAbsenceTypeById(id: string): Promise<AbsenceTypeData | null>
  findBalancesByEmployee(employeeId: string, year: number): Promise<AbsenceBalanceData[]>
  findOrCreateBalance(employeeId: string, absenceTypeId: string, year: number, allocatedDays: number): Promise<AbsenceBalanceData>
  reservePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData>
  releasePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData>
  approveBalance(balanceId: string, days: number): Promise<AbsenceBalanceData>
  findRequests(query: AbsenceRequestQuery): Promise<{ data: AbsenceRequestData[]; total: number }>
  findRequestById(id: string): Promise<AbsenceRequestData | null>
  findOverlapping(employeeId: string, absenceTypeId: string, startDate: string, endDate: string): Promise<AbsenceRequestData[]>
  createRequest(input: CreateAbsenceRequestInput): Promise<AbsenceRequestData>
  updateRequestStatus(id: string, status: AbsenceStatus, reviewedBy: string | null, reviewNotes: string | null): Promise<AbsenceRequestData>
}

export interface AbsenceRequestQuery {
  employeeId?: string
  status?: AbsenceStatus
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface CreateAbsenceRequestInput {
  employeeId: string
  absenceTypeId: string
  startDate: string
  endDate: string
  workingDays: number
  reason?: string
}
