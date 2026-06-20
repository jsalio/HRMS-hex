import { Component, OnInit, inject, signal } from '@angular/core'
import { NgIf, NgFor } from '@angular/common'
import { Router } from '@angular/router'
import { TranslateModule } from '@ngx-translate/core'
import { RecruitmentService, JobPosting } from './recruitment.service'

/**
 * Smart component that lists all job postings.
 * Entry point for the recruitment module.
 */
@Component({
  selector: 'app-recruitment-page',
  standalone: true,
  imports: [NgIf, NgFor, TranslateModule],
  template: `
    <div class="recruitment-page">
      <div class="page-header">
        <div>
          <h2>{{ 'recruitment.title' | translate }}</h2>
          <p class="subtitle">{{ 'recruitment.subtitle' | translate }}</p>
        </div>
        <button class="btn-primary" (click)="onCreatePosting()">
          + {{ 'recruitment.new_posting' | translate }}
        </button>
      </div>

      <div *ngIf="loading()" class="state-loading">
        <span class="spinner"></span>{{ 'common.loading' | translate }}
      </div>
      <div *ngIf="error()" class="alert alert-error">{{ error()! | translate }}</div>

      <div *ngIf="!loading() && postings().length === 0 && !error()" class="empty-state">
        {{ 'recruitment.empty' | translate }}
      </div>

      <table *ngIf="!loading() && postings().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'recruitment.table.title' | translate }}</th>
            <th>{{ 'recruitment.table.department' | translate }}</th>
            <th>{{ 'recruitment.table.status' | translate }}</th>
            <th>{{ 'recruitment.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of postings()" (click)="onViewCandidates(p.id)" style="cursor:pointer">
            <td><strong>{{ p.title }}</strong></td>
            <td>{{ p.departmentId }}</td>
            <td>
              <span class="badge" [class]="'badge-' + p.status.toLowerCase()">
                {{ 'recruitment.status.' + p.status | translate }}
              </span>
            </td>
            <td>
              <button class="btn-link" (click)="$event.stopPropagation(); onViewCandidates(p.id)">
                {{ 'recruitment.candidate.view_candidates' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .recruitment-page { max-width: 1000px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .page-header h2 { font-size: 18px; font-weight: 600; color: #202124; margin: 0 0 4px; }
    .subtitle { font-size: 13px; color: #5f6368; margin: 0; }
    .btn-primary { background: #1a73e8; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; }
    .btn-primary:hover { background: #1557b0; }
    .btn-link { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 13px; padding: 0; }
    .state-loading { display: flex; align-items: center; gap: 10px; padding: 24px; font-size: 14px; color: #5f6368; }
    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; }
    .alert-error { background: #fce8e6; color: #c5221f; }
    .empty-state { text-align: center; padding: 48px; color: #9aa0a6; font-size: 14px; }
    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover { background: #f8f9fa; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; }
    .badge-open    { background: #e6f4ea; color: #137333; }
    .badge-closed  { background: #f1f3f4; color: #5f6368; }
    .badge-on_hold { background: #fef7e0; color: #b06000; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class RecruitmentPageComponent implements OnInit {
  private readonly svc    = inject(RecruitmentService)
  private readonly router = inject(Router)

  readonly postings = signal<JobPosting[]>([])
  readonly loading  = signal(false)
  readonly error    = signal<string | null>(null)

  async ngOnInit() {
    this.loading.set(true)
    try {
      const result = await this.svc.listJobPostings()
      this.postings.set(result)
    } catch {
      this.error.set('recruitment.error.load')
    } finally {
      this.loading.set(false)
    }
  }

  /**
   * Navigates to the candidate list for a given posting.
   *
   * @param postingId - identifier of the posting to open
   */
  onViewCandidates(postingId: string): void {
    this.router.navigate(['/recruitment', postingId])
  }

  /** Navigates to the job posting creation form. */
  onCreatePosting(): void {
    this.router.navigate(['/recruitment/new'])
  }
}
