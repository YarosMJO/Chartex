import { Injectable } from '@angular/core';
import { Auth, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged, User } from '@angular/fire/auth';
import { inject } from '@angular/core';
import { from, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth = inject(Auth);

  // Вхід через Google для Chrome Extension (через idToken)
  loginWithGoogleCredential(idToken: string) {
    console.log('loginWithGoogleCredential, idToken:', idToken);
    // Створюємо credential для Firebase
    const credential = GoogleAuthProvider.credential(idToken);
    // Вхід через credential
    return from(signInWithCredential(this.auth, credential));
  }

  // Вихід
  logout() {
    return from(signOut(this.auth));
  }

  // Поточний користувач як Observable
  getUser(): Observable<User | null> {
    return new Observable(subscriber => {
      return onAuthStateChanged(this.auth, user => subscriber.next(user));
    });
  }

  // Поточний користувач (Promise)
  getCurrentUser(): Promise<User | null> {
    return Promise.resolve(this.auth.currentUser);
  }

  // Поточний токен користувача
  async getCurrentUserToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (user) {
      return user.getIdToken();
    }
    return null;
  }

  // Отримати ключ шифрування з extension
  async getEncryptionKey(): Promise<string | null> {
    try {
      console.log('Спроба отримання ключа шифрування...');
      
      // Перевірити, чи доступний chrome.runtime API
      if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime && (window as any).chrome.runtime.sendMessage) {
        console.log('Chrome runtime API доступний, запитую ключ у extension...');
        
        // Запитати ключ у extension
        const response = await new Promise<any>((resolve) => {
          (window as any).chrome.runtime.sendMessage({ action: 'getEncryptionKey' }, resolve);
        });
        
        console.log('Відповідь від extension:', response);
        
        if (response && response.encryptionKey) {
          console.log('Ключ шифрування отримано з extension:', {
            hasKey: !!response.encryptionKey,
            keyLength: response.encryptionKey?.length,
            keyPreview: response.encryptionKey?.substring(0, 10) + '...'
          });
          return response.encryptionKey;
        }
      } else {
        console.log('Chrome runtime API недоступний');
      }
      
      // Fallback: спробувати отримати з localStorage
      const localKey = localStorage.getItem('chartex_encryption_key');
      console.log('Fallback: ключ з localStorage:', { hasKey: !!localKey });
      return localKey;
    } catch (error) {
      console.error('Помилка отримання ключа шифрування:', error);
      return null;
    }
  }

  // Observable<boolean> для стану авторизації
  isAuthenticated() {
    return new Observable<boolean>(subscriber => {
      return onAuthStateChanged(this.auth, user => subscriber.next(!!user));
    });
  }
} 