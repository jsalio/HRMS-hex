import { Component, inject, signal, OnInit } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { TranslateModule } from '@ngx-translate/core'
import { RolesListComponent, type RoleListItem } from './roles-list.component'

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [TranslateModule, RolesListComponent],
  template: `
    @if (isLoading()) {
      <div class="loading-spinner" role="status">{{ 'common.loading' | translate }}</div>
    } @else if (error()) {
      <div class="error-banner" role="alert">{{ 'common.error.generic' | translate }}</div>
    } @else if (roles().length === 0) {
      <div class="empty-state">{{ 'roles.empty' | translate }}</div>
    } @else {
      <app-roles-list [roles]="roles()" />
    }
  `,
})
export class RolesPageComponent implements OnInit {
  private readonly http = inject(HttpClient)

  readonly isLoading = signal(false)
  readonly error = signal<string | null>(null)
  readonly roles = signal<RoleListItem[]>([])

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true)
    try {
      const data = await firstValueFrom(this.http.get<RoleListItem[]>('/api/roles'))
      this.roles.set(data)
    } catch (err) {
      this.error.set('load_failed')
    } finally {
      this.isLoading.set(false)
    }
  }
}
