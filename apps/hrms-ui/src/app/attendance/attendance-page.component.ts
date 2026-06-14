import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf, NgFor, DatePipe } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { AuthService } from '../core/services/auth.service'
import { AppModule } from '../core/models/auth.models'
import { AttendanceService, AttendanceRecord, AttendanceSummary } from './attendance.service'

@Component({
  selector: 'app-attendance-page',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule, DatePipe],
  template: `
    <div class="attendance-page">
      <div class="page-header">
        <h2>{{ 'attendance.title' | translate }}</h2>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="doCheckIn()" [disabled]="acting()">
            {{ 'attendance.check_in' | translate }}
          </button>
          <button class="btn btn-secondary" (click)="doCheckOut()" [disabled]="acting()">
            {{ 'attendance.check_out' | translate }}
          </button>
        </div>
      </div>

      <!-- Summary cards -->
      <div *ngIf="summary()" class="summary-grid">
        <div class="summary-card">
          <div class="summary-value">{{ summary()!.presentDays }}</div>
          <div class="summary-label">{{ 'attendance.summary.present' | translate }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">{{ summary()!.absentDays }}</div>
          <div class="summary-label">{{ 'attendance.summary.absent' | translate }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">{{ summary()!.lateDays }}</div>
          <div class="summary-label">{{ 'attendance.summary.late' | translate }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">{{ summary()!.totalHours | number:'1.1-1' }}</div>
          <div class="summary-label">{{ 'attendance.summary.total_hours' | translate }}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <input type="date" [(ngModel)]="filterFrom" (change)="loadRecords()" class="input-sm" />
        <input type="date" [(ngModel)]="filterTo" (change)="loadRecords()" class="input-sm" />
        <select [(ngModel)]="filterStatus" (change)="loadRecords()" class="input-sm">
          <option value="">{{ 'attendance.filter.all_statuses' | translate }}</option>
          <option value="PRESENT">{{ 'attendance.status.PRESENT' | translate }}</option>
          <option value="ABSENT">{{ 'attendance.status.ABSENT' | translate }}</option>
          <option value="LATE">{{ 'attendance.status.LATE' | translate }}</option>
          <option value="ON_LEAVE">{{ 'attendance.status.ON_LEAVE' | translate }}</option>
          <option value="HOLIDAY">{{ 'attendance.status.HOLIDAY' | translate }}</option>
        </select>
      </div>

      <div *ngIf="actionError()" class="alert alert-error">{{ actionError() }}</div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error() }}</div>
      <div *ngIf="!loading() && records().length === 0" class="empty-state">
        {{ 'attendance.no_records' | translate }}
      </div>

      <table *ngIf="!loading() && records().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'attendance.table.date' | translate }}</th>
            <th>{{ 'attendance.table.check_in' | translate }}</th>
            <th>{{ 'attendance.table.check_out' | translate }}</th>
            <th>{{ 'attendance.table.hours' | translate }}</th>
            <th>{{ 'attendance.table.status' | translate }}</th>
            <th>{{ 'attendance.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of records()">
            <td>{{ r.date }}</td>
            <td>{{ r.checkIn ? (r.checkIn | date:'HH:mm') : '—' }}</td>
            <td>{{ r.checkOut ? (r.checkOut | date:'HH:mm') : '—' }}</td>
            <td>{{ r.hoursWorked !== null ? (r.hoursWorked | number:'1.1-1') + 'h' : '—' }}</td>
            <td>
              <span class="badge badge-{{ r.status.toLowerCase() }}">
                {{ 'attendance.status.' + r.status | translate }}
              </span>
            </td>
            <td>
              <button class="btn-link" (click)="openEditModal(r)" *ngIf="canEdit()">
                {{ 'common.edit' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Edit modal -->
      <div class="modal-backdrop" *ngIf="editingRecord()">
        <div class="modal">
          <h3>{{ 'attendance.edit_record' | translate }}</h3>
          <div class="form-group">
            <label>{{ 'attendance.table.check_in' | translate }}</label>
            <input type="datetime-local" [(ngModel)]="editCheckIn" class="form-control" />
          </div>
          <div class="form-group">
            <label>{{ 'attendance.table.check_out' | translate }}</label>
            <input type="datetime-local" [(ngModel)]="editCheckOut" class="form-control" />
          </div>
          <div class="form-group">
            <label>{{ 'attendance.table.status' | translate }}</label>
            <select [(ngModel)]="editStatus" class="form-control">
              <option value="PRESENT">{{ 'attendance.status.PRESENT' | translate }}</option>
              <option value="ABSENT">{{ 'attendance.status.ABSENT' | translate }}</option>
              <option value="LATE">{{ 'attendance.status.LATE' | translate }}</option>
              <option value="ON_LEAVE">{{ 'attendance.status.ON_LEAVE' | translate }}</option>
              <option value="HOLIDAY">{{ 'attendance.status.HOLIDAY' | translate }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ 'attendance.table.notes' | translate }}</label>
            <textarea [(ngModel)]="editNotes" class="form-control" rows="2"></textarea>
          </div>
          <div *ngIf="modalError()" class="alert alert-error">{{ modalError() }}</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="closeEditModal()">
              {{ 'common.cancel' | translate }}
            </button>
            <button class="btn btn-primary" (click)="saveEdit()" [disabled]="acting()">
              {{ 'common.save' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .attendance-page { padding: 24px; max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
    .header-actions { display: flex; gap: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .summary-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-value { font-size: 28px; font-weight: 700; color: #111827; }
    .summary-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .filters-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .input-sm { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .data-table th, .data-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    .data-table th { background: #f9fafb; font-weight: 600; color: #374151; }
    .badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-present { background: #d1fae5; color: #065f46; }
    .badge-absent  { background: #fee2e2; color: #991b1b; }
    .badge-late    { background: #fef3c7; color: #92400e; }
    .badge-on_leave{ background: #dbeafe; color: #1e40af; }
    .badge-holiday { background: #f3e8ff; color: #6d28d9; }
    .btn-link { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 13px; padding: 0; }
    .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #4f46e5; color: #fff; }
    .btn-secondary { background: #f3f4f6; color: #374151; }
    .state-loading { display: flex; align-items: center; gap: 8px; padding: 24px 0; color: #6b7280; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e5e7eb; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { padding: 48px; text-align: center; color: #9ca3af; }
    .alert-error { background: #fee2e2; color: #991b1b; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 14px; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal { background: #fff; border-radius: 12px; padding: 24px; width: 400px; max-width: 90vw; }
    .modal h3 { margin: 0 0 20px; font-size: 16px; font-weight: 600; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    .form-control { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
  `],
})
export class AttendancePageComponent implements OnInit {
  private readonly svc = inject(AttendanceService)
  private readonly auth = inject(AuthService)

  records   = signal<AttendanceRecord[]>([])
  summary   = signal<AttendanceSummary | null>(null)
  loading   = signal(false)
  error     = signal('')
  acting    = signal(false)
  actionError = signal('')

  filterFrom   = this.firstDayOfMonth()
  filterTo     = this.today()
  filterStatus = ''

  editingRecord = signal<AttendanceRecord | null>(null)
  editCheckIn  = ''
  editCheckOut = ''
  editStatus   = 'PRESENT'
  editNotes    = ''
  modalError   = signal('')

  canEdit(): boolean {
    return this.auth.hasPermission(AppModule.ATTENDANCE, 'canEdit')
  }

  ngOnInit(): void {
    this.loadRecords()
    this.loadSummary()
  }

  async loadRecords(): Promise<void> {
    this.loading.set(true)
    this.error.set('')
    try {
      const user = this.auth.currentUser()
      const result = await this.svc.list({
        employeeId: user?.employeeId ?? undefined,
        status:     this.filterStatus || undefined,
        from:       this.filterFrom || undefined,
        to:         this.filterTo   || undefined,
      })
      this.records.set(result.data)
    } catch {
      this.error.set('attendance.error.load_failed')
    } finally {
      this.loading.set(false)
    }
  }

  async loadSummary(): Promise<void> {
    const user = this.auth.currentUser()
    if (!user?.employeeId) return
    try {
      const s = await this.svc.getSummary(user.employeeId, this.filterFrom, this.filterTo)
      this.summary.set(s)
    } catch { /* summary is non-blocking */ }
  }

  async doCheckIn(): Promise<void> {
    const user = this.auth.currentUser()
    if (!user?.employeeId) return
    this.acting.set(true)
    this.actionError.set('')
    try {
      await this.svc.checkIn(user.employeeId, new Date().toISOString())
      await this.loadRecords()
      await this.loadSummary()
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'attendance.error.check_in_failed')
    } finally {
      this.acting.set(false)
    }
  }

  async doCheckOut(): Promise<void> {
    const user = this.auth.currentUser()
    if (!user?.employeeId) return
    this.acting.set(true)
    this.actionError.set('')
    try {
      await this.svc.checkOut(user.employeeId, new Date().toISOString())
      await this.loadRecords()
      await this.loadSummary()
    } catch (err: any) {
      this.actionError.set(err?.error?.error ?? 'attendance.error.check_out_failed')
    } finally {
      this.acting.set(false)
    }
  }

  openEditModal(r: AttendanceRecord): void {
    this.editingRecord.set(r)
    this.editCheckIn  = r.checkIn  ? this.toLocalDatetime(r.checkIn)  : ''
    this.editCheckOut = r.checkOut ? this.toLocalDatetime(r.checkOut) : ''
    this.editStatus   = r.status
    this.editNotes    = r.notes ?? ''
    this.modalError.set('')
  }

  closeEditModal(): void {
    this.editingRecord.set(null)
  }

  async saveEdit(): Promise<void> {
    const r = this.editingRecord()
    if (!r) return
    this.acting.set(true)
    this.modalError.set('')
    try {
      await this.svc.edit(r.id, {
        checkIn:  this.editCheckIn  ? new Date(this.editCheckIn).toISOString()  : undefined,
        checkOut: this.editCheckOut ? new Date(this.editCheckOut).toISOString() : undefined,
        status:   this.editStatus,
        notes:    this.editNotes,
      })
      this.closeEditModal()
      await this.loadRecords()
      await this.loadSummary()
    } catch (err: any) {
      this.modalError.set(err?.error?.error ?? 'attendance.error.edit_failed')
    } finally {
      this.acting.set(false)
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private firstDayOfMonth(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  private toLocalDatetime(iso: string): string {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}
