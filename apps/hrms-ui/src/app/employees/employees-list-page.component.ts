import { Component, inject, signal, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { SlicePipe } from '@angular/common'
import { TranslateModule } from '@ngx-translate/core'
import { EmployeesService, type EmployeeSummary, type Department, type EmployeeStatus } from './employees.service'
import { AuthService } from '../core/services/auth.service'
import { AppModule } from '../core/models/auth.models'

@Component({
  selector: 'app-employees-list-page',
  standalone: true,
  imports: [TranslateModule, FormsModule, SlicePipe],
  template: `
    <div class="employees-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ 'employees.title' | translate }}</h1>
          <p class="page-subtitle">{{ 'employees.subtitle' | translate }}</p>
        </div>
        <div class="header-actions">
          @if (canExport()) {
            <button class="btn-secondary" (click)="exportCsv()">
              <span class="material-symbols-outlined">download</span>
              {{ 'employees.export' | translate }}
            </button>
          }
          @if (canCreate()) {
            <button class="btn-primary" (click)="router.navigate(['/employees/new'])">
              <span class="material-symbols-outlined">person_add</span>
              {{ 'employees.new' | translate }}
            </button>
          }
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="search-box">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            class="search-input"
            type="text"
            [(ngModel)]="searchText"
            (ngModelChange)="onSearchChange($event)"
            [placeholder]="'employees.search_placeholder' | translate"
          />
        </div>
        <select class="filter-select" [(ngModel)]="filterDept" (ngModelChange)="loadEmployees()">
          <option value="">{{ 'employees.filters.all_departments' | translate }}</option>
          @for (dept of departments(); track dept.id) {
            <option [value]="dept.id">{{ dept.name }}</option>
          }
        </select>
        <select class="filter-select" [(ngModel)]="filterStatus" (ngModelChange)="loadEmployees()">
          <option value="">{{ 'employees.filters.all_statuses' | translate }}</option>
          <option value="ACTIVE">{{ 'employees.status.ACTIVE' | translate }}</option>
          <option value="REMOTE">{{ 'employees.status.REMOTE' | translate }}</option>
          <option value="ON_LEAVE">{{ 'employees.status.ON_LEAVE' | translate }}</option>
          <option value="INACTIVE">{{ 'employees.status.INACTIVE' | translate }}</option>
        </select>
      </div>

      <!-- States -->
      @if (isLoading()) {
        <div class="state-loading">
          <span class="spinner"></span>{{ 'common.loading' | translate }}
        </div>
      } @else if (error()) {
        <div class="state-error" role="alert">{{ 'common.error.generic' | translate }}</div>
      } @else if (employees().length === 0) {
        <div class="state-empty">
          <span class="material-symbols-outlined empty-icon">group_off</span>
          <p>{{ 'employees.empty' | translate }}</p>
        </div>
      } @else {
        <!-- Table -->
        <div class="table-wrapper">
          <table class="employees-table">
            <thead>
              <tr>
                <th>{{ 'employees.table.name' | translate }}</th>
                <th>{{ 'employees.table.department' | translate }}</th>
                <th>{{ 'employees.table.job_title' | translate }}</th>
                <th>{{ 'employees.table.status' | translate }}</th>
                <th>{{ 'employees.table.hire_date' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (emp of employees(); track emp.id) {
                <tr class="table-row" (click)="router.navigate(['/employees', emp.id])">
                  <td>
                    <div class="employee-name-cell">
                      <div class="avatar">{{ emp.fullName.charAt(0) }}</div>
                      <div>
                        <p class="name">{{ emp.fullName }}</p>
                        <p class="email">{{ emp.corporateEmail }}</p>
                      </div>
                    </div>
                  </td>
                  <td>{{ emp.department.name }}</td>
                  <td>{{ emp.jobTitle }}</td>
                  <td>
                    <span class="status-badge" [attr.data-status]="emp.status">
                      {{ 'employees.status.' + emp.status | translate }}
                    </span>
                  </td>
                  <td>{{ emp.hireDate | slice:0:10 }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (total() > pageSize) {
          <div class="pagination">
            <button class="page-btn" [disabled]="currentPage() === 1" (click)="goToPage(currentPage() - 1)">
              <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <span class="page-info">{{ currentPage() }} / {{ totalPages() }}</span>
            <button class="page-btn" [disabled]="currentPage() === totalPages()" (click)="goToPage(currentPage() + 1)">
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .employees-page { max-width: 1200px; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px;
    }
    .page-title { font-size: 20px; font-weight: 600; color: #202124; margin: 0 0 4px; }
    .page-subtitle { font-size: 13px; color: #5f6368; margin: 0; }
    .header-actions { display: flex; gap: 10px; }

    .btn-primary {
      display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 18px;
      background: #1a73e8; color: #fff; border: none; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; font-family: inherit;
    }
    .btn-primary:hover { background: #1557b0; }
    .btn-primary .material-symbols-outlined { font-size: 18px; }

    .btn-secondary {
      display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px;
      background: #fff; color: #3c4043; border: 1px solid #e8eaed; border-radius: 8px;
      font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit;
    }
    .btn-secondary:hover { background: #f8f9fa; }
    .btn-secondary .material-symbols-outlined { font-size: 18px; }

    .filters-bar {
      display: flex; gap: 12px; margin-bottom: 20px; align-items: center;
    }
    .search-box {
      display: flex; align-items: center; gap: 8px; background: #f1f3f4;
      border-radius: 24px; padding: 0 16px; height: 38px; flex: 1; max-width: 360px;
    }
    .search-box:focus-within { background: #fff; outline: 2px solid #1a73e8; }
    .search-icon { font-size: 18px; color: #9aa0a6; }
    .search-input { border: none; background: transparent; outline: none; font-size: 14px; color: #202124; width: 100%; font-family: inherit; }
    .search-input::placeholder { color: #9aa0a6; }

    .filter-select {
      height: 38px; padding: 0 12px; border: 1px solid #e8eaed; border-radius: 8px;
      font-size: 13px; color: #3c4043; background: #fff; cursor: pointer; outline: none; font-family: inherit;
    }
    .filter-select:focus { border-color: #1a73e8; }

    .state-loading, .state-error { display: flex; align-items: center; gap: 10px; padding: 24px; border-radius: 10px; font-size: 14px; }
    .state-loading { background: #fff; color: #5f6368; }
    .state-error { background: #fce8e6; color: #c5221f; }
    .spinner { width: 18px; height: 18px; border: 2px solid #e8eaed; border-top-color: #1a73e8; border-radius: 50%; animation: spin 700ms linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .state-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px; background: #fff; border-radius: 12px; border: 1px solid #e8eaed; color: #5f6368; }
    .empty-icon { font-size: 48px; color: #dadce0; }

    .table-wrapper { background: #fff; border: 1px solid #e8eaed; border-radius: 12px; overflow: hidden; }
    .employees-table { width: 100%; border-collapse: collapse; }
    .employees-table thead { background: #f8f9fa; }
    .employees-table th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #f1f3f4; }
    .employees-table td { padding: 14px 16px; border-bottom: 1px solid #f8f9fa; font-size: 13.5px; color: #202124; }
    .table-row { cursor: pointer; transition: background 100ms; }
    .table-row:hover td { background: #f8f9fa; }
    .table-row:last-child td { border-bottom: none; }

    .employee-name-cell { display: flex; align-items: center; gap: 10px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: #1a73e8; color: #fff; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .name { font-size: 13.5px; font-weight: 500; color: #202124; margin: 0; }
    .email { font-size: 12px; color: #9aa0a6; margin: 2px 0 0; }

    .status-badge { padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 600; }
    .status-badge[data-status="ACTIVE"]   { background: #e6f4ea; color: #137333; }
    .status-badge[data-status="REMOTE"]   { background: #e8f0fe; color: #1a73e8; }
    .status-badge[data-status="ON_LEAVE"] { background: #fef7e0; color: #7a5200; }
    .status-badge[data-status="INACTIVE"] { background: #f1f3f4; color: #80868b; }

    .pagination { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 16px; }
    .page-btn { width: 32px; height: 32px; border: 1px solid #e8eaed; border-radius: 8px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .page-btn:hover:not(:disabled) { background: #f1f3f4; }
    .page-btn:disabled { opacity: .4; cursor: not-allowed; }
    .page-btn .material-symbols-outlined { font-size: 18px; }
    .page-info { font-size: 13px; color: #5f6368; }
  `],
})
export class EmployeesListPageComponent implements OnInit {
  protected readonly router = inject(Router)
  private readonly svc = inject(EmployeesService)
  private readonly auth = inject(AuthService)

  readonly isLoading  = signal(false)
  readonly error      = signal<string | null>(null)
  readonly employees  = signal<EmployeeSummary[]>([])
  readonly departments = signal<Department[]>([])
  readonly total       = signal(0)
  readonly currentPage = signal(1)
  readonly pageSize    = 20

  searchText   = ''
  filterDept   = ''
  filterStatus = ''

  private searchTimer: ReturnType<typeof setTimeout> | null = null

  canCreate = () => this.auth.hasPermission(AppModule.EMPLOYEES, 'canCreate')
  canExport = () => this.auth.hasPermission(AppModule.EMPLOYEES, 'canExport')
  totalPages = () => Math.max(1, Math.ceil(this.total() / this.pageSize))

  async ngOnInit(): Promise<void> {
    this.svc.getDepartments().then(d => this.departments.set(d)).catch(() => {})
    await this.loadEmployees()
  }

  async loadEmployees(): Promise<void> {
    this.isLoading.set(true)
    this.error.set(null)
    try {
      const result = await this.svc.listEmployees({
        departmentId: this.filterDept   || undefined,
        status:       (this.filterStatus || undefined) as EmployeeStatus | undefined,
        search:       this.searchText   || undefined,
        page:         this.currentPage(),
        limit:        this.pageSize,
      })
      this.employees.set(result.data)
      this.total.set(result.total)
    } catch {
      this.error.set('load_failed')
    } finally {
      this.isLoading.set(false)
    }
  }

  onSearchChange(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => { this.currentPage.set(1); this.loadEmployees() }, 350)
  }

  async goToPage(page: number): Promise<void> {
    this.currentPage.set(page)
    await this.loadEmployees()
  }

  exportCsv(): void {
    const url = `/api/employees/export?format=csv`
    window.open(url, '_blank')
  }
}
