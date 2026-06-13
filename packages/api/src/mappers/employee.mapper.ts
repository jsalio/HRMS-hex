import type { EmployeeSummary, EmployeeDetail, EmployeeOnboarding, Department } from '@hrms/core/contracts/employees'

export interface DepartmentDTO {
  id: string
  name: string
  createdAt: string
}

export interface EmployeeSummaryDTO {
  id: string
  fullName: string
  documentId: string
  corporateEmail: string
  department: { id: string; name: string }
  jobTitle: string
  salary: number
  status: string
  hireDate: string
}

export interface EmployeeDetailDTO extends EmployeeSummaryDTO {
  terminationDate: string | null
  createdAt: string
  updatedAt: string
  onboarding: OnboardingDTO[]
}

export interface OnboardingDTO {
  id: string
  step: string
  completed: boolean
  completedAt: string | null
  notes: string | null
}

export function toDeptDTO(dept: Department): DepartmentDTO {
  return {
    id: dept.id,
    name: dept.name,
    createdAt: dept.createdAt.toISOString(),
  }
}

export function toEmployeeSummaryDTO(e: EmployeeSummary): EmployeeSummaryDTO {
  return {
    id: e.id,
    fullName: e.fullName,
    documentId: e.documentId,
    corporateEmail: e.corporateEmail,
    department: e.department,
    jobTitle: e.jobTitle,
    salary: e.salary,
    status: e.status,
    hireDate: e.hireDate instanceof Date ? e.hireDate.toISOString().split('T')[0] : String(e.hireDate),
  }
}

export function toOnboardingDTO(o: EmployeeOnboarding): OnboardingDTO {
  return {
    id: o.id,
    step: o.step,
    completed: o.completed,
    completedAt: o.completedAt?.toISOString() ?? null,
    notes: o.notes,
  }
}

export function toEmployeeDetailDTO(e: EmployeeDetail): EmployeeDetailDTO {
  return {
    ...toEmployeeSummaryDTO(e),
    terminationDate: e.terminationDate?.toISOString().split('T')[0] ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    onboarding: e.onboarding.map(toOnboardingDTO),
  }
}
