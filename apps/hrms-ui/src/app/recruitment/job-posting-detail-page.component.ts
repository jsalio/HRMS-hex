import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf, NgFor } from '@angular/common'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { RecruitmentService, Candidate } from './recruitment.service'

/**
 * Smart component that displays candidates belonging to a specific job posting.
 * Reads the posting id from the route and fetches candidates on init.
 */
@Component({
  selector: 'app-job-posting-detail-page',
  standalone: true,
  imports: [NgIf, NgFor, TranslateModule],
  template: `
    <div class="detail-page">
      <div class="page-header">
        <button class="btn-back" (click)="goBack()">← {{ 'recruitment.candidate.back' | translate }}</button>
        <h2>{{ 'recruitment.candidate.title' | translate }}</h2>
      </div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error()! | translate }}</div>

      <div *ngIf="!loading() && candidates().length === 0 && !error()" class="empty-state">
        {{ 'recruitment.candidate.empty' | translate }}
      </div>

      <table *ngIf="!loading() && candidates().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'recruitment.candidate.table.name' | translate }}</th>
            <th>{{ 'recruitment.candidate.table.email' | translate }}</th>
            <th>{{ 'recruitment.candidate.table.status' | translate }}</th>
            <th>{{ 'recruitment.candidate.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of candidates()" (click)="onViewProfile(c.id)" style="cursor:pointer">
            <td><strong>{{ c.fullName }}</strong></td>
            <td>{{ c.email }}</td>
            <td>
              <span class="badge" [class]="'badge-' + c.status.toLowerCase()">
                {{ 'recruitment.pipeline.' + c.status | translate }}
              </span>
            </td>
            <td>
              <button class="btn-link" (click)="$event.stopPropagation(); onViewProfile(c.id)">
                {{ 'recruitment.candidate.view_profile' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .detail-page { max-width: 1000px; }
    .page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .page-header h2 { font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
    .btn-back { background: none; border: 1px solid #dadce0; border-radius: 6px; padding: 6px 12px; font-size: 13px; color: #5f6368; cursor: pointer; }
    .btn-back:hover { background: #f8f9fa; }
    .btn-link { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 13px; padding: 0; }
    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; background: #fce8e6; color: #c5221f; }
    .empty-state { text-align: center; padding: 48px; color: #9aa0a6; font-size: 14px; }
    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; }
    .badge-applied    { background: #e8f0fe; color: #1967d2; }
    .badge-screening  { background: #fef7e0; color: #b06000; }
    .badge-interview  { background: #e3f2fd; color: #1565c0; }
    .badge-offer      { background: #f3e8fd; color: #6200ee; }
    .badge-hired      { background: #e6f4ea; color: #137333; }
    .badge-rejected   { background: #fce8e6; color: #c5221f; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class JobPostingDetailPageComponent implements OnInit {
  private readonly svc    = inject(RecruitmentService)
  private readonly route  = inject(ActivatedRoute)
  private readonly router = inject(Router)

  readonly candidates = signal<Candidate[]>([])
  readonly loading    = signal(false)
  readonly error      = signal<string | null>(null)

  private postingId = ''

  async ngOnInit() {
    this.postingId = this.route.snapshot.paramMap.get('postingId') ?? ''
    this.loading.set(true)
    try {
      const result = await this.svc.listCandidates(this.postingId)
      this.candidates.set(result)
    } catch {
      this.error.set('recruitment.error.load')
    } finally {
      this.loading.set(false)
    }
  }

  /**
   * Navigates to the candidate profile page.
   *
   * @param candidateId - identifier of the candidate to view
   */
  onViewProfile(candidateId: string): void {
    this.router.navigate(['/recruitment/candidate', candidateId])
  }

  /** Navigates back to the job postings list. */
  goBack(): void {
    this.router.navigate(['/recruitment'])
  }
}
