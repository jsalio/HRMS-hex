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
    loadComponent: () => import('./auth/login/login-page.component').then(m => m.LoginPageComponent),
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
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
]
