import { describe, it, expect, mock } from 'bun:test'
import { DeleteDepartmentUseCase } from '@hrms/core/usecases/delete-department.usecase'
import { NotFoundError, DepartmentNotEmptyError } from '@hrms/core/domain/errors'
import type { DeleteDepartmentRepository, Department } from '@hrms/core/contracts/employees'

const dept: Department = { id: 'dept-1', name: 'Engineering', createdAt: new Date('2026-01-01') }

function makeRepo(overrides: Partial<DeleteDepartmentRepository> = {}): DeleteDepartmentRepository {
  return {
    findById:             mock(async (id) => id === 'dept-1' ? dept : null),
    countActiveEmployees: mock(async () => 0),
    delete:               mock(async () => {}),
    ...overrides,
  }
}

describe('DeleteDepartmentUseCase', () => {
  it('dado_id_existente_y_departamento_vacio_entonces_elimina', async () => {
    const repo = makeRepo()
    const uc = new DeleteDepartmentUseCase(repo)
    await uc.execute('dept-1')
    expect(repo.delete).toHaveBeenCalledWith('dept-1')
  })

  it('dado_id_inexistente_entonces_lanza_NotFoundError', async () => {
    const repo = makeRepo({ findById: mock(async () => null) })
    const uc = new DeleteDepartmentUseCase(repo)
    await expect(uc.execute('no-existe')).rejects.toThrow(NotFoundError)
  })

  it('dado_departamento_con_empleados_activos_entonces_lanza_DepartmentNotEmptyError', async () => {
    const repo = makeRepo({ countActiveEmployees: mock(async () => 3) })
    const uc = new DeleteDepartmentUseCase(repo)
    await expect(uc.execute('dept-1')).rejects.toThrow(DepartmentNotEmptyError)
  })

  it('delete_no_se_llama_cuando_dept_no_existe', async () => {
    const repo = makeRepo({ findById: mock(async () => null) })
    const uc = new DeleteDepartmentUseCase(repo)
    await expect(uc.execute('no-existe')).rejects.toThrow(NotFoundError)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('delete_no_se_llama_cuando_hay_empleados_activos', async () => {
    const repo = makeRepo({ countActiveEmployees: mock(async () => 5) })
    const uc = new DeleteDepartmentUseCase(repo)
    await expect(uc.execute('dept-1')).rejects.toThrow(DepartmentNotEmptyError)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('countActiveEmployees_no_se_llama_cuando_dept_no_existe', async () => {
    const repo = makeRepo({ findById: mock(async () => null) })
    const uc = new DeleteDepartmentUseCase(repo)
    await expect(uc.execute('no-existe')).rejects.toThrow(NotFoundError)
    expect(repo.countActiveEmployees).not.toHaveBeenCalled()
  })
})
