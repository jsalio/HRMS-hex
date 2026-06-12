import { Component, inject, computed } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { TranslateService } from '@ngx-translate/core'
import { AuthService } from '../core/services/auth.service'
import { AppModule } from '../core/models/auth.models'
import { SidebarComponent, type NavItem } from './sidebar/sidebar.component'
import { HeaderComponent } from './header/header.component'

const ALL_NAV_ITEMS: NavItem[] = [
  { module: AppModule.DASHBOARD,     labelKey: 'shell.nav.dashboard',     path: '/dashboard',     icon: '📊' },
  { module: AppModule.EMPLOYEES,     labelKey: 'shell.nav.employees',     path: '/employees',     icon: '👥' },
  { module: AppModule.ATTENDANCE,    labelKey: 'shell.nav.attendance',    path: '/attendance',    icon: '🕐' },
  { module: AppModule.ABSENCES,      labelKey: 'shell.nav.absences',      path: '/absences',      icon: '📅' },
  { module: AppModule.DOCUMENTS,     labelKey: 'shell.nav.documents',     path: '/documents',     icon: '📄' },
  { module: AppModule.PAYROLL,       labelKey: 'shell.nav.payroll',       path: '/payroll',       icon: '💰' },
  { module: AppModule.BENEFITS,      labelKey: 'shell.nav.benefits',      path: '/benefits',      icon: '🎁' },
  { module: AppModule.RECRUITMENT,   labelKey: 'shell.nav.recruitment',   path: '/recruitment',   icon: '🔍' },
  { module: AppModule.REPORTS,       labelKey: 'shell.nav.reports',       path: '/reports',       icon: '📈' },
  { module: AppModule.NOTIFICATIONS, labelKey: 'shell.nav.notifications', path: '/notifications', icon: '🔔' },
  { module: AppModule.SETTINGS,      labelKey: 'shell.nav.settings',      path: '/settings',      icon: '⚙️' },
]

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  template: `
    <div class="app-shell">
      <app-sidebar [navItems]="visibleNavItems()" />
      <div class="main-area">
        <app-header
          [userEmail]="userEmail()"
          [currentLang]="translate.currentLang"
          (languageChanged)="onLanguageChange($event)"
          (logoutClicked)="onLogout()"
        />
        <main><router-outlet /></main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  protected readonly translate = inject(TranslateService)
  private readonly auth = inject(AuthService)

  readonly userEmail = computed(() => this.auth.currentUser()?.email ?? '')

  readonly visibleNavItems = computed(() =>
    ALL_NAV_ITEMS.filter(item => this.auth.hasPermission(item.module, 'canView'))
  )

  onLanguageChange(lang: string): void {
    this.translate.use(lang)
  }

  async onLogout(): Promise<void> {
    await this.auth.logout()
  }
}
