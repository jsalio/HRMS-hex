import {
  Component, OnInit, inject, signal, computed,
} from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { FormsModule } from '@angular/forms'
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
  imports: [FormsModule, TranslateModule],
  template: `
    <div class="documents-page">
      <div class="page-header">
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
})
export class DocumentsPageComponent implements OnInit {
  private readonly route    = inject(ActivatedRoute)
  private readonly svc      = inject(DocumentsService)
  private readonly auth     = inject(AuthService)

  private employeeId = ''

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
