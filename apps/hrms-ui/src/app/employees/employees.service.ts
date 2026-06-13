import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

export type EmployeeStatus = 'ACTIVE' | 'REMOTE' | 'ON_LEAVE' | 'INACTIVE'
export type OnboardingStep = 'documents' | 'equipment' | 'training' | 'access' | 'complete'

export interface Department {
  id: string
  name: string
  createdAt: string
}

export interface EmployeeSummary {
  id: string
  fullName: string
  documentId: string
  corporateEmail: string
  department: { id: string; name: string }
  jobTitle: string
  salary: number
  status: EmployeeStatus
  hireDate: string
}

export interface OnboardingDTO {
  id: string
  step: OnboardingStep
  completed: boolean
  completedAt: string | null
  notes: string | null
}

export interface EmployeeDetail extends EmployeeSummary {
  terminationDate: string | null
  createdAt: string
  updatedAt: string
  onboarding: OnboardingDTO[]
}

export interface EmployeeListResult {
  data: EmployeeSummary[]
  total: number
  page: number
}

export interface EmployeeListQuery {
  departmentId?: string
  status?: EmployeeStatus
  search?: string
  page?: number
  limit?: number
}

export interface CreateEmployeePayload {
  fullName: string
  documentId: string
  corporateEmail: string
  departmentId: string
  jobTitle: string
  salary: number
  hireDate: string
}

export interface UpdateEmployeePayload {
  fullName?: string
  departmentId?: string
  jobTitle?: string
  salary?: number
  status?: Exclude<EmployeeStatus, 'INACTIVE'>
}

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly http = inject(HttpClient)

  async getDepartments(): Promise<Department[]> {
    return firstValueFrom(this.http.get<Department[]>('/api/departments'))
  }

  async listEmployees(query: EmployeeListQuery = {}): Promise<EmployeeListResult> {
    let params = new HttpParams()
    if (query.departmentId) params = params.set('department_id', query.departmentId)
    if (query.status)       params = params.set('status', query.status)
    if (query.search)       params = params.set('search', query.search)
    if (query.page)         params = params.set('page', query.page)
    if (query.limit)        params = params.set('limit', query.limit)
    return firstValueFrom(this.http.get<EmployeeListResult>('/api/employees', { params }))
  }

  async getEmployee(id: string): Promise<EmployeeDetail> {
    return firstValueFrom(this.http.get<EmployeeDetail>(`/api/employees/${id}`))
  }

  async createEmployee(payload: CreateEmployeePayload): Promise<EmployeeDetail> {
    return firstValueFrom(this.http.post<EmployeeDetail>('/api/employees', payload))
  }

  async updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<EmployeeSummary> {
    return firstValueFrom(this.http.patch<EmployeeSummary>(`/api/employees/${id}`, payload))
  }

  async terminateEmployee(id: string, terminationDate: string): Promise<EmployeeSummary> {
    return firstValueFrom(this.http.post<EmployeeSummary>(`/api/employees/${id}/terminate`, { terminationDate }))
  }

  async getOnboarding(employeeId: string): Promise<OnboardingDTO[]> {
    return firstValueFrom(this.http.get<OnboardingDTO[]>(`/api/employees/${employeeId}/onboarding`))
  }

  async updateOnboardingStep(employeeId: string, step: OnboardingStep, completed: boolean, notes?: string): Promise<OnboardingDTO> {
    return firstValueFrom(
      this.http.patch<OnboardingDTO>(`/api/employees/${employeeId}/onboarding/${step}`, { completed, notes })
    )
  }
}
