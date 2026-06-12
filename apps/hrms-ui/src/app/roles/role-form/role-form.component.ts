import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core'
import { ReactiveFormsModule, FormGroup, FormControl, Validators, FormArray } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'
import { AppModule, type RolePermission } from '../../core/models/auth.models'

export interface RoleFormValue {
  name: string
  permissions: RolePermission[]
}

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div>
        <label for="roleName">{{ 'roles.form.name' | translate }}</label>
        <input id="roleName" formControlName="name" />
        @if (form.controls.name.touched && form.controls.name.hasError('required')) {
          <span class="field-error">{{ 'common.validation.required' | translate }}</span>
        }
      </div>

      <div formArrayName="permissions">
        @for (module of moduleKeys; track module; let i = $index) {
          <fieldset>
            <legend>{{ 'modules.' + module | translate }}</legend>
            @for (action of actionKeys; track action) {
              <label>
                <input
                  type="checkbox"
                  [formControlName]="action"
                  [attr.data-module]="module"
                  [attr.data-action]="action"
                  [formControl]="getPermControl(i, action)"
                  [disabled]="isSystemRole"
                />
                {{ 'roles.permissions.' + action | translate }}
              </label>
            }
          </fieldset>
        }
      </div>

      <button type="submit">{{ 'common.save' | translate }}</button>
      <button type="button" (click)="cancelClicked.emit()">{{ 'common.cancel' | translate }}</button>
    </form>
  `,
})
export class RoleFormComponent implements OnInit {
  @Input() initialName = ''
  @Input() isSystemRole = false
  @Output() save = new EventEmitter<RoleFormValue>()
  @Output() cancelClicked = new EventEmitter<void>()

  readonly moduleKeys = Object.values(AppModule)
  readonly actionKeys: Array<keyof Omit<RolePermission, 'module'>> = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport']

  form!: FormGroup

  ngOnInit(): void {
    this.form = new FormGroup({
      name: new FormControl(this.initialName, { validators: [Validators.required], nonNullable: true }),
      permissions: new FormArray(
        this.moduleKeys.map(() =>
          new FormGroup({
            canView:   new FormControl(false, { nonNullable: true }),
            canCreate: new FormControl(false, { nonNullable: true }),
            canEdit:   new FormControl(false, { nonNullable: true }),
            canDelete: new FormControl(false, { nonNullable: true }),
            canExport: new FormControl(false, { nonNullable: true }),
          })
        )
      ),
    })
  }

  getPermControl(moduleIndex: number, action: string): FormControl {
    const perms = this.form.get('permissions') as FormArray
    const group = perms.at(moduleIndex) as FormGroup
    return group.get(action) as FormControl
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    const perms = this.form.get('permissions') as FormArray
    const permissions: RolePermission[] = this.moduleKeys.map((module, i) => ({
      module,
      ...(perms.at(i) as FormGroup).getRawValue() as Omit<RolePermission, 'module'>,
    }))
    this.save.emit({ name: this.form.get('name')!.value as string, permissions })
  }
}
