import { TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';

export class CustomTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<any> {
    // Завантажуємо файл перекладів з assets/i18n
    return new Observable(observer => {
      fetch('assets/i18n/' + lang + '.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          observer.next(data);
          observer.complete();
        })
        .catch(error => {
          console.error(`Error loading translation file for ${lang}:`, error);
          // Повертаємо порожній об'єкт як fallback
          observer.next({});
          observer.complete();
        });
    });
  }
} 