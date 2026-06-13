import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { ManageEmployeesUseCase } from '../../usecases/manage-employees.usecase'
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors'
import type { IEmployeeRepository, IDepartmentRepository, EmployeeDetail } from '../../contracts/employees'
import type { IUserRepository, IRefreshTokenRepository, IPasswordService } from '../../contracts/auth'
import type { IRoleRepository } from '../../contracts/roles'

const now = new Date('2026-01-01T00:00:00Z')
const hireDate = new Date('2025-01-15T00:00:00Z')

const mockDept = { id: 'dept-1', name: 'Engineering', createdAt: now }

const mockEmployeeDetail: EmployeeDetail = {
  id: 'emp-1',
  fullName: 'Ana García',
  documentId: 'DNI-001',
  corporateEmail: 'ana@hrms.com',
  department: { id: 'dept-1', name: 'Engineering' },
  jobTitle: 'Developer',
  salary: 5000,
  status: 'ACTIVE',
  hireDate,
  terminationDate: null,
  createdAt: now,
  updatedAt: now,
  onboarding: [
    { id: 'ob-1', employeeId: 'emp-1', step: 'documents',  completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-2', employeeId: 'emp-1', step: 'equipment',  completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-3', employeeId: 'emp-1', step: 'training',   completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-4', employeeId: 'emp-1', step: 'access',     completed: false, completedAt: null, notes: null, createdAt: now },
    { id: 'ob-5', employeeId: 'emp-1', step: 'complete',   completed: false, completedAt: null, notes: null, createdAt: now },
  ],
}

function makeRepos() {
  const employeeRepo: IEmployeeRepository = {
    findAll:              mock(async () => ({ data: [], total: 0, page: 1 })),
    findById:             mock(async () => mockEmployeeDetail),
    findByEmail:          mock(async () => null),
    findByDocumentId:     mock(async () => null),
    create:               mock(async () => mockEmployeeDetail),
    update:               mock(async () => ({ ...mockEmployeeDetail, onboarding: undefined } as any)),
    terminate:            mock(async () => ({ ...mockEmployeeDetail, status: 'INACTIVE' as const, onboarding: undefined } as any)),
    findOnboarding:       mock(async () => mockEmployeeDetail.onboarding),
    updateOnboardingStep: mock(async () => mockEmployeeDetail.onboarding[0]),
  }

  const deptRepo: IDepartmentRepository = {
    findAll:    mock(async () => [mockDept]),
    findById:   mock(async () => mockDept),
    findByName: mock(async () => null),
    create:     mock(async () => mockDept),
  }

  const userRepo: IUserRepository = {
    findByEmail:     mock(async () => null),
    findById:        mock(async () => null),
    create:          mock(async () => ({ id: 'user-1', email: 'ana@hrms.com', passwordHash: 'x', isActive: true, roleId: 'role-1', employeeId: 'emp-1', lastLoginAt: null })),
    deactivate:      mock(async () => ({} as any)),
    setEmployee:     mock(async () => {}),
    updateLastLogin: mock(async () => {}),
  }

  const roleRepo: IRoleRepository = {
    findAll:    mock(async () => []),
    findById:   mock(async () => null),
    findByName: mock(async () => ({ id: 'role-emp', name: 'employee', isSystem: true, permissions: [], toAuthPermissions: () => [] } as any)),
    create:     mock(async () => ({} as any)),
    update:     mock(async () => ({} as any)),
    delete:     mock(async () => {}),
  }

  const refreshTokenRepo: IRefreshTokenRepository = {
    create:           mock(async () => {}),
    findByHash:       mock(async () => null),
    revoke:           mock(async () => {}),
    revokeAllForUser: mock(async () => {}),
  }

  const passwordSvc: IPasswordService = {
    hash:   mock(async (p: string) => `hashed:${p}`),
    verify: mock(async () => true),
  }

  return { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc }
}

describe('ManageEmployeesUseCase', () => {
  describe('createEmployee', () => {
    it('creates employee and returns detail with 5 onboarding steps', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      const result = await uc.createEmployee({
        fullName: 'Ana García', documentId: 'DNI-001', corporateEmail: 'ana@hrms.com',
        departmentId: 'dept-1', jobTitle: 'Developer', salary: 5000, hireDate: '2025-01-15',
      })

      expect(result.onboarding).toHaveLength(5)
      expect(result.id).toBe('emp-1')
    })

    it('also creates an associated user account', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await uc.createEmployee({
        fullName: 'Ana García', documentId: 'DNI-001', corporateEmail: 'ana@hrms.com',
        departmentId: 'dept-1', jobTitle: 'Developer', salary: 5000, hireDate: '2025-01-15',
      })

      expect(userRepo.create).toHaveBeenCalledTimes(1)
    })

    it('throws NotFoundError when department does not exist', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      ;(deptRepo.findById as ReturnType<typeof mock>).mockResolvedValue(null)
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await expect(
        uc.createEmployee({
          fullName: 'Ana', documentId: 'DNI-001', corporateEmail: 'ana@hrms.com',
          departmentId: 'nonexistent', jobTitle: 'Dev', salary: 5000, hireDate: '2025-01-15',
        })
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws ConflictError when corporate email already in use', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      ;(employeeRepo.findByEmail as ReturnType<typeof mock>).mockResolvedValue(mockEmployeeDetail)
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await expect(
        uc.createEmployee({
          fullName: 'Ana', documentId: 'DNI-001', corporateEmail: 'ana@hrms.com',
          departmentId: 'dept-1', jobTitle: 'Dev', salary: 5000, hireDate: '2025-01-15',
        })
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('throws ConflictError when document_id already in use', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      ;(employeeRepo.findByDocumentId as ReturnType<typeof mock>).mockResolvedValue(mockEmployeeDetail)
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await expect(
        uc.createEmployee({
          fullName: 'Ana', documentId: 'DNI-001', corporateEmail: 'new@hrms.com',
          departmentId: 'dept-1', jobTitle: 'Dev', salary: 5000, hireDate: '2025-01-15',
        })
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  describe('updateEmployee', () => {
    it('throws ValidationError when employee is INACTIVE', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      ;(employeeRepo.findById as ReturnType<typeof mock>).mockResolvedValue({ ...mockEmployeeDetail, status: 'INACTIVE' })
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await expect(
        uc.updateEmployee('emp-1', { jobTitle: 'Senior Dev' })
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('terminateEmployee', () => {
    it('returns employee with INACTIVE status', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await uc.terminateEmployee('emp-1', new Date('2026-06-01'))

      expect(employeeRepo.terminate).toHaveBeenCalledWith('emp-1', new Date('2026-06-01'))
    })

    it('deactivates associated user account', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      ;(userRepo.findByEmail as ReturnType<typeof mock>).mockResolvedValue({
        id: 'user-1', email: 'ana@hrms.com', passwordHash: 'x',
        isActive: true, roleId: 'role-1', employeeId: 'emp-1', lastLoginAt: null,
      })
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await uc.terminateEmployee('emp-1', new Date('2026-06-01'))

      expect(userRepo.deactivate).toHaveBeenCalledWith('user-1')
      expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1')
    })

    it('throws ValidationError when employee is already INACTIVE', async () => {
      const { employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc } = makeRepos()
      ;(employeeRepo.findById as ReturnType<typeof mock>).mockResolvedValue({ ...mockEmployeeDetail, status: 'INACTIVE' })
      const uc = new ManageEmployeesUseCase(employeeRepo, deptRepo, userRepo, roleRepo, refreshTokenRepo, passwordSvc)

      await expect(
        uc.terminateEmployee('emp-1', new Date('2026-06-01'))
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})
