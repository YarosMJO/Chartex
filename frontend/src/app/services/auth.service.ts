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
      // Спочатку спробувати отримати з chrome.storage.local
      if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.storage && (window as any).chrome.storage.local) {
        const result = await new Promise<any>((resolve) => {
          (window as any).chrome.storage.local.get(['chartex_encryption_key'], resolve);
        });
        
        if (result.chartex_encryption_key) {
          return result.chartex_encryption_key;
        }
      }
      
      // Fallback: спробувати отримати з localStorage (для сумісності)
      const localKey = localStorage.getItem('chartex_encryption_key');
      if (localKey) {
        return localKey;
      }
      
      // Перевірити, чи доступний chrome.runtime API
      if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime && (window as any).chrome.runtime.sendMessage) {
        // Запитати ключ у extension
        const response = await new Promise<any>((resolve) => {
          (window as any).chrome.runtime.sendMessage({ action: 'getEncryptionKey' }, resolve);
        });
        
        if (response && response.encryptionKey) {
          // Зберегти в chrome.storage.local для майбутнього використання
          if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.storage && (window as any).chrome.storage.local) {
            (window as any).chrome.storage.local.set({ chartex_encryption_key: response.encryptionKey });
          }
          return response.encryptionKey;
        }
      }
      
      return null;
    } catch (error) {
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