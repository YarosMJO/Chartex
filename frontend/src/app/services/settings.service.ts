import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppTranslateService } from './translate.service';

export interface DataCollectionSettings {
  enabled: boolean;
  collectHistory: boolean;
  collectDeviceInfo: boolean;
  collectPageTitles: boolean;
  collectVisitDuration: boolean;
}

export interface PrivacySettings {
  encryptData: boolean;
  shareAnalytics: boolean;
  showDeviceInfo: boolean;
}

export interface DisplaySettings {
  language: 'uk' | 'en';
  theme: 'default' | 'light' | 'dark';
  showDuration: boolean;
  showDevices: boolean;
  showCharts: boolean;
  showDetails: boolean;
}

export interface AppSettings {
  dataCollection: DataCollectionSettings;
  privacy: PrivacySettings;
  display: DisplaySettings;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEYS = {
    DATA_COLLECTION: 'chartex_data_collection',
    PRIVACY: 'chartex_privacy',
    DISPLAY: 'chartex_display'
  };

  private settingsSubject = new BehaviorSubject<AppSettings>(this.getDefaultSettings());
  public settings$ = this.settingsSubject.asObservable();

  constructor(private translateService: AppTranslateService) {
    this.loadSettings();
  }

  // Отримати налаштування за замовчуванням
  private getDefaultSettings(): AppSettings {
    return {
      dataCollection: {
        enabled: true,
        collectHistory: true,
        collectDeviceInfo: true,
        collectPageTitles: true,
        collectVisitDuration: true
      },
      privacy: {
        encryptData: true,
        shareAnalytics: false,
        showDeviceInfo: true
      },
      display: {
        language: 'uk',
        theme: 'default',
        showDuration: true,
        showDevices: true,
        showCharts: true,
        showDetails: true
      }
    };
  }

  // Завантажити налаштування з localStorage
  private loadSettings(): void {
    try {
      const dataCollection = this.loadFromStorage<DataCollectionSettings>(this.STORAGE_KEYS.DATA_COLLECTION);
      const privacy = this.loadFromStorage<PrivacySettings>(this.STORAGE_KEYS.PRIVACY);
      const display = this.loadFromStorage<DisplaySettings>(this.STORAGE_KEYS.DISPLAY);

      const settings: AppSettings = {
        dataCollection: { ...this.getDefaultSettings().dataCollection, ...dataCollection },
        privacy: { ...this.getDefaultSettings().privacy, ...privacy },
        display: { ...this.getDefaultSettings().display, ...display }
      };

      this.settingsSubject.next(settings);
      // Застосувати тему з налаштувань
      this.applyTheme(settings.display.theme);
    } catch (error) {
      console.error('Помилка завантаження налаштувань:', error);
      this.settingsSubject.next(this.getDefaultSettings());
    }
  }

  // Завантажити дані з localStorage
  private loadFromStorage<T>(key: string): Partial<T> {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  }

  // Застосувати тему (додає клас до body)
  public applyTheme(theme: string) {
    const body = document.body;
    body.classList.remove('theme-default', 'theme-light', 'theme-dark');
    if (theme === 'default') {
      body.classList.add('theme-default');
    } else if (theme === 'light') {
      body.classList.add('theme-light');
    } else if (theme === 'dark') {
      body.classList.add('theme-dark');
    } else {
      body.classList.add('theme-default');
    }
  }

  // Зберегти налаштування
  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.DATA_COLLECTION, JSON.stringify(settings.dataCollection));
      localStorage.setItem(this.STORAGE_KEYS.PRIVACY, JSON.stringify(settings.privacy));
      localStorage.setItem(this.STORAGE_KEYS.DISPLAY, JSON.stringify(settings.display));

      this.settingsSubject.next(settings);

      // Відправити налаштування до extension
      this.sendSettingsToExtension(settings);
    } catch (error) {
      console.error('Помилка збереження налаштувань:', error);
    }
  }

  // Оновити частину налаштувань
  updateSettings(partialSettings: Partial<AppSettings>): void {
    const currentSettings = this.settingsSubject.value;
    const newSettings = { ...currentSettings, ...partialSettings };
    this.saveSettings(newSettings);
  }

  // Оновити налаштування збору даних
  updateDataCollectionSettings(settings: Partial<DataCollectionSettings>): void {
    const currentSettings = this.settingsSubject.value;
    const newDataCollection = { ...currentSettings.dataCollection, ...settings };
    this.updateSettings({ dataCollection: newDataCollection });
  }

  // Оновити налаштування приватності
  updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    const currentSettings = this.settingsSubject.value;
    const newPrivacy = { ...currentSettings.privacy, ...settings };
    this.updateSettings({ privacy: newPrivacy });
  }

  // Оновити налаштування відображення
  updateDisplaySettings(settings: Partial<DisplaySettings>): void {
    const currentSettings = this.settingsSubject.value;
    const newDisplay = { ...currentSettings.display, ...settings };
    this.updateSettings({ display: newDisplay });
  }

  // Скинути налаштування до значень за замовчуванням
  resetSettings(): void {
    const defaultSettings = this.getDefaultSettings();
    this.saveSettings(defaultSettings);
  }

  // Отримати поточні налаштування
  getCurrentSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  // Отримати налаштування як Observable
  getSettings(): Observable<AppSettings> {
    return this.settings$;
  }

  // Відправити налаштування до extension
  private sendSettingsToExtension(settings: AppSettings): void {
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

  // Перевірити, чи збір даних увімкнено
  isDataCollectionEnabled(): boolean {
    return this.settingsSubject.value.dataCollection.enabled;
  }

  // Перевірити, чи шифрування увімкнено
  isEncryptionEnabled(): boolean {
    return this.settingsSubject.value.privacy.encryptData;
  }

  // Отримати поточну мову
  getCurrentLanguage(): string {
    return this.settingsSubject.value.display.language;
  }

  // Отримати поточну тему
  getCurrentTheme(): string {
    return this.settingsSubject.value.display.theme;
  }
} 