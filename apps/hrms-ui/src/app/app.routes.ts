import { Routes } from '@angular/router'
import { authGuard } from './core/guards/auth.guard'
import { permissionGuard } from './core/guards/permission.guard'
import { AppModule } from './core/models/auth.models'

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login-page.component').then(m => m.LoginPageComponent),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./shell/forbidden/forbidden-page.component').then(m => m.ForbiddenPageComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./shell/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent),
      },
      {
        path: 'settings/roles',
        canActivate: [permissionGuard(AppModule.SETTINGS, 'canView')],
        loadComponent: () => import('./roles/roles-page.component').then(m => m.RolesPageComponent),
      },
      {
        path: 'employees',
        canActivate: [permissionGuard(AppModule.EMPLOYEES, 'canView')],
        loadChildren: () => import('./employees/employees.routes').then(m => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'absences',
        canActivate: [permissionGuard(AppModule.ABSENCES, 'canView')],
        loadComponent: () => import('./absences/my-absences-page.component').then(m => m.MyAbsencesPageComponent),
      },
      {
        path: 'absences/approvals',
        canActivate: [permissionGuard(AppModule.ABSENCES, 'canEdit')],
        loadComponent: () => import('./absences/approvals-page.component').then(m => m.ApprovalsPageComponent),
      },
      {
        path: 'attendance',
        canActivate: [permissionGuard(AppModule.ATTENDANCE, 'canView')],
        loadComponent: () => import('./attendance/attendance-page.component').then(m => m.AttendancePageComponent),
      },
      {
        path: 'documents',
        canActivate: [permissionGuard(AppModule.DOCUMENTS, 'canView')],
        loadComponent: () => import('./documents/documents-page.component').then(m => m.DocumentsPageComponent),
      },
      {
        path: 'benefits',
        canActivate: [permissionGuard(AppModule.BENEFITS, 'canEdit')],
        loadComponent: () => import('./benefits/benefits-admin-page.component').then(m => m.BenefitsAdminPageComponent),
      },
      {
        path: 'benefits/my',
        canActivate: [permissionGuard(AppModule.BENEFITS, 'canView')],
        loadComponent: () => import('./benefits/my-benefits-page.component').then(m => m.MyBenefitsPageComponent),
      },
      {
        path: 'recruitment',
        canActivate: [permissionGuard(AppModule.RECRUITMENT, 'canView')],
        loadChildren: () => import('./recruitment/recruitment.routes').then(m => m.RECRUITMENT_ROUTES),
      },
      {
        path: 'departments',
        canActivate: [permissionGuard(AppModule.EMPLOYEES, 'canView')],
        loadChildren: () => import('./departments/departments.routes').then(m => m.DEPARTMENTS_ROUTES),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
]
