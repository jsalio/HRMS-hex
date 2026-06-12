import { Component, EventEmitter, Output, Input } from '@angular/core'
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms'
import { TranslateModule } from '@ngx-translate/core'

export interface LoginFormValue {
  email: string
  password: string
}

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <h1>{{ 'auth.login.title' | translate }}</h1>

      @if (errorMessage) {
        <div class="error-banner" role="alert">{{ errorMessage | translate }}</div>
      }

      <div>
        <label for="email">{{ 'auth.login.email' | translate }}</label>
        <input id="email" type="email" formControlName="email" autocomplete="email" />
        @if (form.controls.email.touched && form.controls.email.hasError('required')) {
          <span class="field-error">{{ 'common.validation.required' | translate }}</span>
        }
        @if (form.controls.email.touched && form.controls.email.hasError('email')) {
          <span class="field-error">{{ 'common.validation.email_format' | translate }}</span>
        }
      </div>

      <div>
        <label for="password">{{ 'auth.login.password' | translate }}</label>
        <input id="password" type="password" formControlName="password" autocomplete="current-password" />
        @if (form.controls.password.touched && form.controls.password.hasError('required')) {
          <span class="field-error">{{ 'common.validation.required' | translate }}</span>
        }
      </div>

      <button type="submit" [disabled]="isLoading">
        @if (isLoading) {
          <span class="spinner" aria-hidden="true"></span>
        }
        {{ 'auth.login.submit' | translate }}
      </button>
    </form>
  `,
})
export class LoginFormComponent {
  @Input() isLoading = false
  @Input() errorMessage: string | null = null
  @Output() submitted = new EventEmitter<LoginFormValue>()

  form = new FormGroup({
    email: new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
    password: new FormControl('', { validators: [Validators.required], nonNullable: true }),
  })

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    this.submitted.emit(this.form.getRawValue())
  }
}
