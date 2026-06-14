import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  hoursWorked: number | null
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY'
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AttendanceSummary {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  totalHours: number
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient)
  private readonly base = '/api/attendance'

  list(filters: {
    employeeId?: string; status?: string; from?: string; to?: string; page?: number; limit?: number
  } = {}): Promise<{ data: AttendanceRecord[]; total: number }> {
    let params = new HttpParams()
    if (filters.employeeId) params = params.set('employee_id', filters.employeeId)
    if (filters.status)     params = params.set('status', filters.status)
    if (filters.from)       params = params.set('from', filters.from)
    if (filters.to)         params = params.set('to', filters.to)
    if (filters.page)       params = params.set('page', filters.page.toString())
    if (filters.limit)      params = params.set('limit', filters.limit.toString())
    return firstValueFrom(this.http.get<{ data: AttendanceRecord[]; total: number }>(this.base, { params }))
  }

  getSummary(employeeId: string, from: string, to: string): Promise<AttendanceSummary> {
    const params = new HttpParams()
      .set('employee_id', employeeId)
      .set('from', from)
      .set('to', to)
    return firstValueFrom(this.http.get<AttendanceSummary>(`${this.base}/summary`, { params }))
  }

  checkIn(employeeId: string, timestamp: string): Promise<AttendanceRecord> {
    return firstValueFrom(this.http.post<AttendanceRecord>(`${this.base}/check-in`, {
      employee_id: employeeId,
      timestamp,
    }))
  }

  checkOut(employeeId: string, timestamp: string): Promise<AttendanceRecord> {
    return firstValueFrom(this.http.post<AttendanceRecord>(`${this.base}/check-out`, {
      employee_id: employeeId,
      timestamp,
    }))
  }

  edit(id: string, data: {
    checkIn?: string; checkOut?: string; status?: string; notes?: string
  }): Promise<AttendanceRecord> {
    const body: Record<string, string> = {}
    if (data.checkIn)  body['check_in']  = data.checkIn
    if (data.checkOut) body['check_out'] = data.checkOut
    if (data.status)   body['status']    = data.status
    if (data.notes !== undefined) body['notes'] = data.notes
    return firstValueFrom(this.http.patch<AttendanceRecord>(`${this.base}/${id}`, body))
  }
}
