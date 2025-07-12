// Спрощена версія CryptoJS для Chrome розширення
class CryptoUtils {
  static generateKey() {
    return this.randomString(32);
  }
  
  static randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  static encrypt(data, key) {
    // Просте шифрування для демонстрації
    const dataStr = JSON.stringify(data);
    // Безпечне кодування для Unicode символів
    const encoded = this.utf8ToBase64(dataStr + '|' + key);
    return encoded;
  }
  
  // Аліас для encrypt (для сумісності)
  static encryptData(data, key) {
    return this.encrypt(data, key);
  }
  
  static decrypt(encryptedData, key) {
    try {
      const decrypted = this.base64ToUtf8(encryptedData);
      const parts = decrypted.split('|');
      if (parts[1] === key) {
        return JSON.parse(parts[0]);
      }
      throw new Error('Invalid key');
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }
  
  // Аліас для decrypt (для сумісності)
  static decryptData(encryptedData, key) {
    return this.decrypt(encryptedData, key);
  }
  
  static hashDomain(url) {
    try {
      const domain = new URL(url).hostname;
      return this.simpleHash(domain + 'chartex');
    } catch {
      return this.simpleHash(url + 'chartex');
    }
  }
  
  static simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  static generateDeviceId() {
    return this.randomString(8);
  }
  
  static generateSessionId() {
    return this.randomString(16);
  }
  
  // Безпечне кодування Unicode в Base64
  static utf8ToBase64(str) {
    try {
      // Для Service Worker використовуємо TextEncoder
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
      return btoa(binaryString);
    } catch (error) {
      console.error('UTF8 to Base64 error:', error);
      // Fallback для старих браузерів
      return btoa(unescape(encodeURIComponent(str)));
    }
  }
  
  // Безпечне декодування Base64 в Unicode
  static base64ToUtf8(base64) {
    try {
      // Для Service Worker використовуємо TextDecoder
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    } catch (error) {
      console.error('Base64 to UTF8 error:', error);
      // Fallback для старих браузерів
      return decodeURIComponent(escape(atob(base64)));
    }
  }
} 