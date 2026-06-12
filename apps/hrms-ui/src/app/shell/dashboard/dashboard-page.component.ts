import { Component, inject, computed } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'
import { AuthService } from '../../core/services/auth.service'

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="dashboard">
      <h1 class="welcome">{{ 'shell.nav.dashboard' | translate }}</h1>
      <p class="subtitle">{{ userEmail() }}</p>
    </div>
  `,
  styles: [`
    .dashboard { padding: 8px 0; }
    .welcome { font-size: 24px; font-weight: 600; color: #202124; margin: 0 0 8px; }
    .subtitle { font-size: 14px; color: #5f6368; margin: 0; }
  `],
})
export class DashboardPageComponent {
  private readonly auth = inject(AuthService)
  readonly userEmail = computed(() => this.auth.currentUser()?.email ?? '')
}
