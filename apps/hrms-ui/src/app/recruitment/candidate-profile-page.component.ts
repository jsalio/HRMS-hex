import { Component, OnInit, inject, signal, computed } from '@angular/core'
import { NgIf, NgClass } from '@angular/common'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { RecruitmentService, Candidate, CandidateStatus } from './recruitment.service'
import { CandidatePipelineStepperComponent } from './candidate-pipeline-stepper.component'

const NEXT_STATUS: Partial<Record<CandidateStatus, CandidateStatus>> = {
  APPLIED:   'SCREENING',
  SCREENING: 'INTERVIEW',
  INTERVIEW: 'OFFER',
}

const TERMINAL_STATUSES: CandidateStatus[] = ['HIRED', 'REJECTED']

/**
 * Smart component that shows a candidate's full profile with pipeline
 * stepper and action buttons (advance, reject, hire).
 * Reads the candidate id from the route.
 */
@Component({
  selector: 'app-candidate-profile-page',
  standalone: true,
  imports: [NgIf, NgClass, TranslateModule, CandidatePipelineStepperComponent],
  template: `
    <div class="profile-page">
      <div class="page-header">
        <button class="btn-back" (click)="goBack()">← {{ 'recruitment.candidate.back' | translate }}</button>
        <h2>{{ 'recruitment.profile.title' | translate }}</h2>
      </div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error()! | translate }}</div>

      <ng-container *ngIf="!loading() && candidate()">
        <div class="profile-card">
          <div class="profile-info">
            <div class="info-row">
              <span class="label">{{ 'recruitment.profile.name' | translate }}</span>
              <span class="value">{{ candidate()!.fullName }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ 'recruitment.profile.email' | translate }}</span>
              <span class="value">{{ candidate()!.email }}</span>
            </div>
            <div class="info-row" *ngIf="candidate()!.phone">
              <span class="label">{{ 'recruitment.profile.phone' | translate }}</span>
              <span class="value">{{ candidate()!.phone }}</span>
            </div>
            <div class="info-row" *ngIf="candidate()!.resumeUrl">
              <span class="label">{{ 'recruitment.profile.resume' | translate }}</span>
              <a class="value link" [href]="candidate()!.resumeUrl" target="_blank">
                {{ 'recruitment.profile.view_resume' | translate }}
              </a>
            </div>
            <div class="info-row" *ngIf="candidate()!.notes">
              <span class="label">{{ 'recruitment.profile.notes' | translate }}</span>
              <span class="value">{{ candidate()!.notes }}</span>
            </div>
          </div>

          <app-candidate-pipeline-stepper [status]="candidate()!.status" />

          <div *ngIf="actionError()" class="alert alert-error">{{ actionError()! | translate }}</div>

          <div class="actions" *ngIf="!isTerminal()">
            <button
              *ngIf="canAdvance()"
              class="btn-primary"
              [disabled]="submitting()"
              (click)="onAdvance()">
              {{ 'recruitment.profile.advance' | translate }}
              ({{ 'recruitment.pipeline.' + nextStatus() | translate }})
            </button>

            <button
              *ngIf="isOffer()"
              class="btn-hire"
              (click)="onHire()">
              {{ 'recruitment.profile.hire' | translate }}
            </button>

            <button
              class="btn-reject"
              [disabled]="submitting()"
              (click)="onReject()">
              {{ 'recruitment.profile.reject' | translate }}
            </button>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .profile-page { max-width: 720px; }
    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .page-header h2 { font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
    .btn-back { background: none; border: 1px solid #dadce0; border-radius: 6px; padding: 6px 12px; font-size: 13px; color: #5f6368; cursor: pointer; }
    .btn-back:hover { background: #f8f9fa; }
    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; background: #fce8e6; color: #c5221f; }
    .profile-card { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; padding: 24px; }
    .profile-info { margin-bottom: 20px; }
    .info-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f8f9fa; }
    .info-row:last-child { border-bottom: none; }
    .label { font-size: 12.5px; font-weight: 600; color: #5f6368; min-width: 120px; }
    .value { font-size: 13.5px; color: #202124; }
    .link { color: #1a73e8; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .actions { display: flex; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e8eaed; }
    .btn-primary { background: #1a73e8; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-primary:disabled { opacity: .6; cursor: default; }
    .btn-hire { background: #137333; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; }
    .btn-hire:hover { background: #0d5225; }
    .btn-reject { background: none; border: 1px solid #c5221f; color: #c5221f; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; margin-left: auto; }
    .btn-reject:hover:not(:disabled) { background: #fce8e6; }
    .btn-reject:disabled { opacity: .6; cursor: default; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class CandidateProfilePageComponent implements OnInit {
  private readonly svc    = inject(RecruitmentService)
  private readonly route  = inject(ActivatedRoute)
  private readonly router = inject(Router)

  readonly candidate   = signal<Candidate | null>(null)
  readonly loading     = signal(false)
  readonly error       = signal<string | null>(null)
  readonly actionError = signal<string | null>(null)
  readonly submitting  = signal(false)

  readonly isTerminal = computed(() => TERMINAL_STATUSES.includes(this.candidate()?.status ?? 'REJECTED'))
  readonly isOffer    = computed(() => this.candidate()?.status === 'OFFER')
  readonly canAdvance = computed(() => !!NEXT_STATUS[this.candidate()?.status ?? 'HIRED'])
  readonly nextStatus = computed<CandidateStatus>(() => NEXT_STATUS[this.candidate()?.status ?? 'HIRED'] ?? 'SCREENING')

  private candidateId = ''

  async ngOnInit() {
    this.candidateId = this.route.snapshot.paramMap.get('id') ?? ''
    this.loading.set(true)
    try {
      const result = await this.svc.getCandidate(this.candidateId)
      this.candidate.set(result)
    } catch {
      this.error.set('recruitment.error.load')
    } finally {
      this.loading.set(false)
    }
  }

  /** Advances the candidate to the next pipeline status. */
  async onAdvance(): Promise<void> {
    const next = this.nextStatus()
    this.submitting.set(true)
    this.actionError.set(null)
    try {
      const updated = await this.svc.advanceCandidateStatus(this.candidateId, next)
      this.candidate.set(updated)
    } catch {
      this.actionError.set('recruitment.error.advance')
    } finally {
      this.submitting.set(false)
    }
  }

  /** Rejects the candidate (transitions to REJECTED status). */
  async onReject(): Promise<void> {
    this.submitting.set(true)
    this.actionError.set(null)
    try {
      const updated = await this.svc.advanceCandidateStatus(this.candidateId, 'REJECTED')
      this.candidate.set(updated)
    } catch {
      this.actionError.set('recruitment.error.reject')
    } finally {
      this.submitting.set(false)
    }
  }

  /**
   * Navigates to the hire form for this candidate.
   * Only available when candidate is in OFFER status.
   */
  onHire(): void {
    this.router.navigate(['/recruitment/candidate', this.candidateId, 'hire'])
  }

  /** Navigates back to the posting candidates list. */
  goBack(): void {
    const postingId = this.candidate()?.postingId
    if (postingId) {
      this.router.navigate(['/recruitment', postingId])
    } else {
      this.router.navigate(['/recruitment'])
    }
  }
}
