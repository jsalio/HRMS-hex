import { Component, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { AuthService } from '../../core/services/auth.service'
import { LoginFormComponent, type LoginFormValue } from './login-form.component'

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [LoginFormComponent],
  template: `
    <div class="login-page">
      <app-login-form
        [isLoading]="isLoading()"
        [errorMessage]="errorMessage()"
        (submitted)="onLogin($event)"
      />
    </div>
  `,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService)
  private readonly router = inject(Router)

  readonly isLoading = signal(false)
  readonly errorMessage = signal<string | null>(null)

  async onLogin(credentials: LoginFormValue): Promise<void> {
    this.isLoading.set(true)
    this.errorMessage.set(null)
    try {
      await this.auth.login(credentials)
      await this.router.navigate(['/dashboard'])
    } catch {
      this.errorMessage.set('auth.login.error.invalid_credentials')
    } finally {
      this.isLoading.set(false)
    }
  }
}
