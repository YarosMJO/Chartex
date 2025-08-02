import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterOutlet, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private settingsService = inject(SettingsService);

  constructor() {
    const theme = this.settingsService.getCurrentTheme();
    this.settingsService.applyTheme(theme);
  }
} 