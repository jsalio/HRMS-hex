import { Component, Input, Output, EventEmitter } from '@angular/core'
import { TranslateModule, TranslateService } from '@ngx-translate/core'

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <header class="app-header">
      <span class="user-email">{{ userEmail }}</span>
      <select (change)="onLanguageChange($event)" [value]="currentLang">
        <option value="es">ES</option>
        <option value="en">EN</option>
        <option value="pt">PT</option>
      </select>
      <button (click)="logoutClicked.emit()">{{ 'shell.logout' | translate }}</button>
    </header>
  `,
})
export class HeaderComponent {
  @Input() userEmail = ''
  @Input() currentLang = 'es'
  @Output() logoutClicked = new EventEmitter<void>()
  @Output() languageChanged = new EventEmitter<string>()

  onLanguageChange(event: Event): void {
    const lang = (event.target as HTMLSelectElement).value
    this.languageChanged.emit(lang)
  }
}
