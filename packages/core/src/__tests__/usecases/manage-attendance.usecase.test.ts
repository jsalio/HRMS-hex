import { describe, it, expect, mock } from 'bun:test'
import { ManageAttendanceUseCase } from '../../usecases/manage-attendance.usecase'
import { NotFoundError, ValidationError, ConflictError } from '../../domain/errors'
import type { IAttendanceRepository, AttendanceRecordData } from '../../contracts/attendance'
import type { IEmployeeRepository } from '../../contracts/employees'

const now  = new Date('2026-06-14T09:00:00Z')
const later = new Date('2026-06-14T17:00:00Z')

const mockEmployee = {
  id: 'emp-1', fullName: 'Ana García', documentId: 'DNI-001',
  corporateEmail: 'ana@hrms.com', department: { id: 'd-1', name: 'HR' },
  jobTitle: 'Manager', salary: 5000, status: 'ACTIVE' as const,
  hireDate: now, terminationDate: null, createdAt: now, updatedAt: now, onboarding: [],
}

const mockRecord: AttendanceRecordData = {
  id: 'rec-1', employeeId: 'emp-1', date: '2026-06-14',
  checkIn: now, checkOut: null, hoursWorked: null,
  status: 'PRESENT', notes: null, createdAt: now, updatedAt: now,
}

function makeRepos() {
  const attendanceRepo: IAttendanceRepository = {
    findAll:               mock(async () => ({ data: [mockRecord], total: 1 })),
    findById:              mock(async () => mockRecord),
    findByEmployeeAndDate: mock(async () => null),
    createCheckIn:         mock(async () => mockRecord),
    updateCheckOut:        mock(async () => ({ ...mockRecord, checkOut: later, hoursWorked: 8 })),
    update:                mock(async () => mockRecord),
    getSummary:            mock(async () => ({ totalDays: 1, presentDays: 1, absentDays: 0, lateDays: 0, totalHours: 8 })),
  }
  const employeeRepo: IEmployeeRepository = {
    findAll:              mock(async () => ({ data: [], total: 0, page: 1, limit: 20 })),
    findById:             mock(async () => mockEmployee),
    findByEmail:          mock(async () => null),
    findByDocumentId:     mock(async () => null),
    create:               mock(async () => mockEmployee),
    update:               mock(async () => mockEmployee),
    terminate:            mock(async () => mockEmployee),
    findOnboarding:       mock(async () => []),
    updateOnboardingStep: mock(async () => ({ id: 's-1', step: 'documents' as const, completed: true, completedAt: now, notes: null })),
  }
  return { attendanceRepo, employeeRepo }
}

describe('ManageAttendanceUseCase', () => {
  describe('checkIn', () => {
    it('creates_record_for_active_employee_with_no_prior_checkin', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      const result = await uc.checkIn('emp-1', now)
      expect(result.checkIn).toEqual(now)
      expect(attendanceRepo.createCheckIn).toHaveBeenCalled()
    })

    it('throws_NotFoundError_when_employee_not_found', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      ;(employeeRepo.findById as any).mockImplementation(async () => null)
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      await expect(uc.checkIn('ghost', now)).rejects.toThrow(NotFoundError)
    })

    it('throws_ValidationError_when_employee_is_INACTIVE', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      ;(employeeRepo.findById as any).mockImplementation(async () => ({ ...mockEmployee, status: 'INACTIVE' }))
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      await expect(uc.checkIn('emp-1', now)).rejects.toThrow(ValidationError)
    })

    it('throws_ConflictError_when_already_checked_in_today', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      ;(attendanceRepo.findByEmployeeAndDate as any).mockImplementation(async () => mockRecord)
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      await expect(uc.checkIn('emp-1', now)).rejects.toThrow(ConflictError)
    })
  })

  describe('checkOut', () => {
    it('updates_checkout_when_checkin_exists_and_timestamp_is_valid', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      ;(attendanceRepo.findByEmployeeAndDate as any).mockImplementation(async () => mockRecord)
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      const result = await uc.checkOut('emp-1', later)
      expect(result.checkOut).toEqual(later)
      expect(attendanceRepo.updateCheckOut).toHaveBeenCalled()
    })

    it('throws_ValidationError_when_no_checkin_today', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      await expect(uc.checkOut('emp-1', later)).rejects.toThrow(ValidationError)
    })

    it('throws_ValidationError_when_checkout_before_checkin', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      ;(attendanceRepo.findByEmployeeAndDate as any).mockImplementation(async () => mockRecord)
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      const earlier = new Date(now.getTime() - 1000)
      await expect(uc.checkOut('emp-1', earlier)).rejects.toThrow(ValidationError)
    })
  })

  describe('editRecord', () => {
    it('updates_record_when_found', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      const result = await uc.editRecord('rec-1', { notes: 'corrected' })
      expect(attendanceRepo.update).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('throws_NotFoundError_when_record_not_found', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      ;(attendanceRepo.findById as any).mockImplementation(async () => null)
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      await expect(uc.editRecord('ghost', { notes: 'x' })).rejects.toThrow(NotFoundError)
    })

    it('throws_ValidationError_when_checkout_before_checkin_in_edit', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      const earlier = new Date(now.getTime() - 1000)
      await expect(uc.editRecord('rec-1', { checkIn: later, checkOut: earlier })).rejects.toThrow(ValidationError)
    })
  })

  describe('getSummary', () => {
    it('delegates_to_repository', async () => {
      const { attendanceRepo, employeeRepo } = makeRepos()
      const uc = new ManageAttendanceUseCase(attendanceRepo, employeeRepo)
      const summary = await uc.getSummary('emp-1', '2026-06-01', '2026-06-30')
      expect(summary.totalHours).toBe(8)
    })
  })
})
