import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CustomTranslateLoader } from '../utils/translate-loader';

@Injectable({
  providedIn: 'root'
})
export class AppTranslateService {
  constructor(private translate: TranslateService) {
    this.initializeTranslations();
  }

  private initializeTranslations() {
    // Встановлюємо CustomTranslateLoader
    this.translate.setDefaultLang('uk');
    
    // Визначення мови браузера
    const browserLang = this.translate.getBrowserLang();
    if (browserLang && ['uk', 'en'].includes(browserLang)) {
      this.translate.use(browserLang);
    } else {
      this.translate.use('uk');
    }
  }

  // Метод для зміни мови
  setLanguage(lang: string) {
    if (['uk', 'en'].includes(lang)) {
      this.translate.use(lang);
      localStorage.setItem('preferredLanguage', lang);
    }
  }

  // Метод для отримання поточної мови
  getCurrentLang(): string {
    return this.translate.currentLang || 'uk';
  }

  // Метод для отримання доступних мов
  getAvailableLanguages(): string[] {
    return ['uk', 'en'];
  }
} 