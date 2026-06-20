import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

export interface Department {
  id: string
  name: string
  createdAt: string
}

/**
 * HTTP client for the departments resource.
 * All methods map 1:1 to a REST endpoint on /api/departments.
 */
@Injectable({ providedIn: 'root' })
export class DepartmentsService {
  private readonly http = inject(HttpClient)

  /**
   * Fetches the full department catalogue, ordered alphabetically.
   *
   * @returns the list of all departments
   */
  list(): Promise<Department[]> {
    return firstValueFrom(this.http.get<Department[]>('/api/departments'))
  }

  /**
   * Creates a new department with the given name.
   *
   * @param name - name of the new department
   * @returns the created department
   */
  create(name: string): Promise<Department> {
    return firstValueFrom(this.http.post<Department>('/api/departments', { name }))
  }

  /**
   * Updates the name of an existing department.
   *
   * @param id - identifier of the department to update
   * @param name - new name for the department
   * @returns the updated department
   */
  update(id: string, name: string): Promise<Department> {
    return firstValueFrom(this.http.put<Department>(`/api/departments/${id}`, { name }))
  }

  /**
   * Deletes a department by identifier.
   * Fails with 409 if the department has active employees assigned.
   *
   * @param id - identifier of the department to delete
   */
  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/departments/${id}`))
  }
}
