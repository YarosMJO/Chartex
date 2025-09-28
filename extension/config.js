// Конфігурація для Chrome Extension
const config = {
  // API URL для різних середовищ
  api: {
    development: 'http://localhost:5001/api',
    production: 'http://localhost:5001/api' // Використовуємо Docker backend порт
  },
  
  // Firebase конфігурація
  firebase: {
    apiKey: "AIzaSyAeWPZOm7CXCslgyn63ScMBcGK_wg8tUNA",
    authDomain: "chartex-2eae7.firebaseapp.com",
    projectId: "chartex-2eae7",
    storageBucket: "chartex-2eae7.firebasestorage.app",
    messagingSenderId: "264979508048",
    appId: "1:264979508048:web:c9501813cf613160a5da55",
    measurementId: "G-PGGLE2T3TD"
  },
  
  // Налаштування збору даних
  collection: {
    batchSize: 10,
    batchTimeout: 1000, // 1 секунда
    historyDays: 7 // Кількість днів історії для збору
  },
  
  // Налаштування шифрування
  encryption: {
    keyLength: 32,
    algorithm: 'AES-256-CBC'
  }
};

// Визначення середовища для Service Worker
const isDevelopment = typeof window === 'undefined' || 
                     (window.location && (
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.protocol === 'chrome-extension:'
                     ));

// Експорт конфігурації
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ...config,
    environment: isDevelopment ? 'development' : 'production',
    apiUrl: isDevelopment ? config.api.development : config.api.production
  };
} else if (typeof window !== 'undefined') {
  window.chartexConfig = {
    ...config,
    environment: isDevelopment ? 'development' : 'production',
    apiUrl: isDevelopment ? config.api.development : config.api.production
  };
} else {
  // Для Service Worker - використовуємо development для тестування
  self.chartexConfig = {
    ...config,
    environment: 'development',
    apiUrl: config.api.development
  };
} 