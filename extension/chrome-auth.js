// Альтернативна авторизація через Chrome Identity API
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
        return { success: false, error: 'Не вдалося отримати токен' };
      }
    } catch (error) {
      console.error('Помилка авторизації через Chrome Identity:', error);
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
      throw new Error('Помилка отримання інформації користувача');
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
          console.error('Помилка конвертації токена:', response.status, response.statusText);
          // Якщо не вдалося конвертувати, повертаємо оригінальний токен
          return token;
        }
      }
      return null;
    } catch (error) {
      console.error('Помилка отримання ID токена:', error);
      return null;
    }
  }
} 