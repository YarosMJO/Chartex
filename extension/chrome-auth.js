// Альтернативна авторизація через Chrome Identity API

// Translation manager for error messages
class TranslationManager {
  constructor() {
    this.translations = {};
    this.currentLanguage = 'uk';
    this.loadTranslations();
  }
  
  async loadTranslations() {
    try {
      const result = await chrome.storage.local.get(['chartex_language']);
      this.currentLanguage = result.chartex_language || 'uk';
      
      const translationFile = this.currentLanguage === 'en' ? 'en.json' : 'uk.json';
      const response = await fetch(chrome.runtime.getURL(`dashboard/assets/i18n/${translationFile}`));
      this.translations = await response.json();
    } catch (error) {
      // Fallback translations
      this.translations = {
        CHROME_AUTH_ERRORS: {
          TOKEN_NOT_OBTAINED: "Не вдалося отримати токен",
          USER_INFO_ERROR: "Помилка отримання інформації користувача"
        }
      };
    }
  }
  
  getTranslation(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    if (typeof value !== 'string') {
      return key;
    }
    
    // Replace placeholders with actual values
    return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      return acc.replace(regex, paramValue);
    }, value);
  }
}

const translationManager = new TranslationManager();

class ChromeAuth {
  static async authenticate() {
    try {
      const token = await this.getAuthToken();
      if (token) {
        // Вхід у Firebase через access token
        const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
        const result = await firebase.auth().signInWithCredential(credential);
        const idToken = await result.user.getIdToken();
        // Отримати інформацію про користувача
        const userInfo = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL
        };
        return { success: true, user: userInfo, idToken };
      } else {
        return { success: false, error: translationManager.getTranslation('CHROME_AUTH_ERRORS.TOKEN_NOT_OBTAINED') };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  static async getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
  }
  
  static async getUserInfo(token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(translationManager.getTranslation('CHROME_AUTH_ERRORS.USER_INFO_ERROR'));
    }
    
    const userInfo = await response.json();
    return {
      uid: userInfo.id,
      email: userInfo.email,
      displayName: userInfo.name,
      photoURL: userInfo.picture
    };
  }
  
  static async logout() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          // Відкликати токен
          chrome.identity.removeCachedAuthToken({ token }, () => {
            resolve({ success: true });
          });
        } else {
          resolve({ success: true });
        }
      });
    });
  }
  
  static async getIdToken() {
    try {
      const token = await this.getAuthToken();
      if (token) {
        // Конвертувати Google токен в Firebase ID токен
        const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: token
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.id_token;
        } else {
          // Якщо не вдалося конвертувати, повертаємо оригінальний токен
          return token;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }
} 