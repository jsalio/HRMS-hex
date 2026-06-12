import { Component, Input, Output, EventEmitter } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'

export interface RoleListItem {
  id: string
  name: string
  isSystem: boolean
}

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="roles-table-wrap">
      <table class="roles-table">
        <thead>
          <tr>
            <th>{{ 'roles.list.name' | translate }}</th>
            <th>{{ 'roles.list.type' | translate }}</th>
            <th>{{ 'roles.list.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (role of roles; track role.id) {
            <tr>
              <td class="role-name">{{ role.name }}</td>
              <td>
                @if (role.isSystem) {
                  <span class="badge system">{{ 'roles.list.system' | translate }}</span>
                } @else {
                  <span class="badge custom">{{ 'roles.list.custom' | translate }}</span>
                }
              </td>
              <td class="actions">
                <button class="btn-action" (click)="editClicked.emit(role.id)">
                  {{ 'common.edit' | translate }}
                </button>
                <button class="btn-action danger" (click)="deleteClicked.emit(role.id)" [disabled]="role.isSystem">
                  {{ 'common.delete' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .roles-table-wrap {
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,.1);
      overflow: hidden;
    }

    .roles-table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #f8f9fa;
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #5f6368;
      text-transform: uppercase;
      letter-spacing: .5px;
      border-bottom: 1px solid #e8eaed;
    }

    td {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f3f4;
      font-size: 14px;
      color: #202124;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8f9fa; }

    .role-name { font-weight: 500; }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge.system { background: #e8f0fe; color: #1a73e8; }
    .badge.custom { background: #e6f4ea; color: #188038; }

    .actions { display: flex; gap: 8px; }

    .btn-action {
      height: 30px;
      padding: 0 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid #dadce0;
      background: #fff;
      color: #3c4043;
      cursor: pointer;
      transition: background 150ms;
    }
    .btn-action:hover:not(:disabled) { background: #f8f9fa; }
    .btn-action.danger { color: #d93025; border-color: #f28b82; }
    .btn-action.danger:hover:not(:disabled) { background: #fce8e6; }
    .btn-action:disabled { opacity: .4; cursor: not-allowed; }
  `],
})
export class RolesListComponent {
  @Input() roles: RoleListItem[] = []
  @Output() editClicked = new EventEmitter<string>()
  @Output() deleteClicked = new EventEmitter<string>()
}
