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
    const encrypted = btoa(dataStr + '|' + key);
    return encrypted;
  }
  
  static decrypt(encryptedData, key) {
    try {
      const decrypted = atob(encryptedData);
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
} 