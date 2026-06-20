import { Component, Input } from '@angular/core'
import { NgFor, NgIf, NgClass } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import type { CandidateStatus } from './recruitment.service'

const PIPELINE_STEPS: CandidateStatus[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER']
const STEP_INDEX: Record<string, number> = {
  APPLIED: 0, SCREENING: 1, INTERVIEW: 2, OFFER: 3,
}

/**
 * Dumb component that renders the candidate recruitment pipeline as a visual stepper.
 * Accepts only the current candidate status and derives all display logic from it.
 */
@Component({
  selector: 'app-candidate-pipeline-stepper',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, TranslateModule],
  template: `
    <div class="pipeline-stepper">
      <div class="steps">
        <ng-container *ngFor="let step of steps; let i = index">
          <div class="step" [ngClass]="getStepClass(i)">
            <div class="step-circle">
              <span *ngIf="isCompleted(i)">✓</span>
              <span *ngIf="!isCompleted(i)">{{ i + 1 }}</span>
            </div>
            <span class="step-label">{{ 'recruitment.pipeline.' + step | translate }}</span>
          </div>
          <div *ngIf="i < steps.length - 1" class="step-connector" [class.filled]="isCompleted(i)"></div>
        </ng-container>
      </div>

      <div *ngIf="status === 'HIRED'" class="terminal-badge badge-hired">
        {{ 'recruitment.pipeline.HIRED' | translate }}
      </div>
      <div *ngIf="status === 'REJECTED'" class="terminal-badge badge-rejected">
        {{ 'recruitment.pipeline.REJECTED' | translate }}
      </div>
    </div>
  `,
  styles: [`
    .pipeline-stepper { padding: 20px 0; }
    .steps { display: flex; align-items: center; gap: 0; }
    .step { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 90px; }
    .step-circle {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600;
    }
    .step.completed .step-circle { background: #34a853; color: #fff; }
    .step.active    .step-circle { background: #1a73e8; color: #fff; }
    .step.pending   .step-circle { background: #e8eaed; color: #5f6368; }
    .step-label { font-size: 11px; color: #5f6368; text-align: center; }
    .step.active .step-label    { color: #1a73e8; font-weight: 600; }
    .step.completed .step-label { color: #34a853; }
    .step-connector { flex: 1; height: 2px; background: #e8eaed; min-width: 24px; }
    .step-connector.filled { background: #34a853; }
    .terminal-badge {
      display: inline-block; margin-top: 12px; padding: 4px 14px;
      border-radius: 20px; font-size: 13px; font-weight: 600;
    }
    .badge-hired    { background: #e6f4ea; color: #137333; }
    .badge-rejected { background: #fce8e6; color: #c5221f; }
  `],
})
export class CandidatePipelineStepperComponent {
  /** @returns the pipeline step labels array */
  readonly steps = PIPELINE_STEPS

  /** The current candidate status — drives all visual state. */
  @Input() status: CandidateStatus = 'APPLIED'

  /**
   * Returns the CSS class for a pipeline step at the given index.
   *
   * @param index - zero-based index of the step to classify
   * @returns 'completed', 'active', or 'pending'
   */
  getStepClass(index: number): string {
    const current = STEP_INDEX[this.status] ?? -1
    if (index < current) return 'completed'
    if (index === current) return 'active'
    return 'pending'
  }

  /**
   * Returns true when a pipeline step is behind the current active step.
   *
   * @param index - zero-based index of the step to check
   * @returns true when the step has been passed
   */
  isCompleted(index: number): boolean {
    return index < (STEP_INDEX[this.status] ?? -1)
  }
}
