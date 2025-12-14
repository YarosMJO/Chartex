import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { SettingsService, AppSettings } from '../../services/settings.service';
import { ApiService } from '../../services/api.service';
import { AppTranslateService } from '../../services/translate.service';
import { CanDeactivate } from '@angular/router';

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
    MatProgressSpinnerModule,
    TranslateModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit {
  currentUser: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null = null;
  loading = false;
  // Відстеження попередніх значень для уникнення зайвих оновлень
  private previousLanguage: string = 'ua';
  private previousTheme: string = 'default';
  
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

  // Налаштування відображення
  displaySettings: {
    language: 'ua' | 'en';
    theme: 'default' | 'light' | 'dark';
    showDuration: boolean;
    showDevices: boolean;
    showCharts: boolean;
    showDetails: boolean;
  } = {
    language: 'ua',
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
    private translateService: AppTranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Ініціалізуємо мову з localStorage
    const savedLanguage = localStorage.getItem('chartex_language') || 'ua';
    this.applyLanguage(savedLanguage as 'ua' | 'en');
    
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
        this.displaySettings = { ...this.displaySettings, ...settings.display };
        
        // Ініціалізуємо попередні значення
        this.previousLanguage = this.displaySettings.language;
        this.previousTheme = this.displaySettings.theme;
        
        // Застосувати мову з налаштувань
        this.applyLanguage(this.displaySettings.language);
        
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Помилка завантаження налаштувань:', error);
        this.snackBar.open('Помилка завантаження налаштувань', 'Закрити', { duration: 3000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Зберігати налаштування одразу при зміні будь-якого поля
  onSettingChange() {
    // Перевіряємо чи дійсно змінилася тема
    if (this.displaySettings.theme !== this.previousTheme) {
      this.previousTheme = this.displaySettings.theme;
      const settings: AppSettings = {
        dataCollection: this.dataCollectionSettings,
        display: this.displaySettings
      };
      this.settingsService.saveSettings(settings);
      this.applyImmediateSettings();
      this.cdr.markForCheck();
    } else {
      // Зберігаємо налаштування для інших змін
      const settings: AppSettings = {
        dataCollection: this.dataCollectionSettings,
        display: this.displaySettings
      };
      this.settingsService.saveSettings(settings);
      this.cdr.markForCheck();
    }
  }

  // Зміна мови
  onLanguageChange() {
    // Перевіряємо чи дійсно змінилася мова
    if (this.displaySettings.language !== this.previousLanguage) {
      this.previousLanguage = this.displaySettings.language;
      const settings: AppSettings = {
        dataCollection: this.dataCollectionSettings,
        display: this.displaySettings
      };
      this.settingsService.saveSettings(settings);
      this.applyLanguage(this.displaySettings.language);
      this.cdr.markForCheck();
    }
  }

  // Зміна налаштувань збору даних
  onDataCollectionChange() {
    const settings: AppSettings = {
      dataCollection: this.dataCollectionSettings,
      display: this.displaySettings
    };
    this.settingsService.saveSettings(settings);
    // Відправити налаштування до extension для негайного застосування
    this.sendSettingsToExtension({
      dataCollection: this.dataCollectionSettings,
      display: this.displaySettings
    });
    this.cdr.markForCheck();
  }

  // Зміна налаштувань відображення
  onDisplayChange() {
    const settings: AppSettings = {
      dataCollection: this.dataCollectionSettings,
      display: this.displaySettings
    };
    this.settingsService.saveSettings(settings);
    this.cdr.markForCheck();
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
    this.loading = true;
    this.cdr.markForCheck();
    try {
      this.settingsService.resetSettings();
      this.loadSettings();
      this.snackBar.open('Налаштування скинуто', 'Закрити', { duration: 2000 });
    } catch (error) {
      console.error('Помилка скидання налаштувань:', error);
      this.snackBar.open('Помилка скидання налаштувань', 'Закрити', { duration: 3000 });
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // Експорт налаштувань
  exportSettings() {
    // Експортуємо тільки ті поля, які відображаються в UI
    const exportData = {
      dataCollection: {
        enabled: this.dataCollectionSettings.enabled,
        collectDeviceInfo: this.dataCollectionSettings.collectDeviceInfo,
        collectPageTitles: this.dataCollectionSettings.collectPageTitles,
        collectVisitDuration: this.dataCollectionSettings.collectVisitDuration
      },
      display: {
        language: this.displaySettings.language,
        theme: this.displaySettings.theme
      }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
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
        const importedData = JSON.parse(e.target.result);
        
        // Валідація налаштувань
        if (this.validateSettings(importedData)) {
          // Оновлюємо тільки видимі поля, зберігаючи інші значення
          if (importedData.dataCollection) {
            if (importedData.dataCollection.enabled !== undefined) {
              this.dataCollectionSettings.enabled = importedData.dataCollection.enabled;
            }
            if (importedData.dataCollection.collectDeviceInfo !== undefined) {
              this.dataCollectionSettings.collectDeviceInfo = importedData.dataCollection.collectDeviceInfo;
            }
            if (importedData.dataCollection.collectPageTitles !== undefined) {
              this.dataCollectionSettings.collectPageTitles = importedData.dataCollection.collectPageTitles;
            }
            if (importedData.dataCollection.collectVisitDuration !== undefined) {
              this.dataCollectionSettings.collectVisitDuration = importedData.dataCollection.collectVisitDuration;
            }
          }
          
          if (importedData.display) {
            if (importedData.display.language !== undefined) {
              this.displaySettings.language = importedData.display.language;
            }
            if (importedData.display.theme !== undefined) {
              this.displaySettings.theme = importedData.display.theme;
            }
          }
          
          // Зберегти та застосувати налаштування автоматично
          const fullSettings: AppSettings = {
            dataCollection: this.dataCollectionSettings,
            display: this.displaySettings
          };
          this.settingsService.saveSettings(fullSettings);
          this.applySettings(fullSettings);
          
          this.snackBar.open('Налаштування імпортовано та застосовано', 'Закрити', { duration: 2000 });
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
  private validateSettings(settings: any): boolean {
    if (!settings || !settings.dataCollection || !settings.display) {
      return false;
    }
    
    // Перевіряємо обов'язкові поля для dataCollection
    if (typeof settings.dataCollection.enabled !== 'boolean') {
      return false;
    }
    
    // Перевіряємо обов'язкові поля для display
    if (typeof settings.display.language !== 'string' || 
        !['ua', 'en'].includes(settings.display.language)) {
      return false;
    }
    
    if (settings.display.theme !== undefined && 
        !['default', 'light', 'dark'].includes(settings.display.theme)) {
      return false;
    }
    
    return true;
  }

  // Видалити goBack з діалогом unsaved, залишити простий перехід
  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // Видалити logout з діалогом unsaved, залишити простий діалог підтвердження виходу
  logout() {
    this.loading = true;
    this.cdr.markForCheck();
    this.authService.logout().subscribe({
      next: () => {
        this.loading = false;
        this.cdr.markForCheck();
        this.snackBar.open('Ви успішно вийшли з системи', 'Закрити', { duration: 2000 });
        // Закрити сторінку після logout
        this.closePage();
      },
      error: (error) => {
        console.error('Помилка виходу:', error);
        this.loading = false;
        this.cdr.markForCheck();
        this.snackBar.open('Помилка виходу з системи', 'Закрити', { duration: 3000 });
      }
    });
  }

  // Закрити поточну сторінку (для extension)
  private closePage() {
    // Затримка для показу повідомлення про успішний вихід
    setTimeout(() => {
      // Для extension options pages window.close() має працювати
      if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
        // Спочатку спробуємо window.close()
        window.close();
        // Якщо window.close() не спрацює, надсилаємо повідомлення до background script як fallback
        try {
          (window as any).chrome.runtime.sendMessage({ action: 'closeTab' });
        } catch (error) {
          // Якщо помилка, ігноруємо
        }
      } else {
        window.close();
      }
    }, 500); // Затримка для показу повідомлення
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