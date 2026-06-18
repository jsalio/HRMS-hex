import type { EmployeeSummary, EmployeeDetail, EmployeeOnboarding, Department } from '@hrms/core/contracts/employees'

/**
 * API representation of a department, with the creation timestamp serialised
 * to an ISO-8601 string.
 */
export interface DepartmentDTO {
  id: string
  name: string
  createdAt: string
}

/**
 * API representation of an employee in list contexts, exposing the core
 * identifying and employment fields with dates serialised to strings.
 */
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

/**
 * API representation of a single employee with full detail, extending the
 * summary with audit timestamps, termination date and onboarding steps.
 */
export interface EmployeeDetailDTO extends EmployeeSummaryDTO {
  terminationDate: string | null
  createdAt: string
  updatedAt: string
  onboarding: OnboardingDTO[]
}

/**
 * API representation of a single onboarding step for an employee, with the
 * completion timestamp serialised to an ISO-8601 string or null.
 */
export interface OnboardingDTO {
  id: string
  step: string
  completed: boolean
  completedAt: string | null
  notes: string | null
}

/**
 * Converts a domain department into its API DTO, serialising the creation
 * date to an ISO-8601 string.
 *
 * @param dept - domain department to convert
 * @returns the department DTO exposed by the HTTP layer
 */
export function toDeptDTO(dept: Department): DepartmentDTO {
  return {
    id: dept.id,
    name: dept.name,
    createdAt: dept.createdAt.toISOString(),
  }
}

/**
 * Converts an employee summary read model into its API DTO, normalising the
 * hire date to an ISO date (`YYYY-MM-DD`) string.
 *
 * @param e - employee summary read model to convert
 * @returns the employee summary DTO exposed by the HTTP layer
 */
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

/**
 * Converts an employee onboarding step into its API DTO, serialising the
 * completion timestamp to an ISO-8601 string or null when not completed.
 *
 * @param o - onboarding step to convert
 * @returns the onboarding DTO exposed by the HTTP layer
 */
export function toOnboardingDTO(o: EmployeeOnboarding): OnboardingDTO {
  return {
    id: o.id,
    step: o.step,
    completed: o.completed,
    completedAt: o.completedAt?.toISOString() ?? null,
    notes: o.notes,
  }
}

/**
 * Converts a detailed employee read model into its API DTO, reusing the
 * summary fields and serialising termination/audit dates plus mapping each
 * onboarding step.
 *
 * @param e - detailed employee read model to convert
 * @returns the full employee detail DTO exposed by the HTTP layer
 */
export function toEmployeeDetailDTO(e: EmployeeDetail): EmployeeDetailDTO {
  return {
    ...toEmployeeSummaryDTO(e),
    terminationDate: e.terminationDate?.toISOString().split('T')[0] ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    onboarding: e.onboarding.map(toOnboardingDTO),
  }
}
