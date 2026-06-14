import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf, NgFor } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { AbsencesService, AbsenceRequest } from './absences.service'

@Component({
  selector: 'app-approvals-page',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule],
  template: `
    <div class="approvals-page">
      <div class="page-header">
        <h2>{{ 'absences.approvals_queue' | translate }}</h2>
      </div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error() }}</div>
      <div *ngIf="!loading() && requests().length === 0" class="empty-state">
        {{ 'absences.no_pending' | translate }}
      </div>

      <table *ngIf="!loading() && requests().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'absences.table.employee' | translate }}</th>
            <th>{{ 'absences.table.type' | translate }}</th>
            <th>{{ 'absences.table.dates' | translate }}</th>
            <th>{{ 'absences.table.days' | translate }}</th>
            <th>{{ 'absences.table.reason' | translate }}</th>
            <th>{{ 'absences.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of requests()">
            <td>{{ r.employeeId }}</td>
            <td>{{ 'absences.types.' + r.absenceType?.name | translate }}</td>
            <td>{{ r.startDate }} — {{ r.endDate }}</td>
            <td>{{ r.workingDays }}</td>
            <td>{{ r.reason || '—' }}</td>
            <td class="actions">
              <button class="btn btn-sm btn-success" (click)="doApprove(r)">
                {{ 'absences.approve' | translate }}
              </button>
              <button class="btn btn-sm btn-danger" (click)="openRejectModal(r)">
                {{ 'absences.reject' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Reject modal -->
      <div *ngIf="rejectTarget()" class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'absences.reject_title' | translate }}</h3>
          <div class="form-group">
            <label>{{ 'absences.fields.notes' | translate }}</label>
            <input class="input" type="text" [(ngModel)]="rejectNotes" maxlength="500"
              [placeholder]="'absences.fields.notes_placeholder' | translate" />
          </div>
          <div *ngIf="modalError()" class="alert alert-error">{{ modalError() }}</div>
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="closeModal()">{{ 'common.cancel' | translate }}</button>
            <button class="btn btn-danger" (click)="submitReject()" [disabled]="!rejectNotes || submitting()">
              <span *ngIf="submitting()" class="spinner sm"></span>
              {{ 'absences.reject' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .approvals-page { max-width: 1000px; }
    .page-header { display: flex; align-items: center; margin-bottom: 20px; }
    .page-header h2 { font-size: 18px; font-weight: 600; color: #202124; margin: 0; }

    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; }
    .alert-error { background: #fce8e6; color: #c5221f; }
    .empty-state { text-align: center; padding: 40px; color: #9aa0a6; font-size: 14px; }

    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; vertical-align: middle; }
    .data-table tr:last-child td { border-bottom: none; }

    .actions { display: flex; gap: 6px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
    .btn-success { background: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
    .btn-success:hover { background: #ceead6; }
    .btn-danger { background: #fce8e6; color: #c5221f; border: 1px solid #f5c6c3; }
    .btn-danger:hover:not(:disabled) { background: #f5c6c3; }
    .btn-outline { background: #fff; color: #3c4043; border: 1px solid #e8eaed; }
    .btn-outline:hover { background: #f8f9fa; }

    .spinner { width: 14px; height: 14px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; }
    .spinner.sm { display: inline-block; }
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
export class ApprovalsPageComponent implements OnInit {
  private readonly svc = inject(AbsencesService)

  readonly requests    = signal<AbsenceRequest[]>([])
  readonly loading     = signal(false)
  readonly error       = signal<string | null>(null)
  readonly rejectTarget = signal<AbsenceRequest | null>(null)
  readonly submitting  = signal(false)
  readonly modalError  = signal<string | null>(null)

  rejectNotes = ''

  async ngOnInit() {
    this.loading.set(true)
    try {
      const result = await this.svc.getRequests({ status: 'PENDING' })
      this.requests.set(result.data)
    } catch {
      this.error.set('absences.error.load')
    } finally {
      this.loading.set(false)
    }
  }

  async doApprove(req: AbsenceRequest) {
    try {
      await this.svc.approve(req.id)
      this.requests.update(list => list.filter(r => r.id !== req.id))
    } catch {
      this.error.set('absences.error.approve')
    }
  }

  openRejectModal(req: AbsenceRequest) {
    this.rejectNotes = ''
    this.modalError.set(null)
    this.rejectTarget.set(req)
  }

  closeModal() { this.rejectTarget.set(null) }

  async submitReject() {
    const req = this.rejectTarget()
    if (!req || !this.rejectNotes) return
    this.submitting.set(true)
    this.modalError.set(null)
    try {
      await this.svc.reject(req.id, this.rejectNotes)
      this.requests.update(list => list.filter(r => r.id !== req.id))
      this.closeModal()
    } catch {
      this.modalError.set('absences.error.reject')
    } finally {
      this.submitting.set(false)
    }
  }
}
