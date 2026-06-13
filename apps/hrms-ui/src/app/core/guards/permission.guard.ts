import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '../services/auth.service'
import type { AppModule, RolePermission } from '../models/auth.models'

// FROZEN CONTRACT — signature used by all sub-specs
export function permissionGuard(module: AppModule, action: keyof Omit<RolePermission, 'module'>) {
  return () => {
    const auth = inject(AuthService)
    const router = inject(Router)
    if (!auth.currentUser()) return router.createUrlTree(['/login'])
    return auth.hasPermission(module, action) ? true : router.createUrlTree(['/forbidden'])
  }
}
