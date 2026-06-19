import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf, NgFor } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { AuthService } from '../core/services/auth.service'
import { BenefitsService, EmployeeBenefit } from './benefits.service'

/**
 * Employee-facing benefits page. Displays the authenticated employee's
 * active benefit enrollments in read-only mode.
 */
@Component({
  selector: 'app-my-benefits-page',
  standalone: true,
  imports: [NgIf, NgFor, TranslateModule],
  template: `
    <div class="benefits-page">
      <div class="page-header">
        <h2>{{ 'benefits.my_benefits' | translate }}</h2>
      </div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error()! | translate }}</div>

      <div *ngIf="!loading() && benefits().length === 0 && !error()" class="empty-state">
        {{ 'benefits.no_benefits' | translate }}
      </div>

      <table *ngIf="!loading() && benefits().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'benefits.table.plan' | translate }}</th>
            <th>{{ 'benefits.table.type' | translate }}</th>
            <th>{{ 'benefits.table.provider' | translate }}</th>
            <th>{{ 'benefits.table.enrolled_at' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let b of benefits()">
            <td>{{ b.plan?.name }}</td>
            <td>{{ 'benefits.types.' + b.plan?.type | translate }}</td>
            <td>{{ b.plan?.provider || '—' }}</td>
            <td>{{ b.enrolledAt }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .benefits-page { max-width: 900px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .page-header h2 { flex: 1; font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; }
    .alert-error { background: #fce8e6; color: #c5221f; }
    .empty-state { text-align: center; padding: 40px; color: #9aa0a6; font-size: 14px; }
    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; }
    .data-table tr:last-child td { border-bottom: none; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class MyBenefitsPageComponent implements OnInit {
  private readonly svc  = inject(BenefitsService)
  private readonly auth = inject(AuthService)

  readonly benefits = signal<EmployeeBenefit[]>([])
  readonly loading  = signal(false)
  readonly error    = signal<string | null>(null)

  /** @returns the authenticated employee's identifier */
  get employeeId(): string { return this.auth.currentUser()?.employeeId ?? '' }

  async ngOnInit() {
    this.loading.set(true)
    try {
      const result = await this.svc.getEmployeeBenefits(this.employeeId)
      this.benefits.set(result)
    } catch {
      this.error.set('benefits.error.load')
    } finally {
      this.loading.set(false)
    }
  }
}
