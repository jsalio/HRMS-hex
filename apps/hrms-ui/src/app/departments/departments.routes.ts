import { Routes } from '@angular/router'

/** Route definitions for the departments management module. */
export const DEPARTMENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./departments-page.component').then(m => m.DepartmentsPageComponent),
  },
]
