import type { IEmployeeRepository } from './employees'

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

// ── Atomic capabilities — each defined once, one responsibility ──────────────

/** Capability: read the catalogue of absence types. */
export interface IFindAbsenceTypes {
  /** @returns every absence type defined in the system */
  findAbsenceTypes(): Promise<AbsenceTypeData[]>
}

/** Capability: read a single absence type by identifier. */
export interface IFindAbsenceTypeById {
  /** @returns the absence type with the given id, or null if none exists */
  findAbsenceTypeById(id: string): Promise<AbsenceTypeData | null>
}

/** Capability: read an employee's balances for a given year. */
export interface IFindBalancesByEmployee {
  /** @returns the balances of the employee for the given year */
  findBalancesByEmployee(employeeId: string, year: number): Promise<AbsenceBalanceData[]>
}

/** Capability: read or lazily create an employee's balance for a type and year. */
export interface IFindOrCreateBalance {
  /** @returns the existing or newly created balance */
  findOrCreateBalance(employeeId: string, absenceTypeId: string, year: number, allocatedDays: number): Promise<AbsenceBalanceData>
}

/** Capability: reserve pending days on a balance. */
export interface IReservePendingDays {
  /** Adds days to the pending allocation of a balance and returns it. */
  reservePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData>
}

/** Capability: release previously reserved pending days on a balance. */
export interface IReleasePendingDays {
  /** Removes days from the pending allocation of a balance and returns it. */
  releasePendingDays(balanceId: string, days: number): Promise<AbsenceBalanceData>
}

/** Capability: move pending days to used days on a balance. */
export interface IApproveBalance {
  /** Converts pending days into used days on a balance and returns it. */
  approveBalance(balanceId: string, days: number): Promise<AbsenceBalanceData>
}

/** Capability: query absence requests with pagination. */
export interface IFindRequests {
  /** @returns the matching requests and the total count */
  findRequests(query: AbsenceRequestQuery): Promise<{ data: AbsenceRequestData[]; total: number }>
}

/** Capability: read a single absence request by identifier. */
export interface IFindRequestById {
  /** @returns the request with the given id, or null if none exists */
  findRequestById(id: string): Promise<AbsenceRequestData | null>
}

/** Capability: find requests overlapping a date range for an employee and type. */
export interface IFindOverlapping {
  /** @returns requests of the same type overlapping the given range */
  findOverlapping(employeeId: string, absenceTypeId: string, startDate: string, endDate: string): Promise<AbsenceRequestData[]>
}

/** Capability: persist a new absence request. */
export interface ICreateRequest {
  /** Persists a new absence request and returns it. */
  createRequest(input: CreateAbsenceRequestInput): Promise<AbsenceRequestData>
}

/** Capability: change the status of an absence request. */
export interface IUpdateRequestStatus {
  /** Updates the status (and review metadata) of a request and returns it. */
  updateRequestStatus(id: string, status: AbsenceStatus, reviewedBy: string | null, reviewNotes: string | null): Promise<AbsenceRequestData>
}

// ── Use-case contracts — composed from exactly the needed capabilities ───────

/** Dependencies of the list-absence-types use case. */
export type ListAbsenceTypesRepository = IFindAbsenceTypes

/** Dependencies of the list-absence-balances use case. */
export type ListAbsenceBalancesRepository = IFindBalancesByEmployee

/** Dependencies of the list-absence-requests use case. */
export type ListAbsenceRequestsRepository = IFindRequests

/** Absence-side dependencies of the request-absence use case. */
export type RequestAbsenceRepository =
  IFindAbsenceTypeById & IFindOverlapping & IFindOrCreateBalance & ICreateRequest & IReservePendingDays

/** Employee-side dependencies of the request-absence use case. */
export type RequestAbsenceEmployeeRepository = IEmployeeRepository

/** Absence-side dependencies of the approve-absence use case. */
export type ApproveAbsenceRepository =
  IFindRequestById & IFindOrCreateBalance & IApproveBalance & IUpdateRequestStatus

/** Absence-side dependencies of the reject-absence use case. */
export type RejectAbsenceRepository =
  IFindRequestById & IFindOrCreateBalance & IReleasePendingDays & IUpdateRequestStatus

/** Absence-side dependencies of the cancel-absence use case. */
export type CancelAbsenceRepository =
  IFindRequestById & IFindOrCreateBalance & IReleasePendingDays & IUpdateRequestStatus

// ── Full persistence port — the single adapter implements every capability ───

/**
 * Persistence port for absences. Implemented by one adapter in the boundary
 * layer, which therefore satisfies every composed use-case contract above.
 */
export interface IAbsenceRepository
  extends IFindAbsenceTypes, IFindAbsenceTypeById, IFindBalancesByEmployee,
          IFindOrCreateBalance, IReservePendingDays, IReleasePendingDays,
          IApproveBalance, IFindRequests, IFindRequestById, IFindOverlapping,
          ICreateRequest, IUpdateRequestStatus {}
