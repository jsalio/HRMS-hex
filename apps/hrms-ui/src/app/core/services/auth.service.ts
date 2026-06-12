import { Injectable, signal, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'
import { firstValueFrom } from 'rxjs'
import type { AuthenticatedUser, LoginResponse, RefreshResponse, RolePermission } from '../models/auth.models'
import { AppModule } from '../models/auth.models'

const ACCESS_TOKEN_KEY = 'hrms_access_token'
const REFRESH_TOKEN_KEY = 'hrms_refresh_token'

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient)
  private readonly router = inject(Router)

  private readonly _currentUser = signal<AuthenticatedUser | null>(null)
  readonly currentUser = this._currentUser.asReadonly()

  async login(credentials: { email: string; password: string }): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>('/api/auth/login', credentials)
    )
    localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
    this._currentUser.set(response.user)
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}))
    } catch { /* best-effort */ }
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    this._currentUser.set(null)
    await this.router.navigate(['/login'])
  }

  async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) { await this.logout(); return }

    try {
      const response = await firstValueFrom(
        this.http.post<RefreshResponse>('/api/auth/refresh', { refresh_token: refreshToken })
      )
      localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token)
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
    } catch {
      await this.logout()
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  }

  hasPermission(module: AppModule, action: keyof Omit<RolePermission, 'module'>): boolean {
    const user = this._currentUser()
    if (!user) return false
    if (user.role.name === 'super_admin') return true
    const perm = user.role.permissions.find(p => p.module === module)
    return perm?.[action] === true
  }

  restoreSession(user: AuthenticatedUser): void {
    this._currentUser.set(user)
  }
}
