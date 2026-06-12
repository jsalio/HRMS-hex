import { Component, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { AuthService } from '../../core/services/auth.service'
import { LoginFormComponent, type LoginFormValue } from './login-form.component'

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [LoginFormComponent, TranslateModule],
  template: `
    <div class="login-page">

      <!-- Left: brand panel -->
      <div class="brand-panel">
        <div class="brand-content">
          <div class="brand-logo">
            <span class="material-symbols-outlined brand-icon">corporate_fare</span>
          </div>
          <h1 class="brand-name">HRMS-HEX</h1>
          <p class="brand-tagline">{{ 'auth.login.brand_subtitle' | translate }}</p>

          <ul class="feature-list">
            <li class="feature-item">
              <span class="material-symbols-outlined feature-icon">shield</span>
              <span>{{ 'auth.login.feature.secure' | translate }}</span>
            </li>
            <li class="feature-item">
              <span class="material-symbols-outlined feature-icon">group</span>
              <span>{{ 'auth.login.feature.team' | translate }}</span>
            </li>
            <li class="feature-item">
              <span class="material-symbols-outlined feature-icon">analytics</span>
              <span>{{ 'auth.login.feature.reports' | translate }}</span>
            </li>
          </ul>
        </div>
        <p class="brand-footer">© 2026 HRMS-HEX</p>
      </div>

      <!-- Right: form panel -->
      <div class="form-panel">
        <div class="form-card">
          <h2 class="welcome-title">{{ 'auth.login.welcome' | translate }}</h2>
          <p class="welcome-subtitle">{{ 'auth.login.subtitle' | translate }}</p>

          @if (errorMessage()) {
            <div class="error-banner" role="alert">
              <span class="material-symbols-outlined">error_outline</span>
              {{ errorMessage()! | translate }}
            </div>
          }

          <app-login-form
            [isLoading]="isLoading()"
            (submitted)="onLogin($event)"
          />
        </div>
      </div>

    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
    }

    /* ── Left brand panel ──────────────────── */
    .brand-panel {
      width: 42%;
      min-height: 100vh;
      background: linear-gradient(160deg, #0c3fa0 0%, #1a73e8 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px 52px;
    }

    .brand-content {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding-top: 40px;
    }

    .brand-logo {
      width: 64px;
      height: 64px;
      background: rgba(255,255,255,.15);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
    }
    .brand-icon {
      font-size: 36px;
      color: #fff;
      font-variation-settings: 'FILL' 1;
    }

    .brand-name {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 8px;
      letter-spacing: -.5px;
    }

    .brand-tagline {
      font-size: 15px;
      color: rgba(255,255,255,.75);
      margin: 0 0 48px;
      line-height: 1.5;
    }

    .feature-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      color: rgba(255,255,255,.85);
      font-size: 15px;
      font-weight: 500;
    }
    .feature-icon {
      font-size: 20px;
      color: rgba(255,255,255,.7);
      font-variation-settings: 'FILL' 1;
      flex-shrink: 0;
    }

    .brand-footer {
      font-size: 13px;
      color: rgba(255,255,255,.4);
      margin: 0;
    }

    /* ── Right form panel ──────────────────── */
    .form-panel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      padding: 48px 32px;
    }

    .form-card {
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .welcome-title {
      font-size: 26px;
      font-weight: 700;
      color: #202124;
      margin: 0 0 8px;
      letter-spacing: -.3px;
    }

    .welcome-subtitle {
      font-size: 14px;
      color: #5f6368;
      margin: 0 0 28px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fce8e6;
      color: #c5221f;
      border: 1px solid #f28b82;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .error-banner .material-symbols-outlined { font-size: 18px; flex-shrink: 0; }
  `],
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
