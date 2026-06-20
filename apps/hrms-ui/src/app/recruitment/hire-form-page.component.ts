import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { RecruitmentService, HireDto } from './recruitment.service'

/**
 * Smart component that renders the candidate hire form.
 * On success, navigates to the newly created employee detail page.
 * Reads the candidate id from the route parameter `id`.
 */
@Component({
  selector: 'app-hire-form-page',
  standalone: true,
  imports: [NgIf, FormsModule, TranslateModule],
  template: `
    <div class="hire-page">
      <div class="page-header">
        <button class="btn-back" (click)="goBack()">← {{ 'recruitment.candidate.back' | translate }}</button>
        <h2>{{ 'recruitment.hire.title' | translate }}</h2>
      </div>

      <div class="form-card">
        <div *ngIf="error()" class="alert alert-error">{{ error()! | translate }}</div>
        <div *ngIf="validationError()" class="alert alert-error">{{ validationError()! | translate }}</div>

        <div class="form-grid">
          <div class="form-field">
            <label>{{ 'recruitment.hire.hire_date' | translate }} *</label>
            <input type="date" [(ngModel)]="hireDate" [disabled]="submitting()" />
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.hire.salary' | translate }} *</label>
            <input type="number" [(ngModel)]="salary" [disabled]="submitting()" min="1" placeholder="0" />
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.hire.department_id' | translate }} *</label>
            <input type="text" [(ngModel)]="departmentId" [disabled]="submitting()" placeholder="UUID" />
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.hire.job_title' | translate }} *</label>
            <input type="text" [(ngModel)]="jobTitle" [disabled]="submitting()" />
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.hire.corporate_email' | translate }} *</label>
            <input type="email" [(ngModel)]="corporateEmail" [disabled]="submitting()" placeholder="nombre@empresa.com" />
          </div>

          <div class="form-field">
            <label>{{ 'recruitment.hire.document_id' | translate }} *</label>
            <input type="text" [(ngModel)]="documentId" [disabled]="submitting()" />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-secondary" (click)="goBack()" [disabled]="submitting()">
            {{ 'recruitment.hire.cancel' | translate }}
          </button>
          <button class="btn-hire" (click)="onSubmit()" [disabled]="submitting()">
            <span *ngIf="submitting()" class="spinner"></span>
            {{ 'recruitment.hire.submit' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hire-page { max-width: 640px; }
    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .page-header h2 { font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
    .btn-back { background: none; border: 1px solid #dadce0; border-radius: 6px; padding: 6px 12px; font-size: 13px; color: #5f6368; cursor: pointer; }
    .btn-back:hover { background: #f8f9fa; }
    .form-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 24px; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; background: #fce8e6; color: #c5221f; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field label { font-size: 12.5px; font-weight: 600; color: #5f6368; }
    .form-field input { border: 1px solid #dadce0; border-radius: 6px; padding: 8px 12px; font-size: 13.5px; color: #202124; outline: none; }
    .form-field input:focus { border-color: #1a73e8; }
    .form-field input:disabled { background: #f8f9fa; cursor: default; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e8eaed; }
    .btn-secondary { background: none; border: 1px solid #dadce0; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; color: #5f6368; cursor: pointer; }
    .btn-secondary:hover:not(:disabled) { background: #f8f9fa; }
    .btn-hire { background: #137333; color: #fff; border: none; border-radius: 6px; padding: 8px 20px; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .btn-hire:hover:not(:disabled) { background: #0d5225; }
    .btn-hire:disabled { opacity: .6; cursor: default; }
    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class HireFormPageComponent implements OnInit {
  private readonly svc    = inject(RecruitmentService)
  private readonly route  = inject(ActivatedRoute)
  private readonly router = inject(Router)

  readonly submitting     = signal(false)
  readonly error          = signal<string | null>(null)
  readonly validationError = signal<string | null>(null)

  hireDate       = ''
  salary         = 0
  departmentId   = ''
  jobTitle       = ''
  corporateEmail = ''
  documentId     = ''

  private candidateId = ''

  ngOnInit(): void {
    this.candidateId = this.route.snapshot.paramMap.get('id') ?? ''
  }

  /**
   * Validates form fields and submits the hire transaction.
   * On success navigates to the new employee detail page.
   */
  async onSubmit(): Promise<void> {
    this.validationError.set(null)
    this.error.set(null)

    if (!this.hireDate || !this.salary || !this.departmentId || !this.jobTitle || !this.corporateEmail || !this.documentId) {
      this.validationError.set('recruitment.hire.error.required')
      return
    }

    if (this.salary <= 0) {
      this.validationError.set('recruitment.hire.error.salary')
      return
    }

    const dto: HireDto = {
      hireDate:       this.hireDate,
      salary:         this.salary,
      departmentId:   this.departmentId,
      jobTitle:       this.jobTitle,
      corporateEmail: this.corporateEmail,
      documentId:     this.documentId,
    }

    this.submitting.set(true)
    try {
      const result = await this.svc.hireCandidate(this.candidateId, dto)
      this.router.navigate(['/employees', result.employeeId])
    } catch {
      this.error.set('recruitment.hire.error.submit')
    } finally {
      this.submitting.set(false)
    }
  }

  /** Navigates back to the candidate profile page. */
  goBack(): void {
    this.router.navigate(['/recruitment/candidate', this.candidateId])
  }
}
