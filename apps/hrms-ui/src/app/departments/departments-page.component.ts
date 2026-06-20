import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf, NgFor } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { DepartmentsService, Department } from './departments.service'
import { HttpErrorResponse } from '@angular/common/http'

/**
 * Smart component that renders the full department management page.
 * Handles listing, creating, editing (inline form), and deleting departments
 * with an explicit confirmation step before deletion.
 */
@Component({
  selector: 'app-departments-page',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule, TranslateModule],
  template: `
    <div class="dept-page">
      <div class="page-header">
        <div class="header-text">
          <h1>{{ 'departments.title' | translate }}</h1>
          <p class="subtitle">{{ 'departments.subtitle' | translate }}</p>
        </div>
        <button class="btn-primary" (click)="onNew()" *ngIf="!showForm()">
          + {{ 'departments.new_department' | translate }}
        </button>
      </div>

      <!-- Inline create / edit form -->
      <div class="form-card" *ngIf="showForm()">
        <div *ngIf="validationError()" class="alert alert-error">{{ validationError()! | translate }}</div>
        <div *ngIf="formError()" class="alert alert-error">{{ formError()! | translate }}</div>

        <div class="form-row">
          <div class="form-field">
            <label>{{ 'departments.form.name' | translate }} *</label>
            <input
              type="text"
              [(ngModel)]="formName"
              [disabled]="submitting()"
              (keyup.enter)="onSave()"
              autofocus />
          </div>
          <div class="form-actions-inline">
            <button class="btn-secondary" (click)="onCancel()" [disabled]="submitting()">
              {{ 'departments.form.cancel' | translate }}
            </button>
            <button class="btn-primary" (click)="onSave()" [disabled]="submitting()">
              <span *ngIf="submitting()" class="spinner"></span>
              {{ 'departments.form.save' | translate }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete confirmation banner -->
      <div class="confirm-card" *ngIf="confirmTarget()">
        <p class="confirm-text">
          {{ 'departments.confirm_delete' | translate : { name: confirmTarget()!.name } }}
        </p>
        <div class="confirm-actions">
          <button class="btn-secondary" (click)="onDeleteCancel()">
            {{ 'departments.form.cancel' | translate }}
          </button>
          <button class="btn-danger" (click)="onDeleteConfirm()" [disabled]="deleting()">
            <span *ngIf="deleting()" class="spinner"></span>
            {{ 'common.delete' | translate }}
          </button>
        </div>
      </div>

      <!-- Delete error -->
      <div class="alert alert-error mb" *ngIf="deleteError()">{{ deleteError()! | translate }}</div>

      <!-- Loading / error / empty states -->
      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="loadError()" class="alert alert-error">{{ loadError()! | translate }}</div>
      <div *ngIf="!loading() && !loadError() && departments().length === 0" class="empty-state">
        {{ 'departments.empty' | translate }}
      </div>

      <!-- Departments table -->
      <table *ngIf="!loading() && departments().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'departments.table.name' | translate }}</th>
            <th>{{ 'departments.table.created_at' | translate }}</th>
            <th>{{ 'departments.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let dept of departments()">
            <td><strong>{{ dept.name }}</strong></td>
            <td class="date-cell">{{ dept.createdAt | slice:0:10 }}</td>
            <td class="actions-cell">
              <button class="btn-link" (click)="onEdit(dept)">
                {{ 'common.edit' | translate }}
              </button>
              <button class="btn-link btn-link-danger" (click)="onDeleteRequest(dept)">
                {{ 'common.delete' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .dept-page { max-width: 800px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .header-text h1 { font-size: 22px; font-weight: 700; color: #202124; margin: 0 0 4px; }
    .subtitle { font-size: 13.5px; color: #5f6368; margin: 0; }
    .btn-primary { background: #1a73e8; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-primary:disabled { opacity: .6; cursor: default; }
    .btn-secondary { background: none; border: 1px solid #dadce0; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; color: #5f6368; cursor: pointer; }
    .btn-secondary:hover:not(:disabled) { background: #f8f9fa; }
    .btn-secondary:disabled { opacity: .6; cursor: default; }
    .btn-danger { background: #c5221f; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn-danger:hover:not(:disabled) { background: #a50e0e; }
    .btn-danger:disabled { opacity: .6; cursor: default; }
    .btn-link { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 13px; padding: 0 8px 0 0; }
    .btn-link-danger { color: #c5221f; }
    .form-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .confirm-card { background: #fce8e6; border: 1px solid #f28b82; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 20px; justify-content: space-between; }
    .confirm-text { margin: 0; font-size: 13.5px; color: #202124; }
    .confirm-actions { display: flex; gap: 10px; flex-shrink: 0; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; background: #fce8e6; color: #c5221f; }
    .mb { margin-bottom: 16px; }
    .form-row { display: flex; gap: 12px; align-items: flex-end; }
    .form-field { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 12.5px; font-weight: 600; color: #5f6368; }
    .form-field input { border: 1px solid #dadce0; border-radius: 6px; padding: 8px 12px; font-size: 13.5px; color: #202124; outline: none; }
    .form-field input:focus { border-color: #1a73e8; }
    .form-field input:disabled { background: #f8f9fa; cursor: default; }
    .form-actions-inline { display: flex; gap: 10px; flex-shrink: 0; }
    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .empty-state { text-align: center; padding: 48px; color: #9aa0a6; font-size: 14px; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; }
    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover { background: #fafbfc; }
    .date-cell { color: #5f6368; font-size: 12.5px; }
    .actions-cell { white-space: nowrap; }
    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class DepartmentsPageComponent implements OnInit {
  private readonly svc = inject(DepartmentsService)

  readonly departments    = signal<Department[]>([])
  readonly loading        = signal(false)
  readonly loadError      = signal<string | null>(null)
  readonly showForm       = signal(false)
  readonly submitting     = signal(false)
  readonly validationError = signal<string | null>(null)
  readonly formError      = signal<string | null>(null)
  readonly confirmTarget  = signal<Department | null>(null)
  readonly deleting       = signal(false)
  readonly deleteError    = signal<string | null>(null)

  formName = ''
  private editingId: string | null = null

  async ngOnInit(): Promise<void> {
    await this.loadDepartments()
  }

  /** Opens the create form. */
  onNew(): void {
    this.editingId = null
    this.formName = ''
    this.validationError.set(null)
    this.formError.set(null)
    this.showForm.set(true)
  }

  /**
   * Opens the edit form pre-filled with the department's current name.
   *
   * @param dept - the department to edit
   */
  onEdit(dept: Department): void {
    this.editingId = dept.id
    this.formName = dept.name
    this.validationError.set(null)
    this.formError.set(null)
    this.confirmTarget.set(null)
    this.showForm.set(true)
  }

  /** Closes the form without saving. */
  onCancel(): void {
    this.showForm.set(false)
    this.editingId = null
    this.formName = ''
  }

  /**
   * Submits the create or edit form.
   * Shows a validation error when the name is empty.
   * On success reloads the list and closes the form.
   */
  async onSave(): Promise<void> {
    this.validationError.set(null)
    this.formError.set(null)

    if (!this.formName.trim()) {
      this.validationError.set('departments.error.required')
      return
    }

    this.submitting.set(true)
    try {
      if (this.editingId) {
        await this.svc.update(this.editingId, this.formName.trim())
      } else {
        await this.svc.create(this.formName.trim())
      }
      this.showForm.set(false)
      this.editingId = null
      this.formName = ''
      await this.loadDepartments()
    } catch (err) {
      const status = (err as HttpErrorResponse)?.status
      if (status === 409) {
        this.formError.set('departments.error.conflict')
      } else {
        this.formError.set(this.editingId ? 'departments.error.update' : 'departments.error.create')
      }
    } finally {
      this.submitting.set(false)
    }
  }

  /**
   * Requests delete confirmation for the given department.
   *
   * @param dept - the department the user wants to delete
   */
  onDeleteRequest(dept: Department): void {
    this.deleteError.set(null)
    this.showForm.set(false)
    this.confirmTarget.set(dept)
  }

  /** Cancels the pending deletion. */
  onDeleteCancel(): void {
    this.confirmTarget.set(null)
  }

  /**
   * Executes the confirmed deletion.
   * Shows a specific error when the department has active employees.
   */
  async onDeleteConfirm(): Promise<void> {
    const target = this.confirmTarget()
    if (!target) return

    this.deleting.set(true)
    this.deleteError.set(null)
    try {
      await this.svc.delete(target.id)
      this.confirmTarget.set(null)
      await this.loadDepartments()
    } catch (err) {
      const status = (err as HttpErrorResponse)?.status
      this.deleteError.set(status === 409 ? 'departments.delete_blocked' : 'departments.error.delete')
      this.confirmTarget.set(null)
    } finally {
      this.deleting.set(false)
    }
  }

  private async loadDepartments(): Promise<void> {
    this.loading.set(true)
    this.loadError.set(null)
    try {
      const depts = await this.svc.list()
      this.departments.set(depts)
    } catch {
      this.loadError.set('departments.error.load')
    } finally {
      this.loading.set(false)
    }
  }
}
