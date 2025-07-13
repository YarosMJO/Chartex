import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SettingsService, AppSettings } from '../../services/settings.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatMenuModule,
    MatSnackBarModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ]
})
export class SettingsComponent implements OnInit {
  currentUser: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null = null;
  loading = false;
  hasUnsavedChanges = false;
  originalSettings: AppSettings | null = null;
  
  // Налаштування збору даних
  dataCollectionSettings: {
    enabled: boolean;
    collectHistory: boolean;
    collectDeviceInfo: boolean;
    collectPageTitles: boolean;
    collectVisitDuration: boolean;
  } = {
    enabled: true,
    collectHistory: true,
    collectDeviceInfo: true,
    collectPageTitles: true,
    collectVisitDuration: true
  };

  // Налаштування приватності
  privacySettings: {
    encryptData: boolean;
    shareAnalytics: boolean;
    showDeviceInfo: boolean;
  } = {
    encryptData: true,
    shareAnalytics: false,
    showDeviceInfo: true
  };

  // Налаштування відображення
  displaySettings: {
    language: 'uk' | 'en' | 'ru';
    theme: 'light' | 'dark' | 'auto';
    timeFormat: '24h' | '12h';
    dateFormat: 'dd.mm.yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
  } = {
    language: 'uk',
    theme: 'light',
    timeFormat: '24h',
    dateFormat: 'dd.mm.yyyy'
  };

  constructor(
    public authService: AuthService,
    private router: Router,
    private settingsService: SettingsService
  ) {}

  ngOnInit() {
    this.authService.getUser().subscribe(user => {
      this.currentUser = user;
      if (!user) {
        this.router.navigate(['/dashboard']);
      }
    });
    
    this.loadSettings();
  }

  // Завантаження збережених налаштувань
  loadSettings() {
    this.settingsService.getSettings().subscribe(settings => {
      this.dataCollectionSettings = { ...this.dataCollectionSettings, ...settings.dataCollection };
      this.privacySettings = { ...this.privacySettings, ...settings.privacy };
      this.displaySettings = { ...this.displaySettings, ...settings.display };
    });
  }

  // Збереження налаштувань
  saveSettings() {
    const settings: AppSettings = {
      dataCollection: this.dataCollectionSettings,
      privacy: this.privacySettings,
      display: this.displaySettings
    };
    
    this.settingsService.saveSettings(settings);
  }

  // Автоматичне збереження при зміні налаштувань
  onSettingChange() {
    this.saveSettings();
  }

  // Скидання налаштувань до значень за замовчуванням
  resetSettings() {
    this.settingsService.resetSettings();
    this.loadSettings();
  }

  // Повернення до дашборду
  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // Вихід з системи
  logout() {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/dashboard']);
    });
  }
} 