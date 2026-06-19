import { Component, inject } from '@angular/core'
import { Router } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'

/**
 * Shown when the permission guard blocks access to a protected route.
 * Provides a back link so the user can return to the dashboard.
 */
@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="forbidden-wrapper">
      <div class="forbidden-card">
        <span class="material-symbols-outlined icon">lock</span>
        <h1>{{ 'common.forbidden.title' | translate }}</h1>
        <p>{{ 'common.forbidden.message' | translate }}</p>
        <button class="btn-primary" (click)="goHome()">
          {{ 'common.forbidden.go_home' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .forbidden-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
    }
    .forbidden-card {
      text-align: center;
      background: #fff;
      border: 1px solid #e8eaed;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 400px;
      width: 100%;
    }
    .icon {
      font-size: 48px;
      color: #ea4335;
      display: block;
      margin-bottom: 16px;
    }
    h1 { font-size: 22px; font-weight: 600; color: #202124; margin: 0 0 8px; }
    p  { font-size: 14px; color: #5f6368; margin: 0 0 24px; line-height: 1.5; }
    .btn-primary {
      background: #1a73e8;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-primary:hover { background: #1558b0; }
  `],
})
export class ForbiddenPageComponent {
  private readonly router = inject(Router)

  /** Navigates the user back to the dashboard. */
  goHome(): void { this.router.navigate(['/dashboard']) }
}
