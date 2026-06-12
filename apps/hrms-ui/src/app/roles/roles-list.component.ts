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
    <table>
      <thead>
        <tr>
          <th>{{ 'roles.list.name' | translate }}</th>
          <th>{{ 'roles.list.actions' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (role of roles; track role.id) {
          <tr>
            <td>{{ role.name }}</td>
            <td>
              <button (click)="editClicked.emit(role.id)">{{ 'common.edit' | translate }}</button>
              <button (click)="deleteClicked.emit(role.id)" [disabled]="role.isSystem">
                {{ 'common.delete' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class RolesListComponent {
  @Input() roles: RoleListItem[] = []
  @Output() editClicked = new EventEmitter<string>()
  @Output() deleteClicked = new EventEmitter<string>()
}
