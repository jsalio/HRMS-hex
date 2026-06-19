import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf, NgFor } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { BenefitsService, BenefitPlan, EmployeeBenefit } from './benefits.service'

/**
 * HR-facing benefits administration page.
 * Allows HR managers to create and deactivate benefit plans, and to
 * enroll or unenroll employees.
 */
@Component({
  selector: 'app-benefits-admin-page',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule],
  template: `
    <div class="benefits-page">
      <div class="page-header">
        <h2>{{ 'benefits.admin_title' | translate }}</h2>
        <button class="btn btn-primary" (click)="openPlanModal()">
          + {{ 'benefits.new_plan' | translate }}
        </button>
      </div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error() }}</div>

      <div *ngIf="!loading() && plans().length === 0 && !error()" class="empty-state">
        {{ 'benefits.no_plans' | translate }}
      </div>

      <table *ngIf="!loading() && plans().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'benefits.table.plan' | translate }}</th>
            <th>{{ 'benefits.table.type' | translate }}</th>
            <th>{{ 'benefits.table.provider' | translate }}</th>
            <th>{{ 'benefits.table.cost' | translate }}</th>
            <th>{{ 'benefits.table.status' | translate }}</th>
            <th>{{ 'benefits.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of plans()">
            <td>{{ p.name }}</td>
            <td>{{ 'benefits.types.' + p.type | translate }}</td>
            <td>{{ p.provider || '—' }}</td>
            <td>{{ p.cost !== null ? p.cost : '—' }}</td>
            <td>
              <span class="badge" [attr.data-active]="p.isActive">
                {{ (p.isActive ? 'benefits.status.active' : 'benefits.status.inactive') | translate }}
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-outline" (click)="openEnrollModal(p)">
                {{ 'benefits.enroll' | translate }}
              </button>
              <button *ngIf="p.isActive" class="btn btn-sm btn-danger" (click)="deactivatePlan(p)">
                {{ 'benefits.deactivate' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Create plan modal -->
      <div *ngIf="showPlanModal()" class="modal-backdrop" (click)="closePlanModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'benefits.new_plan' | translate }}</h3>
          <div class="form-group">
            <label>{{ 'benefits.fields.name' | translate }}</label>
            <input class="input" type="text" [(ngModel)]="planForm.name" maxlength="100" />
          </div>
          <div class="form-group">
            <label>{{ 'benefits.fields.type' | translate }}</label>
            <select class="input" [(ngModel)]="planForm.type">
              <option value="">— {{ 'benefits.fields.select_type' | translate }} —</option>
              <option *ngFor="let t of planTypes" [value]="t">
                {{ 'benefits.types.' + t | translate }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ 'benefits.fields.provider' | translate }} ({{ 'common.optional' | translate }})</label>
            <input class="input" type="text" [(ngModel)]="planForm.provider" maxlength="100" />
          </div>
          <div *ngIf="modalError()" class="alert alert-error">{{ modalError() }}</div>
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="closePlanModal()">{{ 'common.cancel' | translate }}</button>
            <button class="btn btn-primary" (click)="submitPlan()"
              [disabled]="!planForm.name || !planForm.type || submitting()">
              <span *ngIf="submitting()" class="spinner sm"></span>
              {{ 'common.save' | translate }}
            </button>
          </div>
        </div>
      </div>

      <!-- Enroll modal -->
      <div *ngIf="showEnrollModal()" class="modal-backdrop" (click)="closeEnrollModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'benefits.enroll_title' | translate }}</h3>
          <p class="modal-plan-name">{{ enrollPlan()?.name }}</p>
          <div class="form-group">
            <label>{{ 'benefits.fields.employee_id' | translate }}</label>
            <input class="input" type="text" [(ngModel)]="enrollForm.employeeId" />
          </div>
          <div class="form-group">
            <label>{{ 'benefits.fields.enrolled_at' | translate }}</label>
            <input class="input" type="date" [(ngModel)]="enrollForm.enrolledAt" />
          </div>
          <div *ngIf="enrollError()" class="alert alert-error">{{ enrollError() }}</div>
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="closeEnrollModal()">{{ 'common.cancel' | translate }}</button>
            <button class="btn btn-primary" (click)="submitEnroll()"
              [disabled]="!enrollForm.employeeId || !enrollForm.enrolledAt || enrolling()">
              <span *ngIf="enrolling()" class="spinner sm"></span>
              {{ 'benefits.enroll' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .benefits-page { max-width: 1000px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .page-header h2 { flex: 1; font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; }
    .alert-error { background: #fce8e6; color: #c5221f; }
    .empty-state { text-align: center; padding: 40px; color: #9aa0a6; font-size: 14px; }
    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; vertical-align: middle; }
    .data-table tr:last-child td { border-bottom: none; }
    .badge { padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; }
    .badge[data-active="true"]  { background: #e6f4ea; color: #137333; }
    .badge[data-active="false"] { background: #f1f3f4; color: #80868b; }
    .btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-primary { background: #1a73e8; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; margin-right: 4px; }
    .btn-danger { background: #fce8e6; color: #c5221f; border: 1px solid #f5c6c3; }
    .btn-danger:hover { background: #f5c6c3; }
    .btn-outline { background: #fff; color: #3c4043; border: 1px solid #e8eaed; }
    .btn-outline:hover { background: #f8f9fa; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    .spinner.sm { width: 14px; height: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.32); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 12px; padding: 28px; max-width: 440px; width: calc(100% - 40px); display: flex; flex-direction: column; gap: 14px; }
    .modal h3 { font-size: 16px; font-weight: 600; color: #202124; margin: 0; }
    .modal-plan-name { font-size: 13.5px; color: #5f6368; margin: -8px 0 0; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group label { font-size: 12px; font-weight: 500; color: #5f6368; }
    .input { width: 100%; height: 38px; border: 1px solid #e8eaed; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #202124; outline: none; font-family: inherit; box-sizing: border-box; }
    .input:focus { border-color: #1a73e8; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
  `],
})
export class BenefitsAdminPageComponent implements OnInit {
  private readonly svc = inject(BenefitsService)

  readonly plans         = signal<BenefitPlan[]>([])
  readonly loading       = signal(false)
  readonly error         = signal<string | null>(null)
  readonly showPlanModal = signal(false)
  readonly showEnrollModal = signal(false)
  readonly submitting    = signal(false)
  readonly enrolling     = signal(false)
  readonly modalError    = signal<string | null>(null)
  readonly enrollError   = signal<string | null>(null)
  readonly enrollPlan    = signal<BenefitPlan | null>(null)

  readonly planTypes = ['health', 'life_insurance', 'dental', 'vision', 'pension', 'other']

  planForm   = { name: '', type: '', provider: '' }
  enrollForm = { employeeId: '', enrolledAt: '' }

  async ngOnInit() {
    this.loading.set(true)
    try {
      const result = await this.svc.getBenefitPlans()
      this.plans.set(result)
    } catch {
      this.error.set('benefits.error.load')
    } finally {
      this.loading.set(false)
    }
  }

  /** Opens the create-plan modal with a reset form. */
  openPlanModal() {
    this.planForm = { name: '', type: '', provider: '' }
    this.modalError.set(null)
    this.showPlanModal.set(true)
  }

  /** Closes the create-plan modal. */
  closePlanModal() { this.showPlanModal.set(false) }

  /** Submits the new plan form. */
  async submitPlan() {
    if (!this.planForm.name || !this.planForm.type) return
    this.submitting.set(true)
    this.modalError.set(null)
    try {
      const plan = await this.svc.createBenefitPlan({
        name: this.planForm.name,
        type: this.planForm.type,
        provider: this.planForm.provider || undefined,
      })
      this.plans.update(list => [...list, plan])
      this.closePlanModal()
    } catch (err: any) {
      this.modalError.set(err?.error?.error ?? 'benefits.error.create')
    } finally {
      this.submitting.set(false)
    }
  }

  /**
   * Deactivates a plan by setting isActive to false.
   *
   * @param plan - the plan to deactivate
   */
  async deactivatePlan(plan: BenefitPlan) {
    try {
      const updated = await this.svc.updateBenefitPlan(plan.id, { isActive: false })
      this.plans.update(list => list.map(p => p.id === plan.id ? updated : p))
    } catch {
      this.error.set('benefits.error.update')
    }
  }

  /**
   * Opens the enroll modal for a specific plan.
   *
   * @param plan - the plan the employee will be enrolled in
   */
  openEnrollModal(plan: BenefitPlan) {
    this.enrollPlan.set(plan)
    this.enrollForm = { employeeId: '', enrolledAt: '' }
    this.enrollError.set(null)
    this.showEnrollModal.set(true)
  }

  /** Closes the enroll modal. */
  closeEnrollModal() { this.showEnrollModal.set(false) }

  /** Submits the enrollment form. */
  async submitEnroll() {
    const plan = this.enrollPlan()
    if (!plan || !this.enrollForm.employeeId || !this.enrollForm.enrolledAt) return
    this.enrolling.set(true)
    this.enrollError.set(null)
    try {
      await this.svc.enrollBenefit(this.enrollForm.employeeId, plan.id, this.enrollForm.enrolledAt)
      this.closeEnrollModal()
    } catch (err: any) {
      this.enrollError.set(err?.error?.error ?? 'benefits.error.enroll')
    } finally {
      this.enrolling.set(false)
    }
  }
}
