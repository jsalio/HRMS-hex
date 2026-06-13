import { Component, inject, computed } from '@angular/core'
import { Router, RouterOutlet, NavigationEnd } from '@angular/router'
import { TranslateService } from '@ngx-translate/core'
import { AuthService } from '../core/services/auth.service'
import { AppModule } from '../core/models/auth.models'
import { SidebarComponent, type NavItem } from './sidebar/sidebar.component'
import { HeaderComponent } from './header/header.component'
import { filter, map } from 'rxjs/operators'
import { toSignal } from '@angular/core/rxjs-interop'

const ALL_NAV_ITEMS: NavItem[] = [
  { module: AppModule.DASHBOARD,     labelKey: 'shell.nav.dashboard',     path: '/dashboard',     icon: 'dashboard' },
  { module: AppModule.EMPLOYEES,     labelKey: 'shell.nav.employees',     path: '/employees',     icon: 'group' },
  { module: AppModule.ATTENDANCE,    labelKey: 'shell.nav.attendance',    path: '/attendance',    icon: 'calendar_today' },
  { module: AppModule.ABSENCES,      labelKey: 'shell.nav.absences',      path: '/absences',      icon: 'event_busy' },
  { module: AppModule.DOCUMENTS,     labelKey: 'shell.nav.documents',     path: '/documents',     icon: 'description' },
  { module: AppModule.PAYROLL,       labelKey: 'shell.nav.payroll',       path: '/payroll',       icon: 'payments' },
  { module: AppModule.BENEFITS,      labelKey: 'shell.nav.benefits',      path: '/benefits',      icon: 'card_giftcard' },
  { module: AppModule.RECRUITMENT,   labelKey: 'shell.nav.recruitment',   path: '/recruitment',   icon: 'person_add' },
  { module: AppModule.REPORTS,       labelKey: 'shell.nav.reports',       path: '/reports',       icon: 'analytics' },
  { module: AppModule.NOTIFICATIONS, labelKey: 'shell.nav.notifications', path: '/notifications', icon: 'notifications' },
  { module: AppModule.SETTINGS,      labelKey: 'shell.nav.settings',      path: '/settings',      icon: 'settings',
    section: 'shell.nav_section.configuration' },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':      'shell.nav.dashboard',
  '/employees':      'shell.nav.employees',
  '/attendance':     'shell.nav.attendance',
  '/absences':       'shell.nav.absences',
  '/documents':      'shell.nav.documents',
  '/payroll':        'shell.nav.payroll',
  '/benefits':       'shell.nav.benefits',
  '/recruitment':    'shell.nav.recruitment',
  '/reports':        'shell.nav.reports',
  '/notifications':  'shell.nav.notifications',
  '/settings':       'shell.nav.settings',
  '/settings/roles': 'shell.nav.settings',
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  template: `
    <div class="app-shell">
      <app-sidebar
        [navItems]="visibleNavItems()"
        [userEmail]="userEmail()"
      />
      <div class="main-area">
        <app-header
          [pageTitle]="pageTitle()"
          [currentLang]="translate.currentLang"
          (languageChanged)="onLanguageChange($event)"
          (logoutClicked)="onLogout()"
        />
        <main class="page-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: #f8f9fa;
    }
    .page-content {
      flex: 1;
      overflow-y: auto;
      padding: 28px 32px;
    }
  `],
})
export class ShellComponent {
  protected readonly translate = inject(TranslateService)
  private readonly auth = inject(AuthService)
  private readonly router = inject(Router)

  readonly userEmail = computed(() => this.auth.currentUser()?.email ?? '')

  readonly visibleNavItems = computed(() =>
    ALL_NAV_ITEMS.filter(item => this.auth.hasPermission(item.module, 'canView'))
  )

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects.split('?')[0])
    ),
    { initialValue: this.router.url.split('?')[0] }
  )

  readonly pageTitle = computed(() => PAGE_TITLES[this.currentUrl()] ?? 'shell.nav.dashboard')

  onLanguageChange(lang: string): void { this.translate.use(lang) }

  async onLogout(): Promise<void> { await this.auth.logout() }
}
