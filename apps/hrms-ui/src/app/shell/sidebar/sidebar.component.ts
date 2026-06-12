import { Component, Input } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import type { AppModule } from '../../core/models/auth.models'

export interface NavItem {
  module: AppModule
  labelKey: string
  path: string
  icon: string
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <nav class="sidebar">
      @for (item of navItems; track item.module) {
        <a [routerLink]="item.path" routerLinkActive="active">
          <span class="icon">{{ item.icon }}</span>
          {{ item.labelKey | translate }}
        </a>
      }
    </nav>
  `,
})
export class SidebarComponent {
  @Input() navItems: NavItem[] = []
}
