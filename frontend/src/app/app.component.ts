import { Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppTranslateService } from './services/translate.service';

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
  
  user$ = this.auth.getUser();
  user = signal<any>(null);
  isAuthenticated = computed(() => !!this.user());

  constructor() {
    this.auth.getUser().subscribe(user => this.user.set(user));
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