import { Component, Input } from '@angular/core'
import { RouterLink, RouterLinkActive } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import type { AppModule } from '../../core/models/auth.models'

export interface NavItem {
  module: AppModule
  labelKey: string
  path: string
  icon: string        // Material Symbols name
  section?: string    // optional section header label key
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  template: `
    <nav class="sidebar">
      <div class="sidebar-brand">
        <span class="material-symbols-outlined brand-icon">corporate_fare</span>
        <div class="brand-text">
          <span class="brand-name">HRMS-HEX</span>
          <span class="brand-role">{{ 'shell.brand_subtitle' | translate }}</span>
        </div>
      </div>

      <ul class="nav-list">
        @for (item of navItems; track item.module) {
          @if (item.section) {
            <li class="nav-section">{{ item.section | translate }}</li>
          }
          <li>
            <a class="nav-item" [routerLink]="item.path" routerLinkActive="active">
              <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
              <span class="nav-label">{{ item.labelKey | translate }}</span>
            </a>
          </li>
        }
      </ul>

      @if (userEmail) {
        <div class="sidebar-user">
          <div class="user-avatar">{{ userInitial }}</div>
          <div class="user-info">
            <span class="user-name">{{ userName }}</span>
            <span class="user-email">{{ userEmail }}</span>
          </div>
        </div>
      }
    </nav>
  `,
  styles: [`
    .sidebar {
      width: 220px;
      min-width: 220px;
      height: 100vh;
      background: #ffffff;
      border-right: 1px solid #e8eaed;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    /* ── Brand ─────────────────────────────── */
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid #f1f3f4;
      margin-bottom: 8px;
    }
    .brand-icon {
      font-size: 28px;
      color: #1a73e8;
      font-variation-settings: 'FILL' 1;
    }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name {
      font-size: 15px;
      font-weight: 700;
      color: #202124;
      line-height: 1.2;
    }
    .brand-role {
      font-size: 11px;
      color: #1a73e8;
      font-weight: 500;
      background: #e8f0fe;
      border-radius: 4px;
      padding: 1px 6px;
      display: inline-block;
      margin-top: 2px;
    }

    /* ── Nav ─────────────────────────────── */
    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0 8px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
    }

    .nav-section {
      font-size: 10px;
      font-weight: 600;
      color: #9aa0a6;
      text-transform: uppercase;
      letter-spacing: .8px;
      padding: 12px 8px 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 8px;
      color: #5f6368;
      font-size: 13.5px;
      font-weight: 500;
      text-decoration: none;
      transition: background 120ms, color 120ms;
    }
    .nav-item:hover {
      background: #f1f3f4;
      color: #202124;
    }
    .nav-item.active {
      background: #e8f0fe;
      color: #1a73e8;
      font-weight: 600;
    }
    .nav-item.active .nav-icon {
      font-variation-settings: 'FILL' 1;
    }

    .nav-icon {
      font-size: 20px;
      width: 24px;
      text-align: center;
      flex-shrink: 0;
    }
    .nav-label { flex: 1; }

    /* ── User profile ────────────────────── */
    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-top: 1px solid #f1f3f4;
      margin-top: auto;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #1a73e8;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .user-info { display: flex; flex-direction: column; min-width: 0; }
    .user-name {
      font-size: 13px;
      font-weight: 600;
      color: #202124;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .user-email {
      font-size: 11px;
      color: #9aa0a6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
})
export class SidebarComponent {
  @Input() navItems: NavItem[] = []
  @Input() userEmail = ''

  get userInitial(): string {
    return this.userEmail.charAt(0).toUpperCase()
  }

  get userName(): string {
    return this.userEmail.split('@')[0]
  }
}
