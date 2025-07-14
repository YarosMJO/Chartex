import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from './services/auth.service';
import { AppTranslateService } from './services/translate.service';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterOutlet, TranslateModule]
})
export class AppComponent {
  private auth = inject(AuthService);
  private translateService = inject(AppTranslateService);
  private settingsService = inject(SettingsService);
  
  user$ = this.auth.getUser();
  user = signal<any>(null);
  isAuthenticated = computed(() => !!this.user());

  constructor() {
    this.auth.getUser().subscribe(user => this.user.set(user));
    // Застосувати тему при старті застосунку
    const theme = this.settingsService.getCurrentTheme();
    this.settingsService.applyTheme(theme);
  }

  login() {
    // TODO: Отримати idToken через chrome.identity API у бекграунд-скрипті розширення
    // і викликати this.auth.loginWithGoogleCredential(idToken)
    // Приклад:
    // chrome.runtime.sendMessage({ action: 'getGoogleIdToken' }, (response) => {
    //   if (response && response.idToken) {
    //     this.auth.loginWithGoogleCredential(response.idToken).subscribe(...);
    //   }
    // });
  }

  logout() {
    this.auth.logout();
  }
} 