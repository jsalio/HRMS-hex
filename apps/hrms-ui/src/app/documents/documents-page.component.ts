import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { NgIf, NgFor, SlicePipe } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { AuthService } from '../core/services/auth.service'
import { AppModule } from '../core/models/auth.models'
import {
  DocumentsService,
  EmployeeDocument, DocumentStatus, DocumentType, CreateDocumentPayload,
} from './documents.service'

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor, SlicePipe, TranslateModule],
  template: `
    <div class="documents-page">
      <div class="page-header">
        <button class="back-btn" (click)="router.navigate(['/employees', employeeId])">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <h2>{{ 'documents.title' | translate }}</h2>
        <button *ngIf="canCreate()" class="btn btn-primary" (click)="openUploadModal()">
          + {{ 'documents.upload' | translate }}
        </button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <select [(ngModel)]="filterStatus" (ngModelChange)="reload()">
          <option value="">{{ 'documents.filters.all_status' | translate }}</option>
          <option value="PENDING">{{ 'documents.status.PENDING' | translate }}</option>
          <option value="SIGNED">{{ 'documents.status.SIGNED' | translate }}</option>
          <option value="ARCHIVED">{{ 'documents.status.ARCHIVED' | translate }}</option>
        </select>
        <select [(ngModel)]="filterType" (ngModelChange)="reload()">
          <option value="">{{ 'documents.filters.all_types' | translate }}</option>
          <option value="contract">{{ 'documents.type.contract' | translate }}</option>
          <option value="nda">{{ 'documents.type.nda' | translate }}</option>
          <option value="policy">{{ 'documents.type.policy' | translate }}</option>
          <option value="certificate">{{ 'documents.type.certificate' | translate }}</option>
          <option value="other">{{ 'documents.type.other' | translate }}</option>
        </select>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="spinner" aria-label="loading"></div>

      <!-- Error -->
      <div *ngIf="error()" class="alert alert-error">{{ error() }}</div>

      <!-- Empty -->
      <div *ngIf="!loading() && !error() && documents().length === 0" class="empty-state">
        {{ 'documents.empty' | translate }}
      </div>

      <!-- Table -->
      <table *ngIf="!loading() && documents().length > 0" class="data-table">
        <thead>
          <tr>
            <th>{{ 'documents.table.name' | translate }}</th>
            <th>{{ 'documents.table.type' | translate }}</th>
            <th>{{ 'documents.table.status' | translate }}</th>
            <th>{{ 'documents.table.expires_at' | translate }}</th>
            <th>{{ 'documents.table.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let doc of documents()">
            <td>
              <a [href]="doc.fileUrl" target="_blank">{{ doc.name }}</a>
            </td>
            <td>{{ 'documents.type.' + doc.type | translate }}</td>
            <td>
              <span class="badge" [attr.data-status]="doc.status">
                {{ 'documents.status.' + doc.status | translate }}
              </span>
            </td>
            <td>
              <span *ngIf="doc.expiresAt">
                {{ doc.expiresAt | slice:0:10 }}
                <span *ngIf="isExpiringSoon(doc.expiresAt)" class="expiry-warning" title="{{ 'documents.expiring_soon' | translate }}">⚠</span>
              </span>
              <span *ngIf="!doc.expiresAt">—</span>
            </td>
            <td class="actions">
              <button *ngIf="doc.status === 'PENDING' && canEdit()" class="btn btn-sm btn-success"
                (click)="openSignModal(doc)">
                {{ 'documents.actions.sign' | translate }}
              </button>
              <button *ngIf="doc.status === 'SIGNED' && canEdit()" class="btn btn-sm btn-secondary"
                (click)="doArchive(doc)">
                {{ 'documents.actions.archive' | translate }}
              </button>
              <button *ngIf="canCreate()" class="btn btn-sm btn-outline"
                (click)="openRenewModal(doc)">
                {{ 'documents.actions.renew' | translate }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Sign modal -->
      <div *ngIf="signModalDoc()" class="modal-backdrop" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'documents.sign_modal.title' | translate }}</h3>
          <p>{{ 'documents.sign_modal.subtitle' | translate: { name: signModalDoc()!.name } }}</p>
          <label>{{ 'documents.sign_modal.hash_label' | translate }}</label>
          <input [(ngModel)]="signHashValue" placeholder="SHA-256 (64 chars)" maxlength="64" class="input" />
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="closeModals()">{{ 'common.cancel' | translate }}</button>
            <button class="btn btn-primary" (click)="confirmSign()" [disabled]="signHashValue.length !== 64">
              {{ 'documents.actions.sign' | translate }}
            </button>
          </div>
        </div>
      </div>

      <!-- Upload modal -->
      <div *ngIf="showUploadModal()" class="modal-backdrop" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'documents.upload_modal.title' | translate }}</h3>
          <label>{{ 'documents.fields.name' | translate }}</label>
          <input [(ngModel)]="uploadName" class="input" />
          <label>{{ 'documents.fields.type' | translate }}</label>
          <select [(ngModel)]="uploadType" class="input">
            <option value="contract">{{ 'documents.type.contract' | translate }}</option>
            <option value="nda">{{ 'documents.type.nda' | translate }}</option>
            <option value="policy">{{ 'documents.type.policy' | translate }}</option>
            <option value="certificate">{{ 'documents.type.certificate' | translate }}</option>
            <option value="other">{{ 'documents.type.other' | translate }}</option>
          </select>
          <label>{{ 'documents.fields.file_url' | translate }}</label>
          <input [(ngModel)]="uploadFileUrl" type="url" class="input" />
          <label>{{ 'documents.fields.expires_at' | translate }} ({{ 'common.optional' | translate }})</label>
          <input [(ngModel)]="uploadExpiresAt" type="date" class="input" />
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="closeModals()">{{ 'common.cancel' | translate }}</button>
            <button class="btn btn-primary" (click)="confirmUpload()"
              [disabled]="!uploadName || !uploadFileUrl">
              {{ 'documents.actions.upload' | translate }}
            </button>
          </div>
        </div>
      </div>

      <!-- Renew modal -->
      <div *ngIf="renewModalDoc()" class="modal-backdrop" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ 'documents.renew_modal.title' | translate }}</h3>
          <p>{{ 'documents.renew_modal.subtitle' | translate: { name: renewModalDoc()!.name } }}</p>
          <label>{{ 'documents.fields.file_url' | translate }}</label>
          <input [(ngModel)]="renewFileUrl" type="url" class="input" />
          <label>{{ 'documents.fields.expires_at' | translate }} ({{ 'common.optional' | translate }})</label>
          <input [(ngModel)]="renewExpiresAt" type="date" class="input" />
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="closeModals()">{{ 'common.cancel' | translate }}</button>
            <button class="btn btn-primary" (click)="confirmRenew()" [disabled]="!renewFileUrl">
              {{ 'documents.actions.renew' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .documents-page { max-width: 900px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .page-header h2 { flex: 1; font-size: 18px; font-weight: 600; color: #202124; margin: 0; }
    .back-btn { width: 36px; height: 36px; border: 1px solid #e8eaed; border-radius: 8px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .back-btn:hover { background: #f8f9fa; }
    .back-btn .material-symbols-outlined { font-size: 20px; color: #5f6368; }

    .filters { display: flex; gap: 10px; margin-bottom: 16px; }
    .filters select { height: 36px; border: 1px solid #e8eaed; border-radius: 8px; padding: 0 10px; font-size: 13px; color: #202124; background: #fff; cursor: pointer; outline: none; }
    .filters select:focus { border-color: #1a73e8; }

    .spinner { width: 24px; height: 24px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; margin: 24px auto; display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .alert { padding: 12px 16px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px; }
    .alert-error { background: #fce8e6; color: #c5221f; }

    .empty-state { text-align: center; padding: 40px; color: #9aa0a6; font-size: 14px; }

    .data-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .data-table th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; padding: 10px 16px; background: #f8f9fa; border-bottom: 1px solid #e8eaed; }
    .data-table td { padding: 12px 16px; font-size: 13.5px; color: #202124; border-bottom: 1px solid #f8f9fa; vertical-align: middle; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table a { color: #1a73e8; text-decoration: none; }
    .data-table a:hover { text-decoration: underline; }

    .badge { padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; }
    .badge[data-status="PENDING"]  { background: #fef7e0; color: #7a5200; }
    .badge[data-status="SIGNED"]   { background: #e6f4ea; color: #137333; }
    .badge[data-status="ARCHIVED"] { background: #f1f3f4; color: #80868b; }

    .expiry-warning { color: #e37400; margin-left: 4px; }

    .actions { display: flex; gap: 6px; }
    .btn { display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; white-space: nowrap; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-primary  { background: #1a73e8; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
    .btn-success  { background: #e6f4ea; color: #137333; border: 1px solid #ceead6; }
    .btn-success:hover { background: #ceead6; }
    .btn-secondary { background: #f1f3f4; color: #3c4043; }
    .btn-secondary:hover { background: #e8eaed; }
    .btn-outline { background: #fff; color: #3c4043; border: 1px solid #e8eaed; }
    .btn-outline:hover { background: #f8f9fa; }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.32); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #fff; border-radius: 12px; padding: 28px; max-width: 440px; width: calc(100% - 40px); display: flex; flex-direction: column; gap: 14px; }
    .modal h3 { font-size: 16px; font-weight: 600; color: #202124; margin: 0; }
    .modal p { font-size: 13.5px; color: #5f6368; margin: 0; }
    .modal label { font-size: 12px; font-weight: 500; color: #5f6368; }
    .input { width: 100%; height: 38px; border: 1px solid #e8eaed; border-radius: 8px; padding: 0 12px; font-size: 13px; color: #202124; outline: none; font-family: inherit; box-sizing: border-box; }
    .input:focus { border-color: #1a73e8; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
  `],
})
export class DocumentsPageComponent implements OnInit {
  private readonly route    = inject(ActivatedRoute)
  private readonly svc      = inject(DocumentsService)
  private readonly auth     = inject(AuthService)
  protected readonly router = inject(Router)

  employeeId = ''

  documents   = signal<EmployeeDocument[]>([])
  loading     = signal(false)
  error       = signal<string | null>(null)

  filterStatus = ''
  filterType   = ''

  // Sign modal
  signModalDoc  = signal<EmployeeDocument | null>(null)
  signHashValue = ''

  // Upload modal
  showUploadModal = signal(false)
  uploadName      = ''
  uploadType: DocumentType = 'contract'
  uploadFileUrl   = ''
  uploadExpiresAt = ''

  // Renew modal
  renewModalDoc  = signal<EmployeeDocument | null>(null)
  renewFileUrl   = ''
  renewExpiresAt = ''

  canCreate = () => this.auth.hasPermission(AppModule.DOCUMENTS, 'canCreate')
  canEdit   = () => this.auth.hasPermission(AppModule.DOCUMENTS, 'canEdit')

  ngOnInit() {
    this.employeeId = this.route.snapshot.paramMap.get('id') ?? ''
    this.reload()
  }

  reload() {
    this.loading.set(true)
    this.error.set(null)
    this.svc.getByEmployee(this.employeeId, {
      status: (this.filterStatus as DocumentStatus) || undefined,
      type:   (this.filterType as DocumentType)   || undefined,
    }).subscribe({
      next:  docs => { this.documents.set(docs); this.loading.set(false) },
      error: ()   => { this.error.set('documents.error.load'); this.loading.set(false) },
    })
  }

  isExpiringSoon(expiresAt: string): boolean {
    const diff = new Date(expiresAt).getTime() - Date.now()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }

  openSignModal(doc: EmployeeDocument) {
    this.signHashValue = ''
    this.signModalDoc.set(doc)
  }

  confirmSign() {
    const doc = this.signModalDoc()
    if (!doc || this.signHashValue.length !== 64) return
    this.svc.sign(doc.id, this.signHashValue).subscribe({
      next: () => { this.closeModals(); this.reload() },
      error: () => this.error.set('documents.error.sign'),
    })
  }

  doArchive(doc: EmployeeDocument) {
    this.svc.archive(doc.id).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('documents.error.archive'),
    })
  }

  openUploadModal() {
    this.uploadName = ''; this.uploadFileUrl = ''; this.uploadExpiresAt = ''
    this.uploadType = 'contract'
    this.showUploadModal.set(true)
  }

  confirmUpload() {
    if (!this.uploadName || !this.uploadFileUrl) return
    const payload: CreateDocumentPayload = {
      name:      this.uploadName,
      type:      this.uploadType,
      fileUrl:   this.uploadFileUrl,
      expiresAt: this.uploadExpiresAt || null,
    }
    this.svc.create(this.employeeId, payload).subscribe({
      next: () => { this.closeModals(); this.reload() },
      error: () => this.error.set('documents.error.create'),
    })
  }

  openRenewModal(doc: EmployeeDocument) {
    this.renewFileUrl = ''; this.renewExpiresAt = ''
    this.renewModalDoc.set(doc)
  }

  confirmRenew() {
    const doc = this.renewModalDoc()
    if (!doc || !this.renewFileUrl) return
    this.svc.renew(doc.id, { fileUrl: this.renewFileUrl, expiresAt: this.renewExpiresAt || null }).subscribe({
      next: () => { this.closeModals(); this.reload() },
      error: () => this.error.set('documents.error.renew'),
    })
  }

  closeModals() {
    this.signModalDoc.set(null)
    this.showUploadModal.set(false)
    this.renewModalDoc.set(null)
  }
}
