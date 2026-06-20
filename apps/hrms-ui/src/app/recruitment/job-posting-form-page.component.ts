import { Component, inject, signal } from '@angular/core'
import { NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { RecruitmentService, CreateJobPostingDto } from './recruitment.service'

/**
 * Smart component that renders the job posting creation form.
 * On success navigates back to the postings list.
 */
@Component({
  selector: 'app-job-posting-form-page',
  standalone: true,
  imports: [NgIf, FormsModule, TranslateModule],
  template: `
    <div class="form-page">
      <div class="page-header">
        <button class="btn-back" (click)="goBack()">← {{ 'recruitment.candidate.back' | translate }}</button>
        <h2>{{ 'recruitment.posting_form.title' | translate }}</h2>
      </div>

      <div class="form-card">
        <div *ngIf="error()" class="alert alert-error">{{ error()! | translate }}</div>
        <div *ngIf="validationError()" class="alert alert-error">{{ validationError()! | translate }}</div>

        <div class="form-stack">
          <div class="form-field">
            <label>{{ 'recruitment.posting_form.job_title' | translate }} *</label>
            <input type="text" [(ngModel)]="title" [disabled]="submitting()" />
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.posting_form.department_id' | translate }} *</label>
            <input type="text" [(ngModel)]="departmentId" [disabled]="submitting()" placeholder="UUID" />
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.posting_form.description' | translate }} *</label>
            <textarea rows="4" [(ngModel)]="description" [disabled]="submitting()"></textarea>
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.posting_form.requirements' | translate }}</label>
            <textarea rows="3" [(ngModel)]="requirements" [disabled]="submitting()"
              [placeholder]="'recruitment.posting_form.requirements_placeholder' | translate"></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" (click)="goBack()" [disabled]="submitting()">
            {{ 'recruitment.hire.cancel' | translate }}
          </button>
          <button class="btn-primary" (click)="onSubmit()" [disabled]="submitting()">
            <span *ngIf="submitting()" class="spinner"></span>
            {{ 'recruitment.posting_form.submit' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .form-page { max-width: 640px; }
    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .page-header h2 { font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
    .btn-back { background: none; border: 1px solid #dadce0; border-radius: 6px; padding: 6px 12px; font-size: 13px; color: #5f6368; cursor: pointer; }
    .btn-back:hover { background: #f8f9fa; }
    .form-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 24px; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; background: #fce8e6; color: #c5221f; }
    .form-stack { display: flex; flex-direction: column; gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 12.5px; font-weight: 600; color: #5f6368; }
    .form-field input, .form-field textarea {
      border: 1px solid #dadce0; border-radius: 6px; padding: 8px 12px;
      font-size: 13.5px; color: #202124; outline: none; font-family: inherit; resize: vertical;
    }
    .form-field input:focus, .form-field textarea:focus { border-color: #1a73e8; }
    .form-field input:disabled, .form-field textarea:disabled { background: #f8f9fa; cursor: default; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e8eaed; }
    .btn-secondary { background: none; border: 1px solid #dadce0; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; color: #5f6368; cursor: pointer; }
    .btn-secondary:hover:not(:disabled) { background: #f8f9fa; }
    .btn-primary { background: #1a73e8; color: #fff; border: none; border-radius: 6px; padding: 8px 20px; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-primary:disabled, .btn-secondary:disabled { opacity: .6; cursor: default; }
    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class JobPostingFormPageComponent {
  private readonly svc    = inject(RecruitmentService)
  private readonly router = inject(Router)

  readonly submitting      = signal(false)
  readonly error           = signal<string | null>(null)
  readonly validationError = signal<string | null>(null)

  title        = ''
  departmentId = ''
  description  = ''
  requirements = ''

  /**
   * Validates all required fields and submits the new job posting.
   * On success navigates to the postings list.
   */
  async onSubmit(): Promise<void> {
    this.validationError.set(null)
    this.error.set(null)

    if (!this.title.trim() || !this.departmentId.trim() || !this.description.trim()) {
      this.validationError.set('recruitment.posting_form.error.required')
      return
    }

    const dto: CreateJobPostingDto = {
      title:        this.title.trim(),
      departmentId: this.departmentId.trim(),
      description:  this.description.trim(),
      requirements: this.requirements.trim() || undefined,
    }

    this.submitting.set(true)
    try {
      await this.svc.createJobPosting(dto)
      this.router.navigate(['/recruitment'])
    } catch {
      this.error.set('recruitment.posting_form.error.submit')
    } finally {
      this.submitting.set(false)
    }
  }

  /** Navigates back to the postings list without saving. */
  goBack(): void {
    this.router.navigate(['/recruitment'])
  }
}
