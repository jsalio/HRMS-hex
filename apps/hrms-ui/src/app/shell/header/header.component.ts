import { Component, Input, Output, EventEmitter } from '@angular/core'
import { TranslateModule } from '@ngx-translate/core'

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <header class="app-header">
      <h1 class="page-title">{{ pageTitle | translate }}</h1>

      <div class="header-center">
        <div class="search-box">
          <span class="material-symbols-outlined search-icon">search</span>
          <input class="search-input" type="text" [placeholder]="'shell.search_placeholder' | translate" />
        </div>
      </div>

      <div class="header-right">
        <select class="lang-select" (change)="onLanguageChange($event)" [value]="currentLang">
          <option value="es">🇪🇸 ES</option>
          <option value="en">🇺🇸 EN</option>
          <option value="pt">🇧🇷 PT</option>
        </select>
        <button class="icon-btn" [title]="'shell.notifications' | translate" aria-label="notifications">
          <span class="material-symbols-outlined">notifications</span>
        </button>
        <button class="btn-logout" (click)="logoutClicked.emit()">
          {{ 'shell.logout' | translate }}
        </button>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      height: 64px;
      background: #fff;
      border-bottom: 1px solid #e8eaed;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 24px;
      flex-shrink: 0;
    }

    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: #202124;
      margin: 0;
      white-space: nowrap;
      min-width: 120px;
    }

    .header-center { flex: 1; display: flex; justify-content: center; }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f1f3f4;
      border-radius: 24px;
      padding: 0 16px;
      height: 38px;
      width: 100%;
      max-width: 360px;
      transition: background 150ms;
    }
    .search-box:focus-within {
      background: #fff;
      outline: 2px solid #1a73e8;
    }
    .search-icon { font-size: 18px; color: #9aa0a6; }
    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 14px;
      color: #202124;
      width: 100%;
    }
    .search-input::placeholder { color: #9aa0a6; }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .lang-select {
      height: 34px;
      padding: 0 8px;
      border: 1px solid #e8eaed;
      border-radius: 8px;
      font-size: 13px;
      color: #3c4043;
      background: #fff;
      cursor: pointer;
      outline: none;
    }
    .lang-select:focus { border-color: #1a73e8; }

    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #5f6368;
      transition: background 120ms;
    }
    .icon-btn:hover { background: #f1f3f4; }
    .icon-btn .material-symbols-outlined { font-size: 22px; }

    .btn-logout {
      height: 34px;
      padding: 0 16px;
      background: transparent;
      border: 1px solid #e8eaed;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #3c4043;
      cursor: pointer;
      transition: background 120ms;
    }
    .btn-logout:hover { background: #f8f9fa; }
  `],
})
export class HeaderComponent {
  @Input() pageTitle = 'shell.nav.dashboard'
  @Input() currentLang = 'es'
  @Output() logoutClicked = new EventEmitter<void>()
  @Output() languageChanged = new EventEmitter<string>()

  onLanguageChange(event: Event): void {
    this.languageChanged.emit((event.target as HTMLSelectElement).value)
  }
}
