import { describe, it, expect, mock } from 'bun:test'
import { UpdateDepartmentUseCase } from '@hrms/core/usecases/update-department.usecase'
import { NotFoundError, ConflictError, ValidationError } from '@hrms/core/domain/errors'
import type { UpdateDepartmentRepository, Department } from '@hrms/core/contracts/employees'

const dept: Department = { id: 'dept-1', name: 'Engineering', createdAt: new Date('2026-01-01') }
const other: Department = { id: 'dept-2', name: 'Finance', createdAt: new Date('2026-01-01') }

function makeRepo(overrides: Partial<UpdateDepartmentRepository> = {}): UpdateDepartmentRepository {
  return {
    findById:   mock(async (id) => id === 'dept-1' ? dept : null),
    findByName: mock(async (name) => name === 'Finance' ? other : null),
    update:     mock(async (id, name) => ({ ...dept, id, name })),
    ...overrides,
  }
}

describe('UpdateDepartmentUseCase', () => {
  it('dado_id_existente_cuando_nombre_nuevo_entonces_actualiza', async () => {
    const repo = makeRepo()
    const uc = new UpdateDepartmentUseCase(repo)
    const result = await uc.execute('dept-1', 'Product')
    expect(result.name).toBe('Product')
    expect(repo.update).toHaveBeenCalledWith('dept-1', 'Product')
  })

  it('dado_id_inexistente_entonces_lanza_NotFoundError', async () => {
    const repo = makeRepo({ findById: mock(async () => null) })
    const uc = new UpdateDepartmentUseCase(repo)
    await expect(uc.execute('no-existe', 'X')).rejects.toThrow(NotFoundError)
  })

  it('dado_nombre_igual_al_actual_entonces_actualiza_sin_verificar_unicidad', async () => {
    const repo = makeRepo()
    const uc = new UpdateDepartmentUseCase(repo)
    const result = await uc.execute('dept-1', 'Engineering')
    expect(result.name).toBe('Engineering')
    expect(repo.findByName).not.toHaveBeenCalled()
  })

  it('dado_nombre_tomado_por_otro_dept_entonces_lanza_ConflictError', async () => {
    const repo = makeRepo()
    const uc = new UpdateDepartmentUseCase(repo)
    await expect(uc.execute('dept-1', 'Finance')).rejects.toThrow(ConflictError)
  })

  it('dado_nombre_con_espacios_entonces_trim_antes_de_persistir', async () => {
    const repo = makeRepo()
    const uc = new UpdateDepartmentUseCase(repo)
    await uc.execute('dept-1', '  Product  ')
    expect(repo.update).toHaveBeenCalledWith('dept-1', 'Product')
  })

  it('dado_nombre_vacio_entonces_lanza_ValidationError', async () => {
    const repo = makeRepo()
    const uc = new UpdateDepartmentUseCase(repo)
    await expect(uc.execute('dept-1', '   ')).rejects.toThrow(ValidationError)
  })
})
