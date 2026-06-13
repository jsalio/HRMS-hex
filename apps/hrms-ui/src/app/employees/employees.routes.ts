import { Routes } from '@angular/router'

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./employees-list-page.component').then(m => m.EmployeesListPageComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./employee-form-page.component').then(m => m.EmployeeFormPageComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./employee-detail-page.component').then(m => m.EmployeeDetailPageComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./employee-form-page.component').then(m => m.EmployeeFormPageComponent),
  },
  {
    path: ':id/documents',
    loadComponent: () => import('../documents/documents-page.component').then(m => m.DocumentsPageComponent),
  },
]
