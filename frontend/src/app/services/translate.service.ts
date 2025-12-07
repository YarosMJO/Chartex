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
    this.translate.setDefaultLang('ua');
    
    // Спочатку перевіряємо збережену мову
    const savedLanguage = localStorage.getItem('chartex_language');
    if (savedLanguage && ['ua', 'en'].includes(savedLanguage)) {
      this.translate.use(savedLanguage);
      return;
    }
    
    // Якщо збереженої мови немає, визначаємо мову браузера
    const browserLang = this.translate.getBrowserLang();
    if (browserLang && ['ua', 'en'].includes(browserLang)) {
      this.translate.use(browserLang);
    } else {
      this.translate.use('ua');
    }
  }

  // Метод для зміни мови
  setLanguage(lang: string) {
    if (['ua', 'en'].includes(lang)) {
      this.translate.use(lang);
      localStorage.setItem('chartex_language', lang);
    }
  }

  // Метод для отримання поточної мови
  getCurrentLang(): string {
    return this.translate.currentLang || 'ua';
  }

  // Метод для отримання доступних мов
  getAvailableLanguages(): string[] {
    return ['ua', 'en'];
  }
} 