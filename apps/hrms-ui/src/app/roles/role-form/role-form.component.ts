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
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="role-form">
      <div class="field">
        <label class="field-label" for="roleName">{{ 'roles.form.name' | translate }}</label>
        <input
          id="roleName"
          class="field-input"
          [class.invalid]="form.controls.name.touched && form.controls.name.invalid"
          formControlName="name"
        />
        @if (form.controls.name.touched && form.controls.name.hasError('required')) {
          <span class="field-error">{{ 'common.validation.required' | translate }}</span>
        }
      </div>

      <div class="perms-section">
        <h3 class="perms-title">{{ 'roles.form.permissions' | translate }}</h3>
        <div formArrayName="permissions" class="perms-grid">
          @for (module of moduleKeys; track module; let i = $index) {
            <fieldset class="perm-card">
              <legend class="perm-module">{{ 'modules.' + module | translate }}</legend>
              <div class="perm-actions">
                @for (action of actionKeys; track action) {
                  <label class="perm-label">
                    <input
                      type="checkbox"
                      [formControl]="getPermControl(i, action)"
                      [disabled]="isSystemRole"
                    />
                    {{ 'roles.permissions.' + action | translate }}
                  </label>
                }
              </div>
            </fieldset>
          }
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-secondary" type="button" (click)="cancelClicked.emit()">
          {{ 'common.cancel' | translate }}
        </button>
        <button class="btn-primary" type="submit" [disabled]="isSystemRole">
          {{ 'common.save' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    .role-form { display: flex; flex-direction: column; gap: 24px; }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .field-label { font-size: 13px; font-weight: 500; color: #3c4043; }
    .field-input {
      height: 40px; padding: 0 12px;
      border: 1px solid #dadce0; border-radius: 6px;
      font-size: 14px; color: #202124; outline: none;
      max-width: 360px;
    }
    .field-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,.2); }
    .field-input.invalid { border-color: #d93025; }
    .field-error { font-size: 12px; color: #d93025; }

    .perms-section { display: flex; flex-direction: column; gap: 12px; }
    .perms-title { font-size: 15px; font-weight: 600; color: #202124; margin: 0; }

    .perms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }

    .perm-card {
      border: 1px solid #e8eaed;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fafafa;
    }
    .perm-module {
      font-size: 12px;
      font-weight: 600;
      color: #1a73e8;
      text-transform: uppercase;
      letter-spacing: .4px;
      padding: 0 4px;
    }

    .perm-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .perm-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #3c4043;
      cursor: pointer;
    }

    .form-actions { display: flex; gap: 10px; padding-top: 8px; }

    .btn-primary {
      height: 38px; padding: 0 20px;
      background: #1a73e8; color: #fff;
      border: none; border-radius: 6px;
      font-size: 14px; font-weight: 500; cursor: pointer;
    }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-primary:disabled { background: #a8c7fa; cursor: not-allowed; }

    .btn-secondary {
      height: 38px; padding: 0 20px;
      background: #fff; color: #3c4043;
      border: 1px solid #dadce0; border-radius: 6px;
      font-size: 14px; font-weight: 500; cursor: pointer;
    }
    .btn-secondary:hover { background: #f8f9fa; }
  `],
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
