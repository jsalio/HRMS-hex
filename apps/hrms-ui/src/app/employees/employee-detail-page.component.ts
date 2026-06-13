import { Component, inject, signal, OnInit } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { SlicePipe, DecimalPipe } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { EmployeesService, type EmployeeDetail, type OnboardingDTO } from './employees.service'
import { AuthService } from '../core/services/auth.service'
import { AppModule } from '../core/models/auth.models'

type Tab = 'info' | 'onboarding'

@Component({
  selector: 'app-employee-detail-page',
  standalone: true,
  imports: [TranslateModule, FormsModule, RouterLink, SlicePipe, DecimalPipe],
  template: `
    <div class="detail-page">
      <!-- Back + Header -->
      <div class="page-header">
        <button class="back-btn" (click)="router.navigate(['/employees'])">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="header-main">
          @if (employee()) {
            <div class="employee-identity">
              <div class="avatar-lg">{{ employee()!.fullName.charAt(0) }}</div>
              <div>
                <h1 class="employee-name">{{ employee()!.fullName }}</h1>
                <p class="employee-meta">{{ employee()!.jobTitle }} · {{ employee()!.department.name }}</p>
              </div>
              <span class="status-badge" [attr.data-status]="employee()!.status">
                {{ 'employees.status.' + employee()!.status | translate }}
              </span>
            </div>
          } @else {
            <div class="skeleton-header"></div>
          }
        </div>
        @if (employee() && canEdit()) {
          <div class="header-actions">
            @if (employee()!.status !== 'INACTIVE') {
              <button class="btn-danger" (click)="showTerminateModal = true">
                <span class="material-symbols-outlined">person_off</span>
                {{ 'employees.actions.terminate' | translate }}
              </button>
              <a class="btn-primary" [routerLink]="['/employees', employee()!.id, 'edit']">
                <span class="material-symbols-outlined">edit</span>
                {{ 'common.edit' | translate }}
              </a>
            }
          </div>
        }
      </div>

      @if (loadError()) {
        <div class="state-error" role="alert">{{ 'common.error.generic' | translate }}</div>
      } @else if (!employee()) {
        <div class="state-loading">
          <span class="spinner"></span>{{ 'common.loading' | translate }}
        </div>
      } @else {
        <!-- Tabs -->
        <div class="tabs">
          <button class="tab" [class.active]="activeTab() === 'info'" (click)="activeTab.set('info')">
            <span class="material-symbols-outlined">person</span>
            {{ 'employees.detail.tab_info' | translate }}
          </button>
          <button class="tab" [class.active]="activeTab() === 'onboarding'" (click)="openOnboarding()">
            <span class="material-symbols-outlined">checklist</span>
            {{ 'employees.detail.tab_onboarding' | translate }}
          </button>
        </div>

        <!-- Info tab -->
        @if (activeTab() === 'info') {
          <div class="tab-content">
            <div class="info-grid">
              <div class="info-section">
                <h2 class="section-title">{{ 'employees.detail.personal_info' | translate }}</h2>
                <dl class="field-list">
                  <div class="field-row">
                    <dt>{{ 'employees.fields.full_name' | translate }}</dt>
                    <dd>{{ employee()!.fullName }}</dd>
                  </div>
                  <div class="field-row">
                    <dt>{{ 'employees.fields.document_id' | translate }}</dt>
                    <dd>{{ employee()!.documentId }}</dd>
                  </div>
                  <div class="field-row">
                    <dt>{{ 'employees.fields.corporate_email' | translate }}</dt>
                    <dd>{{ employee()!.corporateEmail }}</dd>
                  </div>
                </dl>
              </div>
              <div class="info-section">
                <h2 class="section-title">{{ 'employees.detail.job_info' | translate }}</h2>
                <dl class="field-list">
                  <div class="field-row">
                    <dt>{{ 'employees.fields.department' | translate }}</dt>
                    <dd>{{ employee()!.department.name }}</dd>
                  </div>
                  <div class="field-row">
                    <dt>{{ 'employees.fields.job_title' | translate }}</dt>
                    <dd>{{ employee()!.jobTitle }}</dd>
                  </div>
                  <div class="field-row">
                    <dt>{{ 'employees.fields.salary' | translate }}</dt>
                    <dd>{{ employee()!.salary | number:'1.2-2' }}</dd>
                  </div>
                  <div class="field-row">
                    <dt>{{ 'employees.fields.hire_date' | translate }}</dt>
                    <dd>{{ employee()!.hireDate | slice:0:10 }}</dd>
                  </div>
                  @if (employee()!.terminationDate) {
                    <div class="field-row">
                      <dt>{{ 'employees.fields.termination_date' | translate }}</dt>
                      <dd class="termination-date">{{ employee()!.terminationDate! | slice:0:10 }}</dd>
                    </div>
                  }
                </dl>
              </div>
            </div>
          </div>
        }

        <!-- Onboarding tab -->
        @if (activeTab() === 'onboarding') {
          <div class="tab-content">
            <div class="onboarding-list">
              @if (onboardingLoading()) {
                <div class="state-loading">
                  <span class="spinner"></span>{{ 'common.loading' | translate }}
                </div>
              } @else {
                @for (step of onboarding(); track step.id) {
                  <div class="onboarding-step" [class.completed]="step.completed">
                    <button
                      class="step-toggle"
                      [disabled]="employee()!.status === 'INACTIVE' || !canEdit()"
                      (click)="toggleStep(step)"
                    >
                      <span class="material-symbols-outlined step-icon">
                        {{ step.completed ? 'check_circle' : 'radio_button_unchecked' }}
                      </span>
                    </button>
                    <div class="step-body">
                      <p class="step-name">{{ 'employees.onboarding.' + step.step | translate }}</p>
                      @if (step.completedAt) {
                        <p class="step-date">{{ step.completedAt | slice:0:10 }}</p>
                      }
                      @if (step.notes) {
                        <p class="step-notes">{{ step.notes }}</p>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        }
      }

      <!-- Terminate modal -->
      @if (showTerminateModal) {
        <div class="modal-backdrop" (click)="showTerminateModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2 class="modal-title">{{ 'employees.terminate.title' | translate }}</h2>
            <p class="modal-body">{{ 'employees.terminate.confirm_text' | translate:{ name: employee()?.fullName } }}</p>
            <div class="modal-field">
              <label class="field-label">{{ 'employees.fields.termination_date' | translate }}</label>
              <input type="date" class="field-input" [(ngModel)]="terminationDateValue" />
            </div>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showTerminateModal = false">{{ 'common.cancel' | translate }}</button>
              <button class="btn-danger" [disabled]="!terminationDateValue || terminating()" (click)="terminate()">
                @if (terminating()) { <span class="spinner sm"></span> }
                {{ 'employees.actions.terminate' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-page { max-width: 900px; }

    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .back-btn { width: 36px; height: 36px; border: 1px solid #e8eaed; border-radius: 8px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .back-btn:hover { background: #f8f9fa; }
    .back-btn .material-symbols-outlined { font-size: 20px; }
    .header-main { flex: 1; }
    .employee-identity { display: flex; align-items: center; gap: 14px; }
    .avatar-lg { width: 48px; height: 48px; border-radius: 50%; background: #1a73e8; color: #fff; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .employee-name { font-size: 18px; font-weight: 600; color: #202124; margin: 0 0 2px; }
    .employee-meta { font-size: 13px; color: #5f6368; margin: 0; }
    .header-actions { display: flex; gap: 8px; }
    .skeleton-header { height: 48px; background: #f1f3f4; border-radius: 8px; width: 300px; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }

    .status-badge { padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
    .status-badge[data-status="ACTIVE"]   { background: #e6f4ea; color: #137333; }
    .status-badge[data-status="REMOTE"]   { background: #e8f0fe; color: #1a73e8; }
    .status-badge[data-status="ON_LEAVE"] { background: #fef7e0; color: #7a5200; }
    .status-badge[data-status="INACTIVE"] { background: #f1f3f4; color: #80868b; }

    .btn-primary {
      display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px;
      background: #1a73e8; color: #fff; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: none; font-family: inherit;
    }
    .btn-primary:hover { background: #1557b0; }
    .btn-primary .material-symbols-outlined { font-size: 18px; }
    .btn-secondary {
      display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px;
      background: #fff; color: #3c4043; border: 1px solid #e8eaed; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
    }
    .btn-secondary:hover { background: #f8f9fa; }
    .btn-danger {
      display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px;
      background: #fff; color: #d93025; border: 1px solid #f5c6c3; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
    }
    .btn-danger:hover:not(:disabled) { background: #fce8e6; }
    .btn-danger:disabled { opacity: .5; cursor: not-allowed; }
    .btn-danger .material-symbols-outlined { font-size: 18px; }

    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .state-error { display: flex; align-items: center; gap: 10px; padding: 24px; border-radius: 10px; background: #fce8e6; color: #c5221f; font-size: 14px; }
    .spinner { width: 18px; height: 18px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; flex-shrink: 0; }
    .spinner.sm { width: 14px; height: 14px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .tabs { display: flex; gap: 4px; border-bottom: 1px solid #e8eaed; margin-bottom: 24px; }
    .tab { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; background: none; border: none; border-bottom: 2px solid transparent; color: #5f6368; font-size: 13.5px; font-weight: 500; cursor: pointer; font-family: inherit; margin-bottom: -1px; transition: color 100ms; }
    .tab:hover { color: #202124; }
    .tab.active { color: #1a73e8; border-bottom-color: #1a73e8; }
    .tab .material-symbols-outlined { font-size: 18px; }

    .tab-content { animation: fadeIn 150ms ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .info-section { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 20px; }
    .section-title { font-size: 13px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; margin: 0 0 16px; }
    .field-list { display: flex; flex-direction: column; gap: 12px; margin: 0; }
    .field-row { display: flex; flex-direction: column; gap: 2px; }
    .field-row dt { font-size: 11.5px; color: #9aa0a6; font-weight: 500; }
    .field-row dd { font-size: 13.5px; color: #202124; margin: 0; }
    .termination-date { color: #d93025; }

    .onboarding-list { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .onboarding-step { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-bottom: 1px solid #f8f9fa; transition: background 100ms; }
    .onboarding-step:last-child { border-bottom: none; }
    .onboarding-step.completed { background: #f8fffe; }
    .step-toggle { background: none; border: none; cursor: pointer; padding: 0; line-height: 0; }
    .step-toggle:disabled { cursor: not-allowed; opacity: .5; }
    .step-icon { font-size: 22px; color: #dadce0; }
    .completed .step-icon { color: #137333; font-variation-settings: 'FILL' 1; }
    .step-body { flex: 1; }
    .step-name { font-size: 14px; font-weight: 500; color: #202124; margin: 0 0 2px; }
    .step-date { font-size: 12px; color: #9aa0a6; margin: 0; }
    .step-notes { font-size: 12px; color: #5f6368; margin: 4px 0 0; font-style: italic; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.32); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 12px; padding: 28px; max-width: 440px; width: calc(100% - 40px); }
    .modal-title { font-size: 17px; font-weight: 600; color: #202124; margin: 0 0 10px; }
    .modal-body { font-size: 13.5px; color: #5f6368; margin: 0 0 20px; }
    .modal-field { margin-bottom: 24px; }
    .field-label { display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 6px; }
    .field-input { width: 100%; height: 38px; border: 1px solid #e8eaed; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #202124; outline: none; font-family: inherit; box-sizing: border-box; }
    .field-input:focus { border-color: #1a73e8; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  `],
})
export class EmployeeDetailPageComponent implements OnInit {
  protected readonly router = inject(Router)
  private readonly route = inject(ActivatedRoute)
  private readonly svc = inject(EmployeesService)
  private readonly auth = inject(AuthService)

  readonly employee = signal<EmployeeDetail | null>(null)
  readonly loadError = signal(false)
  readonly activeTab = signal<Tab>('info')
  readonly onboarding = signal<OnboardingDTO[]>([])
  readonly onboardingLoading = signal(false)
  readonly terminating = signal(false)

  showTerminateModal = false
  terminationDateValue = ''

  canEdit = () => this.auth.hasPermission(AppModule.EMPLOYEES, 'canEdit')

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!
    try {
      const emp = await this.svc.getEmployee(id)
      this.employee.set(emp)
      this.onboarding.set(emp.onboarding)
    } catch {
      this.loadError.set(true)
    }
  }

  async openOnboarding(): Promise<void> {
    this.activeTab.set('onboarding')
    if (this.onboarding().length > 0) return
    this.onboardingLoading.set(true)
    try {
      const steps = await this.svc.getOnboarding(this.employee()!.id)
      this.onboarding.set(steps)
    } finally {
      this.onboardingLoading.set(false)
    }
  }

  async toggleStep(step: OnboardingDTO): Promise<void> {
    const updated = await this.svc.updateOnboardingStep(
      this.employee()!.id, step.step, !step.completed
    )
    this.onboarding.update(steps => steps.map(s => s.id === step.id ? updated : s))
  }

  async terminate(): Promise<void> {
    if (!this.terminationDateValue) return
    this.terminating.set(true)
    try {
      await this.svc.terminateEmployee(this.employee()!.id, this.terminationDateValue)
      this.showTerminateModal = false
      await this.router.navigate(['/employees'])
    } finally {
      this.terminating.set(false)
    }
  }
}
