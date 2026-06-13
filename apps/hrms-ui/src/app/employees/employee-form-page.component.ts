import { Component, inject, signal, OnInit } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import {
  EmployeesService,
  type Department,
  type EmployeeDetail,
  type EmployeeStatus,
} from './employees.service'

@Component({
  selector: 'app-employee-form-page',
  standalone: true,
  imports: [TranslateModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="form-page">
      <!-- Header -->
      <div class="page-header">
        <button class="back-btn" (click)="goBack()">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 class="page-title">
            {{ (isEdit() ? 'employees.form.title_edit' : 'employees.form.title_create') | translate }}
          </h1>
          <p class="page-subtitle">{{ 'employees.form.subtitle' | translate }}</p>
        </div>
      </div>

      @if (loadError()) {
        <div class="state-error" role="alert">{{ 'common.error.generic' | translate }}</div>
      } @else if (isEdit() && !employee()) {
        <div class="state-loading">
          <span class="spinner"></span>{{ 'common.loading' | translate }}
        </div>
      } @else {
        <form class="form-card" [formGroup]="form" (ngSubmit)="submit()">
          <!-- Personal info section -->
          <div class="form-section">
            <h2 class="section-title">{{ 'employees.detail.personal_info' | translate }}</h2>
            <div class="fields-grid">
              <div class="field-group">
                <label class="field-label" for="fullName">
                  {{ 'employees.fields.full_name' | translate }} *
                </label>
                <input
                  id="fullName"
                  class="field-input"
                  [class.invalid]="touched('fullName')"
                  type="text"
                  formControlName="fullName"
                  [placeholder]="'employees.fields.full_name' | translate"
                />
                @if (touched('fullName')) {
                  <p class="field-error">{{ 'common.validation.required' | translate }}</p>
                }
              </div>

              <div class="field-group">
                <label class="field-label" for="documentId">
                  {{ 'employees.fields.document_id' | translate }} *
                </label>
                <input
                  id="documentId"
                  class="field-input"
                  [class.invalid]="touched('documentId')"
                  type="text"
                  formControlName="documentId"
                  [placeholder]="'employees.fields.document_id' | translate"
                  [readonly]="isEdit()"
                />
                @if (touched('documentId')) {
                  <p class="field-error">{{ 'common.validation.required' | translate }}</p>
                }
              </div>

              <div class="field-group">
                <label class="field-label" for="corporateEmail">
                  {{ 'employees.fields.corporate_email' | translate }} *
                </label>
                <input
                  id="corporateEmail"
                  class="field-input"
                  [class.invalid]="touched('corporateEmail')"
                  type="email"
                  formControlName="corporateEmail"
                  [placeholder]="'employees.fields.corporate_email_placeholder' | translate"
                  [readonly]="isEdit()"
                />
                @if (touched('corporateEmail')) {
                  <p class="field-error">{{ 'common.validation.email_format' | translate }}</p>
                }
              </div>
            </div>
          </div>

          <!-- Job info section -->
          <div class="form-section">
            <h2 class="section-title">{{ 'employees.detail.job_info' | translate }}</h2>
            <div class="fields-grid">
              <div class="field-group">
                <label class="field-label" for="departmentId">
                  {{ 'employees.fields.department' | translate }} *
                </label>
                <select
                  id="departmentId"
                  class="field-input"
                  [class.invalid]="touched('departmentId')"
                  formControlName="departmentId"
                >
                  <option value="">{{ 'employees.filters.all_departments' | translate }}</option>
                  @for (dept of departments(); track dept.id) {
                    <option [value]="dept.id">{{ dept.name }}</option>
                  }
                </select>
                @if (touched('departmentId')) {
                  <p class="field-error">{{ 'common.validation.required' | translate }}</p>
                }
              </div>

              <div class="field-group">
                <label class="field-label" for="jobTitle">
                  {{ 'employees.fields.job_title' | translate }} *
                </label>
                <input
                  id="jobTitle"
                  class="field-input"
                  [class.invalid]="touched('jobTitle')"
                  type="text"
                  formControlName="jobTitle"
                  [placeholder]="'employees.fields.job_title' | translate"
                />
                @if (touched('jobTitle')) {
                  <p class="field-error">{{ 'common.validation.required' | translate }}</p>
                }
              </div>

              <div class="field-group">
                <label class="field-label" for="salary">
                  {{ 'employees.fields.salary' | translate }} *
                </label>
                <input
                  id="salary"
                  class="field-input"
                  [class.invalid]="touched('salary')"
                  type="number"
                  min="0"
                  formControlName="salary"
                />
                @if (touched('salary')) {
                  <p class="field-error">{{ 'common.validation.required' | translate }}</p>
                }
              </div>

              @if (!isEdit()) {
                <div class="field-group">
                  <label class="field-label" for="hireDate">
                    {{ 'employees.fields.hire_date' | translate }} *
                  </label>
                  <input
                    id="hireDate"
                    class="field-input"
                    [class.invalid]="touched('hireDate')"
                    type="date"
                    formControlName="hireDate"
                  />
                  @if (touched('hireDate')) {
                    <p class="field-error">{{ 'common.validation.required' | translate }}</p>
                  }
                </div>
              }

              @if (isEdit()) {
                <div class="field-group">
                  <label class="field-label" for="status">
                    {{ 'employees.fields.status' | translate }}
                  </label>
                  <select id="status" class="field-input" formControlName="status">
                    <option value="ACTIVE">{{ 'employees.status.ACTIVE' | translate }}</option>
                    <option value="REMOTE">{{ 'employees.status.REMOTE' | translate }}</option>
                    <option value="ON_LEAVE">{{ 'employees.status.ON_LEAVE' | translate }}</option>
                  </select>
                </div>
              }
            </div>
          </div>

          @if (submitError()) {
            <div class="submit-error" role="alert">{{ submitError() }}</div>
          }

          <div class="form-actions">
            <button type="button" class="btn-secondary" (click)="goBack()">
              {{ 'common.cancel' | translate }}
            </button>
            <button type="submit" class="btn-primary" [disabled]="submitting()">
              @if (submitting()) { <span class="spinner sm"></span> }
              {{ (isEdit() ? 'common.save' : 'employees.form.create_btn') | translate }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    .form-page { max-width: 720px; }

    .page-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
    .back-btn { width: 36px; height: 36px; border: 1px solid #e8eaed; border-radius: 8px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .back-btn:hover { background: #f8f9fa; }
    .back-btn .material-symbols-outlined { font-size: 20px; }
    .page-title { font-size: 20px; font-weight: 600; color: #202124; margin: 0 0 4px; }
    .page-subtitle { font-size: 13px; color: #5f6368; margin: 0; }

    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .state-error { display: flex; align-items: center; gap: 10px; padding: 24px; border-radius: 10px; background: #fce8e6; color: #c5221f; font-size: 14px; }
    .spinner { width: 18px; height: 18px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; flex-shrink: 0; }
    .spinner.sm { width: 14px; height: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .form-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .form-section { padding: 24px; border-bottom: 1px solid #f1f3f4; }
    .form-section:last-of-type { border-bottom: none; }
    .section-title { font-size: 13px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; margin: 0 0 18px; }
    .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 12px; font-weight: 500; color: #5f6368; }
    .field-input {
      height: 38px; border: 1px solid #e8eaed; border-radius: 8px; padding: 0 12px;
      font-size: 13.5px; color: #202124; outline: none; font-family: inherit;
      background: #fff; width: 100%; box-sizing: border-box;
    }
    .field-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,.12); }
    .field-input.invalid { border-color: #d93025; }
    .field-input[readonly] { background: #f8f9fa; color: #5f6368; }
    .field-error { font-size: 11.5px; color: #d93025; margin: 0; }

    .submit-error { margin: 16px 24px; padding: 12px 16px; background: #fce8e6; border-radius: 8px; color: #c5221f; font-size: 13.5px; }

    .form-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 20px 24px; border-top: 1px solid #f1f3f4; }
    .btn-primary {
      display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 20px;
      background: #1a73e8; color: #fff; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
    }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
    .btn-secondary {
      display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 18px;
      background: #fff; color: #3c4043; border: 1px solid #e8eaed; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
    }
    .btn-secondary:hover { background: #f8f9fa; }
  `],
})
export class EmployeeFormPageComponent implements OnInit {
  protected readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)
  private readonly svc = inject(EmployeesService)
  private readonly fb = inject(FormBuilder)

  readonly isEdit = signal(false)
  readonly employee = signal<EmployeeDetail | null>(null)
  readonly departments = signal<Department[]>([])
  readonly loadError = signal(false)
  readonly submitting = signal(false)
  readonly submitError = signal<string | null>(null)

  readonly form = this.fb.group({
    fullName:       ['', Validators.required],
    documentId:     ['', Validators.required],
    corporateEmail: ['', [Validators.required, Validators.email]],
    departmentId:   ['', Validators.required],
    jobTitle:       ['', Validators.required],
    salary:         [0,  Validators.required],
    hireDate:       ['', Validators.required],
    status:         ['ACTIVE' as EmployeeStatus],
  })

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')
    this.isEdit.set(!!id)

    try {
      const [depts] = await Promise.all([
        this.svc.getDepartments(),
        id ? this.loadEmployee(id) : Promise.resolve(),
      ])
      this.departments.set(depts)
    } catch {
      this.loadError.set(true)
    }
  }

  private async loadEmployee(id: string): Promise<void> {
    const emp = await this.svc.getEmployee(id)
    this.employee.set(emp)
    this.form.patchValue({
      fullName:       emp.fullName,
      documentId:     emp.documentId,
      corporateEmail: emp.corporateEmail,
      departmentId:   emp.department.id,
      jobTitle:       emp.jobTitle,
      salary:         emp.salary,
      status:         emp.status as EmployeeStatus,
    })
    this.form.get('hireDate')?.clearValidators()
    this.form.get('hireDate')?.updateValueAndValidity()
  }

  touched(field: string): boolean {
    const ctrl = this.form.get(field)
    return !!(ctrl?.invalid && ctrl?.touched)
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched()
    if (this.form.invalid) return

    this.submitting.set(true)
    this.submitError.set(null)
    const v = this.form.getRawValue()

    try {
      if (this.isEdit()) {
        await this.svc.updateEmployee(this.employee()!.id, {
          fullName:     v.fullName!,
          departmentId: v.departmentId!,
          jobTitle:     v.jobTitle!,
          salary:       Number(v.salary),
          status:       v.status as Exclude<EmployeeStatus, 'INACTIVE'>,
        })
        await this.router.navigate(['/employees', this.employee()!.id])
      } else {
        const created = await this.svc.createEmployee({
          fullName:       v.fullName!,
          documentId:     v.documentId!,
          corporateEmail: v.corporateEmail!,
          departmentId:   v.departmentId!,
          jobTitle:       v.jobTitle!,
          salary:         Number(v.salary),
          hireDate:       v.hireDate!,
        })
        await this.router.navigate(['/employees', created.id])
      }
    } catch {
      this.submitError.set('employees.form.error_save')
    } finally {
      this.submitting.set(false)
    }
  }

  goBack(): void {
    if (this.isEdit() && this.employee()) {
      this.router.navigate(['/employees', this.employee()!.id])
    } else {
      this.router.navigate(['/employees'])
    }
  }
}
