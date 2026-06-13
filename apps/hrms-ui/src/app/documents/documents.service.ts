import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs'

export type DocumentStatus = 'PENDING' | 'SIGNED' | 'ARCHIVED'
export type DocumentType   = 'contract' | 'nda' | 'policy' | 'certificate' | 'other'

export interface EmployeeDocument {
  id:            string
  employeeId:    string
  templateId:    string | null
  name:          string
  type:          DocumentType
  status:        DocumentStatus
  fileUrl:       string
  fileHash:      string | null
  signedAt:      string | null
  signedBy:      string | null
  archivedAt:    string | null
  expiresAt:     string | null
  renewedFromId: string | null
  createdAt:     string
  updatedAt:     string
}

export interface ExpiringDocument extends EmployeeDocument {
  employee: { id: string; fullName: string; corporateEmail: string }
}

export interface CreateDocumentPayload {
  name:       string
  type:       DocumentType
  fileUrl:    string
  templateId?: string | null
  expiresAt?: string | null
}

export interface RenewDocumentPayload {
  fileUrl:   string
  expiresAt?: string | null
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly http = inject(HttpClient)
  private readonly base = '/api'

  getByEmployee(
    employeeId: string,
    filters: { status?: DocumentStatus; type?: DocumentType } = {},
  ): Observable<EmployeeDocument[]> {
    let params = new HttpParams()
    if (filters.status) params = params.set('status', filters.status)
    if (filters.type)   params = params.set('type',   filters.type)
    return this.http.get<EmployeeDocument[]>(`${this.base}/employees/${employeeId}/documents`, { params })
  }

  create(employeeId: string, payload: CreateDocumentPayload): Observable<EmployeeDocument> {
    return this.http.post<EmployeeDocument>(`${this.base}/employees/${employeeId}/documents`, payload)
  }

  getById(id: string): Observable<EmployeeDocument> {
    return this.http.get<EmployeeDocument>(`${this.base}/documents/${id}`)
  }

  sign(id: string, fileHash: string): Observable<EmployeeDocument> {
    return this.http.post<EmployeeDocument>(`${this.base}/documents/${id}/sign`, { fileHash })
  }

  archive(id: string): Observable<EmployeeDocument> {
    return this.http.post<EmployeeDocument>(`${this.base}/documents/${id}/archive`, {})
  }

  renew(id: string, payload: RenewDocumentPayload): Observable<EmployeeDocument> {
    return this.http.post<EmployeeDocument>(`${this.base}/documents/${id}/renew`, payload)
  }

  listExpiring(days = 30): Observable<ExpiringDocument[]> {
    return this.http.get<ExpiringDocument[]>(`${this.base}/documents/expiring`, {
      params: new HttpParams().set('days', days),
    })
  }
}
