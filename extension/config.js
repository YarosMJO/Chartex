// Конфігурація для Chrome Extension
const config = {
  // API URL для різних середовищ
  api: {
    development: 'http://localhost:5000/api', // Local backend без Docker
    production: 'http://localhost:5000/api' // Docker backend - тепер також 5000
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

// Функція для визначення доступного API (тепер завжди 5000)
async function detectAvailableAPI() {
  const apiUrl = config.api.production; // Тепер обидва режими використовують 5000
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    
    const response = await fetch(apiUrl.replace('/api', '/api/health'), {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('Chartex: API (5000) доступний');
      return apiUrl;
    }
  } catch (error) {
    console.log('Chartex: API (5000) недоступний:', error.message);
  }
  
  // Якщо API недоступний, все одно повертаємо його
  console.log('Chartex: API недоступний, використовуємо:', apiUrl);
  return apiUrl;
}

// Експорт конфігурації
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ...config,
    apiUrl: config.api.production, // Для Node.js (build процес)
    detectAvailableAPI
  };
} else if (typeof window !== 'undefined') {
  window.chartexConfig = {
    ...config,
    apiUrl: config.api.development, // За замовчуванням для browser
    detectAvailableAPI
  };
} else {
  // Для Service Worker - ініціалізуємо з API (5000)
  self.chartexConfig = {
    ...config,
    apiUrl: config.api.production, // За замовчуванням API (5000)
    detectAvailableAPI
  };
  
  console.log('Chartex Service Worker: Конфігурація ініціалізована з API (5000)');
  
  // Асинхронно пробуємо визначити доступний API
  detectAvailableAPI().then(apiUrl => {
    self.chartexConfig.apiUrl = apiUrl;
    console.log('Chartex Service Worker: API визначено:', apiUrl);
  }).catch(error => {
    console.log('Chartex Service Worker: Помилка визначення API, використовуємо 5000:', error.message);
  });
} 