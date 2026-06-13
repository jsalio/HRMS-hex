export type EmployeeStatus = 'ACTIVE' | 'REMOTE' | 'ON_LEAVE' | 'INACTIVE'
export type OnboardingStepName = 'documents' | 'equipment' | 'training' | 'access' | 'complete'

export const ONBOARDING_STEPS: OnboardingStepName[] = [
  'documents', 'equipment', 'training', 'access', 'complete',
]

export interface Department {
  id: string
  name: string
  createdAt: Date
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
  hireDate: Date
}

export interface EmployeeOnboarding {
  id: string
  employeeId: string
  step: OnboardingStepName
  completed: boolean
  completedAt: Date | null
  notes: string | null
  createdAt: Date
}

export interface EmployeeDetail extends EmployeeSummary {
  terminationDate: Date | null
  createdAt: Date
  updatedAt: Date
  onboarding: EmployeeOnboarding[]
}

export interface EmployeeListQuery {
  departmentId?: string
  status?: EmployeeStatus
  search?: string
  page?: number
  limit?: number
}

export interface EmployeeListResult {
  data: EmployeeSummary[]
  total: number
  page: number
}

export interface CreateEmployeeInput {
  fullName: string
  documentId: string
  corporateEmail: string
  departmentId: string
  jobTitle: string
  salary: number
  hireDate: string
}

export interface UpdateEmployeeInput {
  fullName?: string
  departmentId?: string
  jobTitle?: string
  salary?: number
  status?: Exclude<EmployeeStatus, 'INACTIVE'>
}

export interface IEmployeeRepository {
  findAll(query: EmployeeListQuery): Promise<EmployeeListResult>
  findById(id: string): Promise<EmployeeDetail | null>
  findByEmail(email: string): Promise<EmployeeSummary | null>
  findByDocumentId(documentId: string): Promise<EmployeeSummary | null>
  create(input: CreateEmployeeInput): Promise<EmployeeDetail>
  update(id: string, input: UpdateEmployeeInput): Promise<EmployeeSummary>
  terminate(id: string, terminationDate: Date): Promise<EmployeeSummary>
  findOnboarding(employeeId: string): Promise<EmployeeOnboarding[]>
  updateOnboardingStep(employeeId: string, step: OnboardingStepName, completed: boolean, notes?: string): Promise<EmployeeOnboarding>
}

export interface IDepartmentRepository {
  findAll(): Promise<Department[]>
  findById(id: string): Promise<Department | null>
  findByName(name: string): Promise<Department | null>
  create(name: string): Promise<Department>
}
