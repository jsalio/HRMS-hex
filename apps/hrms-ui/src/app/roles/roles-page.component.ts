import { Component, inject, signal, computed, OnInit } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { TranslateModule } from '@ngx-translate/core'
import type { RoleListItem } from './roles-list.component'
import type { AppModule, RolePermission } from '../core/models/auth.models'

interface RoleDetail extends RoleListItem {
  permissions: RolePermission[]
}

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="roles-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ 'roles.title' | translate }}</h1>
          <p class="page-subtitle">{{ 'roles.subtitle' | translate }}</p>
        </div>
        <button class="btn-create">
          <span class="material-symbols-outlined">add</span>
          {{ 'roles.create' | translate }}
        </button>
      </div>

      @if (isLoading()) {
        <div class="state-loading" role="status">
          <span class="spinner"></span>{{ 'common.loading' | translate }}
        </div>
      } @else if (error()) {
        <div class="state-error" role="alert">{{ 'common.error.generic' | translate }}</div>
      } @else {
        <div class="roles-layout">
          <!-- Left: role list -->
          <div class="roles-list-panel">
            <p class="list-label">{{ 'roles.available' | translate }}</p>
            @for (role of roles(); track role.id) {
              <button
                class="role-card"
                [class.selected]="selectedId() === role.id"
                (click)="select(role)"
              >
                <div class="role-card-info">
                  <span class="role-card-name">{{ role.name }}</span>
                  <span class="role-card-desc">{{ 'roles.desc.' + role.name | translate }}</span>
                </div>
                @if (role.isSystem) {
                  <span class="badge-system">{{ 'roles.list.system' | translate }}</span>
                }
              </button>
            }
          </div>

          <!-- Right: permissions matrix -->
          @if (selected()) {
            <div class="perms-panel">
              <div class="perms-panel-header">
                <div>
                  <h2 class="perms-title">{{ selected()!.name }}</h2>
                  <p class="perms-subtitle">{{ 'roles.permissions_subtitle' | translate }}</p>
                </div>
                <div class="perms-actions">
                  <button class="btn-discard">{{ 'common.discard' | translate }}</button>
                  <button class="btn-save" [disabled]="selected()!.isSystem">
                    {{ 'common.save' | translate }}
                  </button>
                </div>
              </div>

              <table class="perms-table">
                <thead>
                  <tr>
                    <th class="col-module">{{ 'roles.perms.module' | translate }}</th>
                    <th>{{ 'roles.permissions.canView' | translate }}</th>
                    <th>{{ 'roles.permissions.canCreate' | translate }}</th>
                    <th>{{ 'roles.permissions.canEdit' | translate }}</th>
                    <th>{{ 'roles.permissions.canDelete' | translate }}</th>
                    <th>{{ 'roles.permissions.canExport' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (perm of selected()!.permissions; track perm.module) {
                    <tr>
                      <td class="col-module">
                        <span class="material-symbols-outlined module-icon">{{ moduleIcon(perm.module) }}</span>
                        {{ 'modules.' + perm.module | translate }}
                      </td>
                      <td><input type="checkbox" [checked]="perm.canView"   [disabled]="true" /></td>
                      <td><input type="checkbox" [checked]="perm.canCreate" [disabled]="true" /></td>
                      <td><input type="checkbox" [checked]="perm.canEdit"   [disabled]="true" /></td>
                      <td><input type="checkbox" [checked]="perm.canDelete" [disabled]="true" /></td>
                      <td><input type="checkbox" [checked]="perm.canExport" [disabled]="true" /></td>
                    </tr>
                  }
                </tbody>
              </table>

              @if (selected()!.isSystem) {
                <div class="system-note">
                  <span class="material-symbols-outlined">info</span>
                  {{ 'roles.system_note' | translate }}
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .roles-page { max-width: 1200px; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .page-title { font-size: 20px; font-weight: 600; color: #202124; margin: 0 0 4px; }
    .page-subtitle { font-size: 13px; color: #5f6368; margin: 0; }

    .btn-create {
      display: flex;
      align-items: center;
      gap: 6px;
      height: 38px;
      padding: 0 18px;
      background: #1a73e8;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-create:hover { background: #1557b0; }
    .btn-create .material-symbols-outlined { font-size: 18px; }

    /* ── States ──────────────────────────── */
    .state-loading, .state-error {
      display: flex; align-items: center; gap: 10px;
      padding: 20px; border-radius: 10px; font-size: 14px;
    }
    .state-loading { background: #fff; color: #5f6368; }
    .state-error { background: #fce8e6; color: #c5221f; }
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid #e8eaed; border-top-color: #1a73e8;
      border-radius: 50%; animation: spin 700ms linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Layout ──────────────────────────── */
    .roles-layout {
      display: flex;
      gap: 20px;
      align-items: flex-start;
    }

    /* ── Role list panel ─────────────────── */
    .roles-list-panel {
      width: 240px;
      min-width: 240px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .list-label {
      font-size: 11px;
      font-weight: 600;
      color: #9aa0a6;
      text-transform: uppercase;
      letter-spacing: .6px;
      margin: 0 0 4px 4px;
    }
    .role-card {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px;
      background: #fff;
      border: 1px solid #e8eaed;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      transition: border-color 120ms, box-shadow 120ms;
    }
    .role-card:hover { border-color: #1a73e8; }
    .role-card.selected {
      border-color: #1a73e8;
      background: #f0f6ff;
      box-shadow: 0 0 0 1px #1a73e8;
    }
    .role-card-info { display: flex; flex-direction: column; gap: 2px; }
    .role-card-name { font-size: 13.5px; font-weight: 600; color: #202124; }
    .role-card-desc { font-size: 11.5px; color: #5f6368; }
    .badge-system {
      font-size: 10px; font-weight: 600;
      padding: 2px 7px; border-radius: 10px;
      background: #e8f0fe; color: #1a73e8;
      white-space: nowrap; flex-shrink: 0;
    }

    /* ── Permissions panel ───────────────── */
    .perms-panel {
      flex: 1;
      background: #fff;
      border: 1px solid #e8eaed;
      border-radius: 12px;
      overflow: hidden;
    }
    .perms-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f3f4;
    }
    .perms-title { font-size: 16px; font-weight: 600; color: #202124; margin: 0 0 2px; }
    .perms-subtitle { font-size: 12px; color: #5f6368; margin: 0; }
    .perms-actions { display: flex; gap: 8px; }

    .btn-discard {
      height: 34px; padding: 0 16px;
      background: #fff; border: 1px solid #e8eaed;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      color: #3c4043; cursor: pointer;
    }
    .btn-discard:hover { background: #f8f9fa; }
    .btn-save {
      height: 34px; padding: 0 16px;
      background: #1a73e8; border: none;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      color: #fff; cursor: pointer;
    }
    .btn-save:hover:not(:disabled) { background: #1557b0; }
    .btn-save:disabled { background: #a8c7fa; cursor: not-allowed; }

    .perms-table { width: 100%; border-collapse: collapse; }
    .perms-table thead { background: #f8f9fa; }
    .perms-table th {
      padding: 10px 16px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #5f6368;
      text-transform: uppercase;
      letter-spacing: .4px;
      border-bottom: 1px solid #f1f3f4;
    }
    .perms-table th.col-module { text-align: left; width: 200px; }
    .perms-table td {
      padding: 12px 16px;
      text-align: center;
      border-bottom: 1px solid #f8f9fa;
      font-size: 13.5px;
      color: #202124;
    }
    .perms-table td.col-module {
      text-align: left;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .perms-table tr:last-child td { border-bottom: none; }
    .perms-table tr:hover td { background: #fafbfc; }
    .module-icon { font-size: 16px; color: #9aa0a6; }

    input[type="checkbox"] {
      width: 16px; height: 16px;
      accent-color: #1a73e8;
      cursor: pointer;
    }
    input[type="checkbox"]:disabled { cursor: default; }

    .system-note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: #fef7e0;
      color: #7a5200;
      font-size: 12.5px;
      border-top: 1px solid #fce8a0;
    }
    .system-note .material-symbols-outlined { font-size: 16px; color: #f9a825; }
  `],
})
export class RolesPageComponent implements OnInit {
  private readonly http = inject(HttpClient)

  readonly isLoading = signal(false)
  readonly error = signal<string | null>(null)
  readonly roles = signal<RoleDetail[]>([])
  readonly selectedId = signal<string | null>(null)

  readonly selected = computed(() => this.roles().find(r => r.id === this.selectedId()) ?? null)

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true)
    try {
      const data = await firstValueFrom(this.http.get<RoleDetail[]>('/api/roles'))
      this.roles.set(data)
      if (data.length > 0) this.selectedId.set(data[0].id)
    } catch {
      this.error.set('load_failed')
    } finally {
      this.isLoading.set(false)
    }
  }

  select(role: RoleDetail): void { this.selectedId.set(role.id) }

  moduleIcon(module: AppModule | string): string {
    const icons: Record<string, string> = {
      dashboard: 'dashboard', employees: 'group', attendance: 'calendar_today',
      payroll: 'payments', reports: 'analytics', settings: 'settings',
      documents: 'description', absences: 'event_busy', benefits: 'card_giftcard',
      recruitment: 'person_add', notifications: 'notifications',
    }
    return icons[module as string] ?? 'circle'
  }
}
