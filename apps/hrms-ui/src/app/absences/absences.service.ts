import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

export interface AbsenceType {
  id: string
  name: string
  annualAllowanceDays: number
  requiresApproval: boolean
}

export interface AbsenceBalance {
  id: string
  employeeId: string
  absenceTypeId: string
  year: number
  allocatedDays: number
  usedDays: number
  pendingDays: number
  absenceType?: AbsenceType
}

export interface AbsenceRequest {
  id: string
  employeeId: string
  absenceTypeId: string
  startDate: string
  endDate: string
  workingDays: number
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  createdAt: string
  absenceType?: AbsenceType
}

@Injectable({ providedIn: 'root' })
export class AbsencesService {
  private readonly http = inject(HttpClient)
  private readonly base = '/api'

  getTypes(): Promise<AbsenceType[]> {
    return firstValueFrom(this.http.get<AbsenceType[]>(`${this.base}/absence-types`))
  }

  getBalances(employeeId: string, year?: number): Promise<AbsenceBalance[]> {
    let params = new HttpParams()
    if (year) params = params.set('year', year.toString())
    return firstValueFrom(this.http.get<AbsenceBalance[]>(
      `${this.base}/employees/${employeeId}/absence-balances`, { params }
    ))
  }

  getRequests(filters: {
    employeeId?: string; status?: string; from?: string; to?: string; page?: number
  } = {}): Promise<{ data: AbsenceRequest[]; total: number }> {
    let params = new HttpParams()
    if (filters.employeeId) params = params.set('employee_id', filters.employeeId)
    if (filters.status)     params = params.set('status', filters.status)
    if (filters.from)       params = params.set('from', filters.from)
    if (filters.to)         params = params.set('to', filters.to)
    if (filters.page)       params = params.set('page', filters.page.toString())
    return firstValueFrom(this.http.get<{ data: AbsenceRequest[]; total: number }>(
      `${this.base}/absence-requests`, { params }
    ))
  }

  createRequest(body: {
    employeeId: string; absenceTypeId: string; startDate: string; endDate: string; reason?: string
  }): Promise<AbsenceRequest> {
    return firstValueFrom(this.http.post<AbsenceRequest>(`${this.base}/absence-requests`, body))
  }

  approve(id: string, notes?: string): Promise<AbsenceRequest> {
    return firstValueFrom(this.http.patch<AbsenceRequest>(
      `${this.base}/absence-requests/${id}/approve`, { notes }
    ))
  }

  reject(id: string, notes: string): Promise<AbsenceRequest> {
    return firstValueFrom(this.http.patch<AbsenceRequest>(
      `${this.base}/absence-requests/${id}/reject`, { notes }
    ))
  }

  cancel(id: string): Promise<AbsenceRequest> {
    return firstValueFrom(this.http.patch<AbsenceRequest>(
      `${this.base}/absence-requests/${id}/cancel`, {}
    ))
  }
}
