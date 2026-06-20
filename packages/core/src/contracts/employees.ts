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

// ── Employee atomic capabilities — each defined once, one responsibility ──────

/** Capability: read a paginated, filtered page of employees. */
export interface IFindAllEmployees {
  /** @returns the matching page of employee summaries */
  findAll(query: EmployeeListQuery): Promise<EmployeeListResult>
}

/** Capability: read a single employee's full detail by identifier. */
export interface IFindEmployeeById {
  /** @returns the employee with the given id, or null if none exists */
  findById(id: string): Promise<EmployeeDetail | null>
}

/** Capability: read a single employee by corporate email (uniqueness checks). */
export interface IFindEmployeeByEmail {
  /** @returns the employee with the given corporate email, or null if none exists */
  findByEmail(email: string): Promise<EmployeeSummary | null>
}

/** Capability: read a single employee by document id (uniqueness checks). */
export interface IFindEmployeeByDocumentId {
  /** @returns the employee with the given document id, or null if none exists */
  findByDocumentId(documentId: string): Promise<EmployeeSummary | null>
}

/** Capability: persist a new employee together with its onboarding steps. */
export interface ICreateEmployee {
  /** Persists a new employee and returns its full detail. */
  create(input: CreateEmployeeInput): Promise<EmployeeDetail>
}

/** Capability: persist changes to an existing employee. */
export interface IUpdateEmployee {
  /** Persists changes to an existing employee and returns its summary. */
  update(id: string, input: UpdateEmployeeInput): Promise<EmployeeSummary>
}

/** Capability: mark an employee as terminated on a given date. */
export interface ITerminateEmployee {
  /** Terminates the employee and returns its updated summary. */
  terminate(id: string, terminationDate: Date): Promise<EmployeeSummary>
}

/** Capability: read the onboarding steps of an employee. */
export interface IFindEmployeeOnboarding {
  /** @returns the onboarding steps for the given employee */
  findOnboarding(employeeId: string): Promise<EmployeeOnboarding[]>
}

/** Capability: update a single onboarding step of an employee. */
export interface IUpdateOnboardingStep {
  /** Updates one onboarding step and returns its new state. */
  updateOnboardingStep(employeeId: string, step: OnboardingStepName, completed: boolean, notes?: string): Promise<EmployeeOnboarding>
}

// ── Department atomic capabilities — each defined once, one responsibility ────

/** Capability: read the full department catalogue. */
export interface IFindAllDepartments {
  /** @returns every department stored */
  findAll(): Promise<Department[]>
}

/** Capability: read a single department by identifier. */
export interface IFindDepartmentById {
  /** @returns the department with the given id, or null if none exists */
  findById(id: string): Promise<Department | null>
}

/** Capability: read a single department by name (uniqueness checks). */
export interface IFindDepartmentByName {
  /** @returns the department with the given name, or null if none exists */
  findByName(name: string): Promise<Department | null>
}

/** Capability: persist a new department. */
export interface ICreateDepartment {
  /** Persists a new department and returns it. */
  create(name: string): Promise<Department>
}

/** Capability: update a department's name. */
export interface IUpdateDepartment {
  /**
   * Persists the new name for the given department and returns the updated entity.
   *
   * @param id - identifier of the department to update
   * @param name - new name for the department
   */
  update(id: string, name: string): Promise<Department>
}

/** Capability: remove a department from the system. */
export interface IDeleteDepartment {
  /**
   * Removes the department with the given identifier.
   *
   * @param id - identifier of the department to delete
   */
  delete(id: string): Promise<void>
}

/** Capability: count employees actively assigned to a department. */
export interface ICountActiveEmployeesInDepartment {
  /**
   * Returns the number of employees with status ACTIVE, REMOTE, or ON_LEAVE
   * currently assigned to the given department.
   *
   * @param departmentId - identifier of the department to check
   */
  countActiveEmployees(departmentId: string): Promise<number>
}

// ── Employee use-case contracts — composed from exactly the needed capabilities

/** Dependencies of the list-employees use case. */
export type ListEmployeesRepository = IFindAllEmployees

/** Dependencies of the get-employee use case. */
export type GetEmployeeRepository = IFindEmployeeById

/** Employee-side dependencies of the create-employee use case. */
export type CreateEmployeeRepository = IFindEmployeeByEmail & IFindEmployeeByDocumentId & ICreateEmployee

/** Employee-side dependencies of the update-employee use case. */
export type UpdateEmployeeRepository = IFindEmployeeById & IUpdateEmployee

/** Employee-side dependencies of the terminate-employee use case. */
export type TerminateEmployeeRepository = IFindEmployeeById & ITerminateEmployee

/** Dependencies of the get-employee-onboarding use case. */
export type GetEmployeeOnboardingRepository = IFindEmployeeById & IFindEmployeeOnboarding

/** Dependencies of the update-onboarding-step use case. */
export type UpdateOnboardingStepRepository = IFindEmployeeById & IUpdateOnboardingStep

// ── Department use-case contracts — composed from the needed capabilities ─────

/** Dependencies of the list-departments use case. */
export type ListDepartmentsRepository = IFindAllDepartments

/** Department-side dependencies of the create-department use case. */
export type CreateDepartmentRepository = IFindDepartmentByName & ICreateDepartment

/** Department-side dependencies of the update-department use case. */
export type UpdateDepartmentRepository = IFindDepartmentById & IFindDepartmentByName & IUpdateDepartment

/** Department-side dependencies of the delete-department use case. */
export type DeleteDepartmentRepository = IFindDepartmentById & ICountActiveEmployeesInDepartment & IDeleteDepartment

// ── Full persistence ports — single adapters implement every capability ───────

/**
 * Persistence port for employees. Implemented by one adapter in the boundary
 * layer, which therefore satisfies every composed use-case contract above.
 */
export interface IEmployeeRepository
  extends IFindAllEmployees, IFindEmployeeById, IFindEmployeeByEmail,
          IFindEmployeeByDocumentId, ICreateEmployee, IUpdateEmployee,
          ITerminateEmployee, IFindEmployeeOnboarding, IUpdateOnboardingStep {}

/**
 * Persistence port for departments. Implemented by one adapter in the boundary
 * layer, which therefore satisfies every composed use-case contract above.
 */
export interface IDepartmentRepository
  extends IFindAllDepartments, IFindDepartmentById,
          IFindDepartmentByName, ICreateDepartment,
          IUpdateDepartment, IDeleteDepartment,
          ICountActiveEmployeesInDepartment {}
