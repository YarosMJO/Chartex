import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, RouterOutlet]
})
export class AppComponent {
  user$ = this.auth.getUser();

  constructor(private auth: AuthService) {}

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