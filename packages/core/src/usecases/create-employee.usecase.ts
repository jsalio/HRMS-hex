import type { CreateEmployeeRepository, CreateEmployeeInput, EmployeeDetail } from '../contracts/employees'
import type { IFindDepartmentById } from '../contracts/employees'
import type { IUserRepository, IPasswordService } from '../contracts/auth'
import type { IFindRoleByName } from '../contracts/roles'
import { ConflictError, NotFoundError } from '../domain/errors'

/**
 * Creates a new employee and provisions its associated user account.
 */
export class CreateEmployeeUseCase {
  /**
   * @param employeeRepo - capabilities to check uniqueness and persist the employee
   * @param deptRepo - capability to verify the target department exists
   * @param userRepo - capability to create the associated user account
   * @param roleRepo - capability to resolve the default "employee" role
   * @param passwordSvc - service to hash the account's temporary password
   */
  constructor(
    private readonly employeeRepo: CreateEmployeeRepository,
    private readonly deptRepo: IFindDepartmentById,
    private readonly userRepo: IUserRepository,
    private readonly roleRepo: IFindRoleByName,
    private readonly passwordSvc: IPasswordService,
  ) {}

  /**
   * Creates an employee after validating its department and uniqueness, then
   * provisions a user account using the corporate email as login.
   *
   * @param input - the new employee's attributes
   * @returns the persisted employee detail, including onboarding steps
   * @throws {NotFoundError} when the department or the "employee" role is missing
   * @throws {ConflictError} when the corporate email or document id is already in use
   */
  async execute(input: CreateEmployeeInput): Promise<EmployeeDetail> {
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
}
