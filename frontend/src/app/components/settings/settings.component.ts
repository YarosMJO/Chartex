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
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SettingsService, AppSettings } from '../../services/settings.service';
import { ApiService } from '../../services/api.service';
import { AppTranslateService } from '../../services/translate.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
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
    MatProgressSpinnerModule,
    TranslateModule,
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
    language: 'uk' | 'en';
    theme: 'default' | 'light' | 'dark';
    showDuration: boolean;
    showDevices: boolean;
    showCharts: boolean;
    showDetails: boolean;
  } = {
    language: 'uk',
    theme: 'default',
    showDuration: true,
    showDevices: true,
    showCharts: true,
    showDetails: true
  };

  constructor(
    public authService: AuthService,
    private router: Router,
    private settingsService: SettingsService,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private translateService: AppTranslateService
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
    this.loading = true;
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.dataCollectionSettings = { ...this.dataCollectionSettings, ...settings.dataCollection };
        this.privacySettings = { ...this.privacySettings, ...settings.privacy };
        this.displaySettings = { ...this.displaySettings, ...settings.display };
        this.originalSettings = JSON.parse(JSON.stringify(settings)); // Deep copy
        this.hasUnsavedChanges = false;
        this.loading = false;
      },
      error: (error) => {
        console.error('Помилка завантаження налаштувань:', error);
        this.snackBar.open('Помилка завантаження налаштувань', 'Закрити', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  // Збереження налаштувань
  saveSettings() {
    this.loading = true;
    const settings: AppSettings = {
      dataCollection: this.dataCollectionSettings,
      privacy: this.privacySettings,
      display: this.displaySettings
    };
    
    try {
      this.settingsService.saveSettings(settings);
      this.originalSettings = JSON.parse(JSON.stringify(settings));
      this.hasUnsavedChanges = false;
      this.snackBar.open('Налаштування збережено', 'Закрити', { duration: 2000 });
      
      // Застосування змін
      this.applySettings(settings);
    } catch (error) {
      console.error('Помилка збереження налаштувань:', error);
      this.snackBar.open('Помилка збереження налаштувань', 'Закрити', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  // Автоматичне збереження при зміні налаштувань
  onSettingChange() {
    this.checkForUnsavedChanges();
    
    // Автоматично застосовуємо деякі налаштування
    this.applyImmediateSettings();
  }

  // Зміна мови
  onLanguageChange() {
    this.checkForUnsavedChanges();
    
    // Застосовуємо мову одразу через AppTranslateService
    this.translateService.setLanguage(this.displaySettings.language);
    
    // Зберігаємо налаштування
    this.saveSettings();
  }

  // Перевірка на незбережені зміни
  private checkForUnsavedChanges() {
    if (!this.originalSettings) return;
    
    const currentSettings: AppSettings = {
      dataCollection: this.dataCollectionSettings,
      privacy: this.privacySettings,
      display: this.displaySettings
    };
    
    this.hasUnsavedChanges = JSON.stringify(currentSettings) !== JSON.stringify(this.originalSettings);
  }

  // Застосування налаштувань
  private applySettings(settings: AppSettings) {
    // Застосування теми
    this.applyTheme(settings.display.theme);
    
    // Застосування мови
    this.applyLanguage(settings.display.language);
    
    // Відправка налаштувань до extension
    this.sendSettingsToExtension(settings);
  }

  // Застосування теми
  private applyTheme(theme: string) {
    const body = document.body;
    body.classList.remove('theme-default', 'theme-light', 'theme-dark');

    if (theme === 'default') {
      body.classList.add('theme-default');
    } else if (theme === 'light') {
      body.classList.add('theme-light');
    } else if (theme === 'dark') {
      body.classList.add('theme-dark');
    } else {
      // fallback: дефолтна тема
      body.classList.add('theme-default');
    }
  }

  // Застосування мови
  private applyLanguage(language: string) {
    // Використовуємо AppTranslateService для зміни мови
    this.translateService.setLanguage(language);
    
    // Зберігаємо мову в localStorage для використання в інших компонентах
    localStorage.setItem('chartex_language', language);
    
    // Відправляємо подію про зміну мови
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language } }));
  }

  // Застосування налаштувань, які не потребують збереження
  private applyImmediateSettings() {
    // Застосовуємо тему одразу
    this.applyTheme(this.displaySettings.theme);
    
    // Застосовуємо мову одразу
    this.applyLanguage(this.displaySettings.language);
  }

  // Відправка налаштувань до extension
  private sendSettingsToExtension(settings: AppSettings) {
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      try {
        (window as any).chrome.runtime.sendMessage({
          action: 'updateSettings',
          settings: settings
        });
      } catch (error) {
        console.error('Помилка відправки налаштувань до extension:', error);
      }
    }
  }

  // Скидання налаштувань до значень за замовчуванням
  resetSettings() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Скинути налаштування',
        message: 'Ви впевнені, що хочете скинути всі налаштування до значень за замовчуванням? Ця дія не може бути скасована.',
        confirmText: 'Скинути',
        cancelText: 'Скасувати'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loading = true;
        try {
          this.settingsService.resetSettings();
          this.loadSettings();
          this.snackBar.open('Налаштування скинуто', 'Закрити', { duration: 2000 });
        } catch (error) {
          console.error('Помилка скидання налаштувань:', error);
          this.snackBar.open('Помилка скидання налаштувань', 'Закрити', { duration: 3000 });
        } finally {
          this.loading = false;
        }
      }
    });
  }

  // Експорт налаштувань
  exportSettings() {
    const settings: AppSettings = {
      dataCollection: this.dataCollectionSettings,
      privacy: this.privacySettings,
      display: this.displaySettings
    };
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `chartex-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    this.snackBar.open('Налаштування експортовано', 'Закрити', { duration: 2000 });
  }

  // Імпорт налаштувань
  importSettings(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const settings: AppSettings = JSON.parse(e.target.result);
        
        // Валідація налаштувань
        if (this.validateSettings(settings)) {
          this.dataCollectionSettings = settings.dataCollection;
          this.privacySettings = settings.privacy;
          this.displaySettings = settings.display;
          this.hasUnsavedChanges = true;
          this.snackBar.open('Налаштування імпортовано', 'Закрити', { duration: 2000 });
        } else {
          this.snackBar.open('Невірний формат файлу налаштувань', 'Закрити', { duration: 3000 });
        }
      } catch (error) {
        console.error('Помилка імпорту налаштувань:', error);
        this.snackBar.open('Помилка імпорту налаштувань', 'Закрити', { duration: 3000 });
      }
    };
    reader.readAsText(file);
  }

  // Валідація налаштувань
  private validateSettings(settings: any): settings is AppSettings {
    return (
      settings &&
      settings.dataCollection &&
      settings.privacy &&
      settings.display &&
      typeof settings.dataCollection.enabled === 'boolean' &&
      typeof settings.privacy.encryptData === 'boolean' &&
      typeof settings.display.language === 'string'
    );
  }

  // Повернення до дашборду з перевіркою незбережених змін
  goBack() {
    if (this.hasUnsavedChanges) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: 'Незбережені зміни',
          message: 'У вас є незбережені зміни. Ви впевнені, що хочете вийти без збереження?',
          confirmText: 'Вийти',
          cancelText: 'Залишитися'
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.router.navigate(['/dashboard']);
        }
      });
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  // Вихід з системи
  logout() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Вихід з системи',
        message: 'Ви впевнені, що хочете вийти з системи?',
        confirmText: 'Вийти',
        cancelText: 'Скасувати'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loading = true;
        this.authService.logout().subscribe({
          next: () => {
            this.router.navigate(['/dashboard']);
            this.snackBar.open('Ви успішно вийшли з системи', 'Закрити', { duration: 2000 });
          },
          error: (error) => {
            console.error('Помилка виходу:', error);
            this.snackBar.open('Помилка виходу з системи', 'Закрити', { duration: 3000 });
            this.loading = false;
          }
        });
      }
    });
  }

  // Очищення даних
  clearData() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Очищення даних',
        message: 'Ви впевнені, що хочете видалити всі зібрані дані? Ця дія не може бути скасована.',
        confirmText: 'Видалити',
        cancelText: 'Скасувати',
        type: 'warning'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loading = true;
        
        // Очищення даних через API
        this.apiService.clearUserData().then((result) => {
          this.snackBar.open('Дані успішно очищено', 'Закрити', { duration: 2000 });
          
          // Очищення локальних даних
          this.clearLocalData();
          
          this.loading = false;
        }).catch((error: any) => {
          console.error('Помилка очищення даних:', error);
          this.snackBar.open('Помилка очищення даних', 'Закрити', { duration: 3000 });
          this.loading = false;
        });
      }
    });
  }

  // Очищення локальних даних
  private clearLocalData() {
    try {
      // Очищення localStorage
      const keysToKeep = ['chartex_encryption_key', 'chartex_data_collection', 'chartex_privacy', 'chartex_display'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key) && key.startsWith('chartex_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Очищення sessionStorage
      sessionStorage.clear();
      
      // Відправка повідомлення до extension про очищення
      if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
        try {
          (window as any).chrome.runtime.sendMessage({
            action: 'clearData'
          });
        } catch (error) {
          console.error('Помилка відправки повідомлення до extension:', error);
        }
      }
    } catch (error) {
      console.error('Помилка очищення локальних даних:', error);
    }
  }

  // Перевірка статусу extension
  checkExtensionStatus(): boolean {
    return typeof (window as any).chrome !== 'undefined' && 
           (window as any).chrome.runtime && 
           (window as any).chrome.runtime.sendMessage;
  }

  // Тестування з'єднання з extension
  testExtensionConnection() {
    if (!this.checkExtensionStatus()) {
      this.snackBar.open('Extension не знайдено', 'Закрити', { duration: 3000 });
      return;
    }

    this.loading = true;
    try {
      (window as any).chrome.runtime.sendMessage({ action: 'ping' }, (response: any) => {
        this.loading = false;
        if (response && response.success) {
          this.snackBar.open('Extension працює нормально', 'Закрити', { duration: 2000 });
        } else {
          this.snackBar.open('Помилка з\'єднання з extension', 'Закрити', { duration: 3000 });
        }
      });
    } catch (error) {
      this.loading = false;
      this.snackBar.open('Помилка з\'єднання з extension', 'Закрити', { duration: 3000 });
    }
  }

  // Отримання інформації про extension
  getExtensionInfo() {
    if (!this.checkExtensionStatus()) {
      return null;
    }

    try {
      return {
        version: (window as any).chrome.runtime.getManifest()?.version || 'Невідомо',
        name: (window as any).chrome.runtime.getManifest()?.name || 'Chartex Extension',
        description: (window as any).chrome.runtime.getManifest()?.description || 'Extension для збору даних'
      };
    } catch (error) {
      console.error('Помилка отримання інформації про extension:', error);
      return null;
    }
  }
} 