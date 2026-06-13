import { Component, EventEmitter, Output, Input, signal } from '@angular/core'
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
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">

      <div class="field">
        <label class="field-label" for="email">{{ 'auth.login.email' | translate }}</label>
        <input
          id="email"
          class="field-input"
          [class.invalid]="form.controls.email.touched && form.controls.email.invalid"
          type="email"
          formControlName="email"
          autocomplete="email"
          [placeholder]="'auth.login.email_placeholder' | translate"
        />
        @if (form.controls.email.touched && form.controls.email.hasError('required')) {
          <span class="field-error">{{ 'common.validation.required' | translate }}</span>
        }
        @if (form.controls.email.touched && form.controls.email.hasError('email')) {
          <span class="field-error">{{ 'common.validation.email_format' | translate }}</span>
        }
      </div>

      <div class="field">
        <label class="field-label" for="password">{{ 'auth.login.password' | translate }}</label>
        <div class="input-wrapper">
          <input
            id="password"
            class="field-input password-input"
            [class.invalid]="form.controls.password.touched && form.controls.password.invalid"
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="eye-btn"
            (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="(showPassword() ? 'auth.login.hide_password' : 'auth.login.show_password') | translate"
          >
            <span class="material-symbols-outlined">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
          </button>
        </div>
        @if (form.controls.password.touched && form.controls.password.hasError('required')) {
          <span class="field-error">{{ 'common.validation.required' | translate }}</span>
        }
      </div>

      <button class="btn-primary" type="submit" [disabled]="isLoading">
        @if (isLoading) {
          <span class="spinner" aria-hidden="true"></span>
        }
        {{ 'auth.login.submit' | translate }}
      </button>

    </form>
  `,
  styles: [`
    .login-form { display: flex; flex-direction: column; gap: 18px; }

    .field { display: flex; flex-direction: column; gap: 6px; }

    .field-label {
      font-size: 13px;
      font-weight: 500;
      color: #3c4043;
    }

    .field-input {
      height: 44px;
      padding: 0 12px;
      border: 1.5px solid #dadce0;
      border-radius: 8px;
      font-size: 14px;
      color: #202124;
      outline: none;
      font-family: inherit;
      transition: border-color 150ms, box-shadow 150ms;
      width: 100%;
      box-sizing: border-box;
    }
    .field-input:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,.15); }
    .field-input.invalid { border-color: #d93025; }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-input { padding-right: 44px; }
    .eye-btn {
      position: absolute;
      right: 0;
      top: 0;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #9aa0a6;
      border-radius: 0 8px 8px 0;
    }
    .eye-btn:hover { color: #5f6368; }
    .eye-btn .material-symbols-outlined { font-size: 20px; }

    .field-error { font-size: 12px; color: #d93025; }

    .btn-primary {
      height: 46px;
      background: #1a73e8;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 150ms;
      margin-top: 8px;
      font-family: inherit;
    }
    .btn-primary:hover:not(:disabled) { background: #1557b0; }
    .btn-primary:disabled { background: #a8c7fa; cursor: not-allowed; }

    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class LoginFormComponent {
  @Input() isLoading = false
  @Output() submitted = new EventEmitter<LoginFormValue>()

  readonly showPassword = signal(false)

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
