import { Component, OnInit, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { NgIf, NgFor } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { AuthService } from '../core/services/auth.service'
import { AbsencesService, AbsenceBalance, AbsenceType, AbsenceRequest } from './absences.service'

@Component({
  selector: 'app-my-absences-page',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule],
  template: `
    <div class="absences-page">
      <div class="page-header">
        <h2>{{ 'absences.my_absences' | translate }}</h2>
        <button class="btn btn-primary" (click)="openRequestModal()">
          + {{ 'absences.request_absence' | translate }}
        </button>
      </div>

      <!-- Balances -->
      <div *ngIf="balances().length > 0" class="balances-grid">
        <div *ngFor="let b of balances()" class="balance-card">
          <div class="balance-type">{{ 'absences.types.' + b.absenceType?.name | translate }}</div>
          <div class="balance-numbers">
            <span class="balance-avail">{{ available(b) }}</span>
            <span class="balance-label">{{ 'absences.days_available' | translate }}</span>
          </div>
          <div class="balance-detail">
            {{ b.allocatedDays }} {{ 'absences.allocated' | translate }} ·
            {{ b.usedDays }} {{ 'absences.used' | translate }} ·
            {{ b.pendingDays }} {{ 'absences.pending' | translate }}
          </div>
        </div>
      </div>

      <!-- Requests list -->
      <div class="section-title">{{ 'absences.my_requests' | translate }}</div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error() }}</div>
      <div *ngIf="!loading() && requests().length === 0" class="empty-state">
        {{ 'absences.no_requests' | translate }}
      </div>

      <table *ngIf="!loading() && requests().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'absences.table.type' | translate }}</th>
            <th>{{ 'absences.table.dates' | translate }}</th>
            <th>{{ 'absences.table.days' | translate }}</th>
            <th>{{ 'absences.table.status' | translate }}</th>
            <th>{{ 'absences.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of requests()">
            <td>{{ 'absences.types.' + r.absenceType?.name | translate }}</td>
            <td>{{ r.startDate }} — {{ r.endDate }}</td>
            <td>{{ r.workingDays }}</td>
            <td><span class="badge" [attr.data-status]="r.status">
              {{ 'absences.status.' + r.status | translate }}
            </span></td>
            <td>
              <button *ngIf="r.status === 'PENDING'" class="btn btn-sm btn-danger"
                (click)="doCancel(r)">
                {{ 'absences.cancel' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Request modal -->
      <div *ngIf="showModal()" class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'absences.request_absence' | translate }}</h3>

          <div class="form-group">
            <label>{{ 'absences.fields.type' | translate }}</label>
            <select class="input" [(ngModel)]="form.absenceTypeId">
              <option value="">— {{ 'absences.fields.select_type' | translate }} —</option>
              <option *ngFor="let t of types()" [value]="t.id">
                {{ 'absences.types.' + t.name | translate }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ 'absences.fields.start_date' | translate }}</label>
            <input class="input" type="date" [(ngModel)]="form.startDate" />
          </div>

          <div class="form-group">
            <label>{{ 'absences.fields.end_date' | translate }}</label>
            <input class="input" type="date" [(ngModel)]="form.endDate" />
          </div>

          <div class="form-group">
            <label>{{ 'absences.fields.reason' | translate }} ({{ 'common.optional' | translate }})</label>
            <input class="input" type="text" [(ngModel)]="form.reason" maxlength="500" />
          </div>

          <div *ngIf="modalError()" class="alert alert-error">{{ modalError() }}</div>

          <div class="modal-actions">
            <button class="btn btn-outline" (click)="closeModal()">{{ 'common.cancel' | translate }}</button>
            <button class="btn btn-primary" (click)="submitRequest()"
              [disabled]="!form.absenceTypeId || !form.startDate || !form.endDate || submitting()">
              <span *ngIf="submitting()" class="spinner sm"></span>
              {{ 'absences.submit_request' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .absences-page { max-width: 900px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .page-header h2 { flex: 1; font-size: 18px; font-weight: 600; color: #202124; margin: 0; }

    .balances-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .balance-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 16px; }
    .balance-type { font-size: 12px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 10px; }
    .balance-numbers { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
    .balance-avail { font-size: 28px; font-weight: 700; color: #1a73e8; }
    .balance-label { font-size: 12px; color: #9aa0a6; }
    .balance-detail { font-size: 11.5px; color: #9aa0a6; }

    .section-title { font-size: 13px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 12px; }

    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; }
    .alert-error { background: #fce8e6; color: #c5221f; }
    .empty-state { text-align: center; padding: 40px; color: #9aa0a6; font-size: 14px; }

    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; vertical-align: middle; }
    .data-table tr:last-child td { border-bottom: none; }

    .badge { padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; }
    .badge[data-status="PENDING"]   { background: #fef7e0; color: #7a5200; }
    .badge[data-status="APPROVED"]  { background: #e6f4ea; color: #137333; }
    .badge[data-status="REJECTED"]  { background: #fce8e6; color: #c5221f; }
    .badge[data-status="CANCELLED"] { background: #f1f3f4; color: #80868b; }

    .btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-primary { background: #1a73e8; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
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
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group label { font-size: 12px; font-weight: 500; color: #5f6368; }
    .input { width: 100%; height: 38px; border: 1px solid #e8eaed; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #202124; outline: none; font-family: inherit; box-sizing: border-box; }
    .input:focus { border-color: #1a73e8; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
  `],
})
export class MyAbsencesPageComponent implements OnInit {
  private readonly svc  = inject(AbsencesService)
  private readonly auth = inject(AuthService)

  readonly requests  = signal<AbsenceRequest[]>([])
  readonly balances  = signal<AbsenceBalance[]>([])
  readonly types     = signal<AbsenceType[]>([])
  readonly loading   = signal(false)
  readonly error     = signal<string | null>(null)
  readonly showModal = signal(false)
  readonly submitting = signal(false)
  readonly modalError = signal<string | null>(null)

  form = { absenceTypeId: '', startDate: '', endDate: '', reason: '' }

  get employeeId(): string { return this.auth.currentUser()?.id ?? '' }

  available(b: AbsenceBalance): number {
    return b.allocatedDays - b.usedDays - b.pendingDays
  }

  async ngOnInit() {
    this.loading.set(true)
    try {
      const [types, balances, result] = await Promise.all([
        this.svc.getTypes(),
        this.svc.getBalances(this.employeeId),
        this.svc.getRequests({ employeeId: this.employeeId }),
      ])
      this.types.set(types)
      this.balances.set(balances)
      this.requests.set(result.data)
    } catch {
      this.error.set('absences.error.load')
    } finally {
      this.loading.set(false)
    }
  }

  openRequestModal() {
    this.form = { absenceTypeId: '', startDate: '', endDate: '', reason: '' }
    this.modalError.set(null)
    this.showModal.set(true)
  }

  closeModal() { this.showModal.set(false) }

  async submitRequest() {
    if (!this.form.absenceTypeId || !this.form.startDate || !this.form.endDate) return
    this.submitting.set(true)
    this.modalError.set(null)
    try {
      const req = await this.svc.createRequest({
        employeeId: this.employeeId,
        absenceTypeId: this.form.absenceTypeId,
        startDate: this.form.startDate,
        endDate: this.form.endDate,
        reason: this.form.reason || undefined,
      })
      this.requests.update(list => [req, ...list])
      this.closeModal()
      const balances = await this.svc.getBalances(this.employeeId)
      this.balances.set(balances)
    } catch (err: any) {
      this.modalError.set(err?.error?.error ?? 'absences.error.create')
    } finally {
      this.submitting.set(false)
    }
  }

  async doCancel(req: AbsenceRequest) {
    try {
      const updated = await this.svc.cancel(req.id)
      this.requests.update(list => list.map(r => r.id === req.id ? updated : r))
      const balances = await this.svc.getBalances(this.employeeId)
      this.balances.set(balances)
    } catch {
      this.error.set('absences.error.cancel')
    }
  }
}
