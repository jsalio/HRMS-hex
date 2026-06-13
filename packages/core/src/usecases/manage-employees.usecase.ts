import type {
  IEmployeeRepository, IDepartmentRepository,
  CreateEmployeeInput, UpdateEmployeeInput,
  EmployeeListQuery, EmployeeListResult, EmployeeDetail,
  EmployeeSummary, EmployeeOnboarding, OnboardingStepName,
} from '../contracts/employees'
import type { IUserRepository, IRefreshTokenRepository, IPasswordService } from '../contracts/auth'
import type { IRoleRepository } from '../contracts/roles'
import { Employee } from '../domain/employee'
import { ConflictError, NotFoundError } from '../domain/errors'

export class ManageEmployeesUseCase {
  constructor(
    private readonly employeeRepo: IEmployeeRepository,
    private readonly deptRepo: IDepartmentRepository,
    private readonly userRepo: IUserRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly passwordSvc: IPasswordService,
  ) {}

  async listEmployees(query: EmployeeListQuery): Promise<EmployeeListResult> {
    return this.employeeRepo.findAll(query)
  }

  async getEmployee(id: string): Promise<EmployeeDetail> {
    const employee = await this.employeeRepo.findById(id)
    if (!employee) throw new NotFoundError(`Employee ${id} not found`)
    return employee
  }

  async createEmployee(input: CreateEmployeeInput): Promise<EmployeeDetail> {
    const dept = await this.deptRepo.findById(input.departmentId)
    if (!dept) throw new NotFoundError(`Department ${input.departmentId} not found`)

    const existingByEmail = await this.employeeRepo.findByEmail(input.corporateEmail)
    if (existingByEmail) throw new ConflictError('corporate_email already in use')

    const existingByDoc = await this.employeeRepo.findByDocumentId(input.documentId)
    if (existingByDoc) throw new ConflictError('document_id already in use')

    const employeeRole = await this.roleRepo.findByName('employee')
    if (!employeeRole) throw new NotFoundError('Role "employee" not found — check seed data')

    // Creates employee + 5 onboarding steps in one transaction (repository responsibility)
    const created = await this.employeeRepo.create(input)

    // Create associated user account (corporate_email as login)
    const tempPasswordHash = await this.passwordSvc.hash(crypto.randomUUID())
    await this.userRepo.create({
      email: created.corporateEmail,
      passwordHash: tempPasswordHash,
      roleId: employeeRole.id,
      employeeId: created.id,
    })

    return created
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput): Promise<EmployeeSummary> {
    const existing = await this.employeeRepo.findById(id)
    if (!existing) throw new NotFoundError(`Employee ${id} not found`)

    new Employee({ id: existing.id, status: existing.status }).assertCanBeModified()

    if (input.departmentId) {
      const dept = await this.deptRepo.findById(input.departmentId)
      if (!dept) throw new NotFoundError(`Department ${input.departmentId} not found`)
    }

    return this.employeeRepo.update(id, input)
  }

  async terminateEmployee(id: string, terminationDate: Date): Promise<EmployeeSummary> {
    const existing = await this.employeeRepo.findById(id)
    if (!existing) throw new NotFoundError(`Employee ${id} not found`)

    new Employee({ id: existing.id, status: existing.status }).assertCanBeTerminated()

    const terminated = await this.employeeRepo.terminate(id, terminationDate)

    // Deactivate associated user account and revoke tokens
    const user = await this.userRepo.findByEmail(existing.corporateEmail)
    if (user) {
      await this.userRepo.deactivate(user.id)
      await this.refreshTokenRepo.revokeAllForUser(user.id)
    }

    return terminated
  }

  async getOnboarding(employeeId: string): Promise<EmployeeOnboarding[]> {
    const existing = await this.employeeRepo.findById(employeeId)
    if (!existing) throw new NotFoundError(`Employee ${employeeId} not found`)
    return this.employeeRepo.findOnboarding(employeeId)
  }

  async updateOnboardingStep(
    employeeId: string,
    step: OnboardingStepName,
    completed: boolean,
    notes?: string,
  ): Promise<EmployeeOnboarding> {
    const existing = await this.employeeRepo.findById(employeeId)
    if (!existing) throw new NotFoundError(`Employee ${employeeId} not found`)
    return this.employeeRepo.updateOnboardingStep(employeeId, step, completed, notes)
  }
}
