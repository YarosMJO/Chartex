// Фоновий скрипт для збору історії браузера та взаємодії з бекендом
// Завантаження утиліт
importScripts('crypto-js.min.js');
importScripts('crypto-utils.js');
importScripts('config.js');
importScripts('firebase-config.js');
importScripts('firebase-app-compat.js');
importScripts('firebase-auth-compat.js');

// Ініціалізація Firebase, якщо ще не ініціалізовано
if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
  firebase.initializeApp(typeof firebaseConfig !== 'undefined' ? firebaseConfig : window.firebaseConfig);
}

// Глобальні змінні
let currentUser = null;
let deviceId = null;
let encryptionKey = null;
let sessionId = null;
let isCollecting = false;

// API URL з конфігурації (для Service Worker)
const chartexConfig = self.chartexConfig || { apiUrl: 'http://localhost:5000/api' };
const API_BASE_URL = chartexConfig.apiUrl;

// Додаємо функцію для кодування у base64 з підтримкою UTF-8
function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// Утиліти для отримання інформації про пристрій
class DeviceUtils {
  static getDeviceInfo() {
    try {
      return {
        deviceType: this.getDeviceType(),
        browser: 'Chrome',
        userAgent: navigator?.userAgent || 'Chrome Extension',
        screenResolution: '1920x1080', // Default resolution for Service Worker
        language: navigator?.language || 'uk',
        timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || 'Europe/Kiev',
        os: this.getOS(),
        version: navigator?.appVersion || 'Unknown'
      };
    } catch (error) {
      console.warn('Помилка отримання інформації про пристрій:', error);
      // Fallback значення
      return {
        deviceType: 'desktop',
        browser: 'Chrome',
        userAgent: 'Chrome Extension',
        screenResolution: '1920x1080',
        language: 'uk',
        timezone: 'Europe/Kiev',
        os: 'Unknown',
        version: 'Unknown'
      };
    }
  }
  
  static getDeviceType() {
    try {
      const userAgent = navigator?.userAgent?.toLowerCase() || '';
      if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
        return 'mobile';
      } else if (/tablet|ipad/i.test(userAgent)) {
        return 'tablet';
      }
      return 'desktop';
    } catch (error) {
      return 'desktop';
    }
  }
  
  static getOS() {
    try {
      const userAgent = navigator?.userAgent || '';
      if (userAgent.includes('Windows')) return 'Windows';
      if (userAgent.includes('Mac')) return 'macOS';
      if (userAgent.includes('Linux')) return 'Linux';
      if (userAgent.includes('Android')) return 'Android';
      if (userAgent.includes('iOS')) return 'iOS';
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }
}

// API утиліти
class APIUtils {
  static async makeRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    let authHeader = {};
    
    console.log(`API запит до: ${url}`);
    
    // Завжди беремо idToken з локального сховища
    try {
      const userData = await chrome.storage.local.get(['user']);
      const idToken = userData.user?.idToken;
      console.log('Токен авторизації:', { hasToken: !!idToken, tokenLength: idToken?.length });
      
      if (idToken) {
        authHeader = { 'Authorization': `Bearer ${idToken}` };
      } else {
        console.warn('Токен авторизації не знайдено');
      }
    } catch (error) {
      console.error('Помилка отримання токена:', error);
    }
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader
      }
    };
    
    console.log('Відправка запиту з опціями:', { 
      url, 
      method: options.method || 'GET',
      hasAuth: !!authHeader.Authorization,
      bodySize: options.body?.length 
    });
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    console.log('Відповідь API:', { 
      status: response.status, 
      ok: response.ok,
      statusText: response.statusText 
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API помилка:', { status: response.status, error: errorText });
      throw new Error(`API помилка: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API успішна відповідь:', result);
    return result;
  }
  
  static async registerDevice() {
    const deviceInfo = DeviceUtils.getDeviceInfo();
    const deviceName = `Пристрій ${deviceInfo.deviceType}`;
    
    return this.makeRequest('/devices/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        deviceName,
        ...deviceInfo
      })
    });
  }
  
  static async sendHistoryItem(item) {
    return this.makeRequest('/history/add', {
      method: 'POST',
      body: JSON.stringify(item)
    });
  }
  
  static async sendHistoryBatch(items) {
    return this.makeRequest('/history/batch', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  }
}

// Основний клас для збору історії
class HistoryCollector {
  constructor() {
    this.isCollecting = false;
    this.pendingItems = [];
    this.batchSize = chartexConfig.collection?.batchSize || 50;
    this.batchTimeout = null;
  }
  
  async start() {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    console.log('Початок збору історії браузера');
    
    // Зареєструвати пристрій
    await this.registerDevice();
    
    // Запустити збір історії
    this.collectHistory();
    
    // Слухати нові записи історії
    chrome.history.onVisited.addListener(this.handleHistoryVisit.bind(this));
  }
  
  async registerDevice() {
    try {
      // Перевірити, чи є необхідні дані
      if (!deviceId || !encryptionKey) {
        console.error('Відсутні необхідні дані для реєстрації пристрою');
        return;
      }
      
      const response = await APIUtils.registerDevice();
      console.log('Пристрій зареєстровано:', response);
      
      // Зберегти час останньої синхронізації
      await chrome.storage.local.set({ lastSync: Date.now() });
    } catch (error) {
      console.error('Помилка реєстрації пристрою:', error);
    }
  }
  
  async collectHistory() {
    try {
      console.log('Початок збору існуючої історії...');
      
      // Отримати історію за останні дні з конфігурації
      const historyDays = chartexConfig.collection?.historyDays || 7;
      const endTime = Date.now();
      const startTime = endTime - (historyDays * 24 * 60 * 60 * 1000);
      
      const historyItems = await new Promise((resolve) => {
        chrome.history.search({
          text: '',
          startTime: startTime,
          endTime: endTime,
          maxResults: 1000
        }, resolve);
      });
      
      console.log(`Знайдено ${historyItems.length} записів історії`);
      
      // Обробити кожен запис
      for (const item of historyItems) {
        await this.processHistoryItem(item);
      }
      
      // Відправити накопичені записи
      await this.flushBatch();
      
      console.log('Збір існуючої історії завершено');
    } catch (error) {
      console.error('Помилка збору історії:', error);
    }
  }
  
  async handleHistoryVisit(historyItem) {
    if (this.isCollecting) {
      await this.processHistoryItem(historyItem);
    }
  }
  
  async processHistoryItem(historyItem) {
    try {
      // Перевірити, чи є необхідні дані
      if (!deviceId || !encryptionKey || !sessionId) {
        console.warn('Відсутні необхідні дані для обробки запису');
        return;
      }
      
      // Отримати інформацію про пристрій
      const deviceInfo = DeviceUtils.getDeviceInfo();
      
      // Створити запис для відправки
      const record = {
        userId: currentUser?.uid || 'anonymous',
        deviceId: deviceId,
        sessionId: sessionId,
        encryptedData: CryptoUtils.encryptData({
          url: historyItem.url,
          title: historyItem.title || '',
          faviconUrl: historyItem.favicon || '',
          referrer: historyItem.referrer || ''
        }, encryptionKey),
        domainHash: CryptoUtils.hashDomain(historyItem.url),
        visitCount: historyItem.visitCount || 1,
        typedCount: historyItem.typedCount || 0,
        duration: historyItem.duration || 0,
        transitionType: historyItem.transition || 'link',
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        language: deviceInfo.language,
        screenResolution: deviceInfo.screenResolution,
        os: deviceInfo.os,
        visitTime: new Date(historyItem.lastVisitTime),
        isBookmarked: false,
        isIncognito: false,
        timeOfDay: new Date(historyItem.lastVisitTime).getHours(),
        dayOfWeek: new Date(historyItem.lastVisitTime).getDay(),
        month: new Date(historyItem.lastVisitTime).getMonth() + 1,
        year: new Date(historyItem.lastVisitTime).getFullYear()
      };
      
      // Додати до черги
      this.pendingItems.push(record);
      
      // Запланувати відправку, якщо накопичилося достатньо записів
      if (this.pendingItems.length >= this.batchSize) {
        await this.flushBatch();
      } else {
        this.scheduleBatchFlush();
      }
      
      // Оновити лічильник в локальному сховищі
      const currentCount = await chrome.storage.local.get(['historyCount']);
      const newCount = (currentCount.historyCount || 0) + 1;
      await chrome.storage.local.set({ historyCount: newCount });
      
    } catch (error) {
      console.error('Помилка обробки запису історії:', error);
    }
  }
  
  scheduleBatchFlush() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    const batchTimeout = chartexConfig.collection?.batchTimeout || 5000;
    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, batchTimeout);
  }
  
  async flushBatch() {
    if (this.pendingItems.length === 0) return;
    
    try {
      console.log(`Відправка ${this.pendingItems.length} записів...`);
      
      const itemsToSend = [...this.pendingItems];
      this.pendingItems = [];
      
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
      
      const response = await APIUtils.sendHistoryBatch(itemsToSend);
      console.log('Записи успішно відправлено:', response);
      
      // Оновити час останньої синхронізації
      await chrome.storage.local.set({ lastSync: Date.now() });
      
    } catch (error) {
      console.error('Помилка відправки записів:', error);
      
      // Повернути записи назад до черги
      this.pendingItems.unshift(...this.pendingItems);
    }
  }
  
  stop() {
    this.isCollecting = false;
    console.log('Збір історії зупинено');
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // Відправити залишкові записи
    this.flushBatch();
  }
}

// Ініціалізація об'єктів
const historyCollector = new HistoryCollector();

// Отримати Google OAuth токен через chrome.identity
async function getGoogleOAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError || new Error('Не вдалося отримати токен'));
      } else {
        resolve(token);
      }
    });
  });
}

// Увійти у Firebase через Google OAuth токен
async function firebaseSignInWithGoogleToken(token) {
  const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
  const userCredential = await firebase.auth().signInWithCredential(credential);
  return userCredential.user;
}

// handleAuthentication: інтеграція chrome.identity + Firebase Auth
async function handleAuthentication() {
  try {
    // Якщо вже залогінений у Firebase
    const user = firebase.auth().currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      await chrome.storage.local.set({
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          authMethod: 'firebase',
          idToken
        }
      });
      currentUser = user;
      return { success: true, user };
    }
    
    // Якщо не залогінений — отримати Google OAuth токен через chrome.identity
    const googleToken = await getGoogleOAuthToken();
    const firebaseUser = await firebaseSignInWithGoogleToken(googleToken);
    const idToken = await firebaseUser.getIdToken();
    await chrome.storage.local.set({
      user: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        authMethod: 'firebase',
        idToken
      }
    });
    currentUser = firebaseUser;
    return { success: true, user: firebaseUser };
  } catch (error) {
    console.error('Помилка авторизації:', error);
    return { success: false, error: error.message };
  }
}

async function handleLogout() {
  try {
    await firebase.auth().signOut();
    currentUser = null;
    
    // Видалити користувача з локального сховища
    await chrome.storage.local.remove(['user']);
    
    console.log('Користувач вийшов з системи');
    return { success: true };
  } catch (error) {
    console.error('Помилка виходу:', error);
    return { success: false, error: error.message };
  }
}

// === ЄДИНИЙ ОБРОБНИК chrome.runtime.onMessage ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getGoogleIdToken':
      console.log('Отримано запит на Google ID Token');
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        console.log('Отримано токен:', token);
        sendResponse({ idToken: token });
      });
      return true;
      
    case 'getEncryptionKey':
      console.log('Запит на отримання ключа шифрування від frontend');
      console.log('Ключ шифрування:', { hasKey: !!encryptionKey, keyLength: encryptionKey?.length });
      sendResponse({ encryptionKey: encryptionKey });
      return;
      
    case 'startCollection':
      historyCollector.start();
      sendResponse({ success: true });
      break;
      
    case 'stopCollection':
      historyCollector.stop();
      sendResponse({ success: true });
      break;
      
    case 'getStatus':
      (async () => {
        const user = firebase.auth().currentUser;
        console.log('BG: getStatus', { isCollecting: historyCollector.isCollecting });
        let deviceCount = 0;
        let historyCount = 0;
        let sessionCount = 0;
        let lastSync = null;
        try {
          const data = await chrome.storage.local.get(['deviceId', 'lastSync', 'historyCount']);
          deviceCount = data.deviceId ? 1 : 0;
          lastSync = data.lastSync;
          historyCount = data.historyCount || 0;
          sessionCount = sessionId ? 1 : 0;
        } catch (error) {
          console.error('Помилка отримання статистики:', error);
        }
        sendResponse({
          isCollecting: historyCollector.isCollecting,
          deviceId,
          hasUser: !!user,
          userEmail: user?.email || null,
          deviceCount,
          historyCount,
          sessionCount,
          lastSync
        });
      })();
      return true;
      
    case 'authenticate':
      console.log('BG: AUTHENTICATE ACTION RECEIVED');
      handleAuthentication().then(sendResponse);
      return true;
      
    case 'logout':
      handleLogout().then(sendResponse);
      return true;
      
    case 'openOptions':
      console.log('BG: Відкриття options page');
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      break;
      
    case 'testSendData':
      (async () => {
        try {
          console.log('Тестова відправка даних:', request.data);
          if (!request.data) {
            sendResponse({ success: false, error: 'Немає даних для тесту' });
            return;
          }
          await historyCollector.processHistoryItem(request.data);
          await historyCollector.flushBatch();
          sendResponse({ success: true, message: 'Тестовий запис відправлено' });
        } catch (error) {
          console.error('Помилка тестової відправки:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
      
    default:
      sendResponse({ success: false, error: 'Невідома дія' });
  }
  return true;
});

// Ініціалізація при встановленні extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Розширення Chartex встановлено:', details.reason);
  
  if (details.reason === 'install') {
    try {
      // Згенерувати унікальні ідентифікатори
      deviceId = CryptoUtils.generateDeviceId();
      sessionId = CryptoUtils.generateSessionId();
      encryptionKey = CryptoUtils.generateKey();
      
      // Зберегти в локальному сховищі
      await chrome.storage.local.set({
        deviceId,
        encryptionKey,
        sessionId,
        isFirstRun: true,
        installDate: Date.now()
      });
      
      console.log('Розширення ініціалізовано з новими ідентифікаторами');
    } catch (error) {
      console.error('Помилка ініціалізації розширення:', error);
    }
  }
  
  // Створити контекстне меню
  chrome.contextMenus.create({
    id: 'chartex-analytics',
    title: '📊 Chartex Analytics',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: 'open-dashboard',
    parentId: 'chartex-analytics',
    title: 'Відкрити Analytics Dashboard',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: 'toggle-collection',
    parentId: 'chartex-analytics',
    title: 'Перемкнути збір даних',
    contexts: ['action']
  });
});

// Обробник кліків по контекстному меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'open-dashboard':
      chrome.runtime.openOptionsPage();
      break;
      
    case 'toggle-collection':
      if (historyCollector.isCollecting) {
        historyCollector.stop();
      } else {
        historyCollector.start();
      }
      break;
  }
});

// Ініціалізація при запуску
chrome.runtime.onStartup.addListener(async () => {
  console.log('Розширення Chartex запущено');
  
  try {
    // Завантажити збережені дані
    const data = await chrome.storage.local.get(['deviceId', 'encryptionKey', 'sessionId', 'user']);
    if (data.deviceId) {
      deviceId = data.deviceId;
      encryptionKey = data.encryptionKey;
      sessionId = data.sessionId || CryptoUtils.generateSessionId();
      
      console.log('Дані розширення відновлено');
    } else {
      // Якщо дані відсутні, згенерувати нові
      deviceId = CryptoUtils.generateDeviceId();
      encryptionKey = CryptoUtils.generateKey();
      sessionId = CryptoUtils.generateSessionId();
      
      await chrome.storage.local.set({
        deviceId,
        encryptionKey,
        sessionId
      });
      
      console.log('Згенеровано нові ідентифікатори');
    }
    
    // Перевірити стан авторизації
    if (data.user) {
      console.log('Відновлення сесії користувача:', data.user.email);
    }
  } catch (error) {
    console.error('Помилка ініціалізації при запуску:', error);
  }
});