// Chartex Background Script
// Глобальні змінні
let deviceId = null;
let encryptionKey = null;
let sessionId = null;
let currentUser = null;
let lastUserUid = null;
let historyCollector = null;
let popupManager = null;

// Утиліта для локалізації
class TranslationManager {
  constructor() {
    this.translations = {};
    this.currentLanguage = 'ua';
    this.loadTranslations();
  }
  
  async loadTranslations() {
    try {
      const result = await chrome.storage.local.get(['chartex_language']);
      this.currentLanguage = result.chartex_language || 'ua';
      
      const translationFile = this.currentLanguage === 'en' ? 'en.json' : 'ua.json';
      const response = await fetch(chrome.runtime.getURL(`dashboard/assets/i18n/${translationFile}`));
      this.translations = await response.json();
    } catch (error) {
      // Silent fail for translations
    }
  }
  
  getTranslation(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }
    
    if (typeof value !== 'string') {
      return key;
    }
    
    return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      return acc.replace(regex, paramValue);
    }, value);
  }
}

// Створюємо глобальний екземпляр менеджера перекладів
const translationManager = new TranslationManager();

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

// Глобальні змінні (вже оголошені вище)
let isCollecting = false;

// === Ініціалізація глобальних змінних ===
(async function initializeGlobals() {
  // Слухаємо зміни в storage для оновлення перекладів
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.chartex_language) {
      translationManager.loadTranslations();
    }
  });
  try {
    // === Стабільна ініціалізація deviceId ===
    deviceId = await getOrCreateStableDeviceId();
    
    // === Ініціалізація encryptionKey та sessionId ===
    const data = await chrome.storage.local.get(['encryptionKey', 'sessionId']);
    encryptionKey = data.encryptionKey || CryptoUtils.generateKey();
    sessionId = data.sessionId || CryptoUtils.generateSessionId();
    
    // Зберегти, якщо не були збережені раніше
    if (!data.encryptionKey) {
      await chrome.storage.local.set({ encryptionKey });
    }
    if (!data.sessionId) {
      await chrome.storage.local.set({ sessionId });
    }
    
    // Автоматично зберегти ключ шифрування в chrome.storage для дашборду
    if (encryptionKey) {
      await chrome.storage.local.set({ chartex_encryption_key: encryptionKey });
    }
    
  } catch (error) {
    console.error(translationManager.getTranslation('BACKGROUND.INIT_ERROR'), error);
  }
})();

// API URL з конфігурації (для Service Worker)
const chartexConfig = self.chartexConfig || { apiUrl: 'http://localhost:5000/api' }; // Fallback до API (5000)
const API_BASE_URL = chartexConfig.apiUrl;

console.log('Chartex Background: API URL:', API_BASE_URL);

// Функція для перевірки доступності API
async function checkAPIHealth() {
  try {
    const response = await fetch(API_BASE_URL.replace('/api', '/api/health'), {
      method: 'GET',
      mode: 'cors'
    });
    
    if (response.ok) {
      console.log('Chartex Background: API доступний');
      return true;
    } else {
      console.log('Chartex Background: API недоступний, статус:', response.status);
      return false;
    }
  } catch (error) {
    console.log('Chartex Background: API недоступний, помилка:', error.message);
    return false;
  }
}

// Перевіряємо API при ініціалізації
checkAPIHealth();

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
    
    // Завжди беремо idToken з локального сховища
    try {
      const userData = await chrome.storage.local.get(['user']);
      const idToken = userData.user?.idToken;
      
      if (idToken) {
        authHeader = { 'Authorization': `Bearer ${idToken}` };
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
    
    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API помилка:', { status: response.status, error: errorText, url });
        throw new Error(`API помилка: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Chartex API: Request failed:', error.message, 'URL:', url);
      throw error;
    }
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
    this.handleHistoryVisitBound = null;
  }

  // Перевірка налаштувань збору даних
  async checkDataCollectionSettings() {
    try {
      const data = await chrome.storage.local.get(['chartex_settings']);
      const settings = data.chartex_settings;
      
      if (!settings || !settings.dataCollection) {
        return true;
      }
      
      return settings.dataCollection.enabled;
    } catch (error) {
      return true;
    }
  }

  // Перевірка конкретних налаштувань збору даних
  async getDataCollectionSettings() {
    try {
      const data = await chrome.storage.local.get(['chartex_settings']);
      const settings = data.chartex_settings;
      
      if (!settings || !settings.dataCollection) {
        return {
          enabled: true,
          collectDeviceInfo: true,
          collectPageTitles: true,
          collectVisitDuration: true
        };
      }
      
      return settings.dataCollection;
    } catch (error) {
      return {
        enabled: true,
        collectDeviceInfo: true,
        collectPageTitles: true,
        collectVisitDuration: true
      };
    }
  }

  // Перевірка налаштувань приватності
  async getPrivacySettings() {
    try {
      const data = await chrome.storage.local.get(['chartex_settings']);
      const settings = data.chartex_settings;
      
      if (!settings || !settings.privacy) {
        return {
          encryptData: true,
          showOtherDevices: true
        };
      }
      
      return settings.privacy;
    } catch (error) {
      return {
        encryptData: true,
        showOtherDevices: true
      };
    }
  }
  
  async start() {
    if (this.isCollecting) return;
    
    // Очищаємо старі дані, щоб не надіслати дані попереднього користувача
    this.pendingItems = [];
    this.isCollecting = true;
    
    console.log('Chartex: Starting collection...');
    
    // Зареєструвати пристрій
    await this.registerDevice();
    
    // Запустити збір історії
    this.collectHistory();
    
    // Слухати нові записи історії
    if (!this.handleHistoryVisitBound) {
      this.handleHistoryVisitBound = this.handleHistoryVisit.bind(this);
      chrome.history.onVisited.addListener(this.handleHistoryVisitBound);
    } else if (!chrome.history.onVisited.hasListener(this.handleHistoryVisitBound)) {
        chrome.history.onVisited.addListener(this.handleHistoryVisitBound);
    }
  }
  
  async registerDevice() {
    try {
      if (!deviceId || !encryptionKey) {
        return;
      }
      
      const response = await APIUtils.registerDevice();
      
      // Зберегти час останньої синхронізації для поточного користувача
      if (currentUser?.uid) {
        await chrome.storage.local.set({ [`lastSync_${currentUser.uid}`]: Date.now() });
      }
    } catch (error) {
      console.error('Помилка реєстрації пристрою:', error);
    }
  }
  
  async collectHistory() {
    try {
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
      // Обробити кожен запис
      for (const item of historyItems) {
        // Критично: перевіряємо, чи ми все ще збираємо дані
        if (!this.isCollecting) break;
        await this.processHistoryItem(item);
      }
      // Відправити накопичені записи
      if (this.isCollecting) {
        await this.flushBatch();
        // Notify popups that initial data collection is complete
        chrome.runtime.sendMessage({ action: 'dataSyncComplete' });
      }
    } catch (error) {
      console.error('Error in collectHistory:', error);
    }
  }
  
  async handleHistoryVisit(historyItem) {
    if (this.isCollecting) {
      await this.processHistoryItem(historyItem);
    }
  }
  
  async processHistoryItem(historyItem) {
    try {
      // КРИТИЧНЕ ВИПРАВЛЕННЯ: Якщо збір зупинено, не обробляємо нічого
      // Це запобігає "зомбі" процесам від попередніх сесій
      if (!this.isCollecting) return;

      // Перевірити налаштування приватності для фільтрації інших пристроїв
      const privacySettings = await this.getPrivacySettings();
      
      // Фільтрація внутрішніх сторінок браузера
      function isBrowserInternalUrl(url) {
        return /^chrome(-extension)?:\/\//.test(url) ||
               /^edge:\/\//.test(url) ||
               /^about:/.test(url) ||
               /^moz-extension:\/\//.test(url) ||
               /^vivaldi:\/\//.test(url) ||
               /^brave:\/\//.test(url) ||
               /^opera:\/\//.test(url);
      }
      if (isBrowserInternalUrl(historyItem.url)) {
        return;
      }
      
      // Перевірити та ініціалізувати необхідні дані
      if (!deviceId || !encryptionKey || !sessionId) {
        if (!deviceId) {
          deviceId = await getOrCreateStableDeviceId();
        }
        if (!encryptionKey || !sessionId) {
          const data = await chrome.storage.local.get(['encryptionKey', 'sessionId']);
          encryptionKey = data.encryptionKey;
          sessionId = data.sessionId || CryptoUtils.generateSessionId();
          if (!data.sessionId) {
            await chrome.storage.local.set({ sessionId });
          }
        }
      }
      
      if (!deviceId || !encryptionKey || !sessionId) {
        return;
      }
      
      // Отримати налаштування збору даних (деталізація)
      const collectionSettings = await this.getDataCollectionSettings();
      
      // Отримати інформацію про пристрій (тільки якщо дозволено)
      const deviceInfo = collectionSettings.collectDeviceInfo ? DeviceUtils.getDeviceInfo() : null;
      
      // Обчислення duration
      let duration = 0;
      if (collectionSettings.collectVisitDuration && historyItem.duration && historyItem.duration > 0) {
        if (historyItem.duration > 1000) {
          duration = Math.round(historyItem.duration / 1000); 
        } else {
          duration = historyItem.duration; 
        }
        if (duration > 3600) {
          duration = 3600;
        }
      } else {
        duration = 30; 
        if (historyItem.transition === 'typed' || historyItem.transition === 'generated') {
          duration = 120;
        } else if (historyItem.transition === 'reload') {
          duration = 60;
        }
      }
      
      // Створити запис для відправки
      const record = {
        userId: currentUser?.uid || 'anonymous',
        deviceId: deviceId,
        sessionId: sessionId,
        encryptedData: (() => {
          const dataToEncrypt = {
            url: historyItem.url,
            title: collectionSettings.collectPageTitles ? (historyItem.title || '') : '',
            faviconUrl: historyItem.favicon || '',
            referrer: historyItem.referrer || ''
          };
          
          return CryptoUtils.encrypt(dataToEncrypt, encryptionKey);
        })(),
        domainHash: CryptoUtils.hashDomain(historyItem.url),
        visitCount: historyItem.visitCount || 1,
        typedCount: historyItem.typedCount || 0,
        duration: collectionSettings.collectVisitDuration ? duration : 0,
        transitionType: historyItem.transition || 'link',
        deviceType: (collectionSettings.collectDeviceInfo && deviceInfo?.deviceType) ? deviceInfo.deviceType : 'unknown',
        browser: (collectionSettings.collectDeviceInfo && deviceInfo?.browser) ? deviceInfo.browser : 'unknown',
        language: (collectionSettings.collectDeviceInfo && deviceInfo?.language) ? deviceInfo.language : 'unknown',
        screenResolution: (collectionSettings.collectDeviceInfo && deviceInfo?.screenResolution) ? deviceInfo.screenResolution : 'unknown',
        os: (collectionSettings.collectDeviceInfo && deviceInfo?.os) ? deviceInfo.os : 'unknown',
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
      
      // Оновити лічильник
      const historyCountKey = `historyCount_${currentUser?.uid}`;
      const currentCount = await chrome.storage.local.get([historyCountKey]);
      const newCount = (currentCount[historyCountKey] || 0) + 1;
      await chrome.storage.local.set({ [historyCountKey]: newCount });
      
      // Запланувати відправку
      if (this.pendingItems.length >= this.batchSize) {
        this.flushBatch();
      } else {
        this.scheduleBatchFlush();
      }
      
    } catch (error) {
      // Silent fail
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
    
    let itemsToSend = [];
    
    try {
      itemsToSend = [...this.pendingItems];
      this.pendingItems = [];
      
      const validatedItems = itemsToSend.filter(item => {
        if (!item.userId || !item.deviceId || !item.sessionId || !item.encryptedData) {
          return false;
        }
        if (!item.domainHash) {
          return false;
        }
        return true;
      });
      
      if (validatedItems.length === 0) {
        return;
      }
      
      await APIUtils.sendHistoryBatch(validatedItems);
      
      if (currentUser?.uid) {
        const lastSyncKey = `lastSync_${currentUser.uid}`;
        await chrome.storage.local.set({ [lastSyncKey]: new Date().toISOString() });
      }
      
      chrome.runtime.sendMessage({ action: 'dataSyncComplete' });
      
    } catch (error) {
      console.error('Помилка відправки batch:', error);
      if (itemsToSend.length > 0) {
        this.pendingItems.unshift(...itemsToSend);
      }
    }
  }
  
  stop() {
    this.isCollecting = false;
    this.pendingItems = []; // Очистити чергу при зупинці
    
    if (this.handleHistoryVisitBound) {
      chrome.history.onVisited.removeListener(this.handleHistoryVisitBound);
      this.handleHistoryVisitBound = null;
    }
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // Опціонально: спробувати відправити те, що залишилось, якщо потрібно
    // this.flushBatch(); 
  }
  
}

// Ініціалізація об'єктів
historyCollector = new HistoryCollector();

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

// Helper: Load collection state for a user
async function loadCollectionStateForUser(uid) {
  const key = `collecting_${uid}`;
  const data = await chrome.storage.local.get([key]);
  return !!data[key];
}

// Helper: Save collection state for a user
async function saveCollectionStateForUser(uid, collecting) {
  const key = `collecting_${uid}`;
  await chrome.storage.local.set({ [key]: collecting });
}

// Helper: Clear old data for user
async function clearUserData(uid) {
  try {
    await chrome.storage.local.set({ [`historyCount_${uid}`]: 0 });
    await chrome.storage.local.set({ [`lastSync_${uid}`]: null });
  } catch (error) {
    // Silent fail
  }
}

// Helper: Clear user data on backend
async function clearUserDataOnBackend(uid) {
  try {
    // Wait a bit to ensure Firebase auth is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    const user = firebase.auth().currentUser;
    if (!user) {
      console.warn('Користувач не авторизований для очищення даних');
      return;
    }
    if (user.uid !== uid) {
      console.warn(`UID не співпадає: очікував ${uid}, отримав ${user.uid}`);
      return;
    }
    const idToken = await user.getIdToken();
    await APIUtils.makeRequest('/users/clear-data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Дані на сервері очищено для користувача:', uid);
  } catch (error) {
    console.warn('Не вдалося очистити дані на сервері (можливо це новий користувач):', error);
  }
}

// Update collection state on user change
async function handleUserSwitch(newUser) {
  if (lastUserUid && lastUserUid !== newUser?.uid) {
    await saveCollectionStateForUser(lastUserUid, historyCollector.isCollecting);
    historyCollector.stop();
  }
  
  if (newUser?.uid) {
    // 1. Спочатку очищаємо локальні лічильники
    await clearUserData(newUser.uid);
    
    // 2. ВАЖЛИВО: Чекаємо поки сервер очистить старі дані
    // Якщо цього не зробити, ми почнемо заливати нові дані, а потім сервер виконає "очистити"
    // і видалить тільки що залиті дані.
    try {
        await clearUserDataOnBackend(newUser.uid);
    } catch (e) {
        console.warn('Backend cleanup failed, proceeding anyway');
    }
    
    // 3. Тепер перевіряємо налаштування автозапуску
    const settings = await historyCollector.getDataCollectionSettings();
    
    if (settings.enabled) {
      console.log('User Login: Auto-collection ENABLED -> Starting.');
      historyCollector.start();
    } else {
      console.log('User Login: Auto-collection DISABLED -> Not starting automatically.');
      historyCollector.stop();
    }
    
    await saveCollectionStateForUser(newUser.uid, historyCollector.isCollecting);

    lastUserUid = newUser.uid;
  } else {
    lastUserUid = null;
    historyCollector.stop();
  }
}

// handleAuthentication: інтеграція chrome.identity + Firebase Auth
async function handleAuthentication() {
  try {
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
      await handleUserSwitch(user);
      return { success: true, user };
    }
    
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
    await handleUserSwitch(firebaseUser);
    
    return { success: true, user: firebaseUser };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleLogout() {
  try {
    if (currentUser?.uid) {
      await saveCollectionStateForUser(currentUser.uid, historyCollector.isCollecting);
    }
    await firebase.auth().signOut();
    currentUser = null;
    lastUserUid = null;
    await chrome.storage.local.remove(['user']);
    historyCollector.stop();
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
      chrome.identity.getAuthToken({ interactive: true }, function(token) {
        sendResponse({ idToken: token });
      });
      return true;
      
    case 'getEncryptionKey':
      sendResponse({ encryptionKey: encryptionKey });
      return;
      
    case 'saveEncryptionKeyToStorage':
      (async () => {
        if (encryptionKey) {
          await chrome.storage.local.set({ chartex_encryption_key: encryptionKey });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Ключ шифрування не знайдено' });
        }
      })();
      return true;
      
    case 'updateSettings':
      (async () => {
        try {
          await chrome.storage.local.set({ 
            chartex_settings: request.settings,
            chartex_language: request.settings.display?.language || 'uk'
          });
          
          await translationManager.loadTranslations();    
          
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
      
    case 'startCollection':
      (async () => {
        if (currentUser?.uid) {
          await clearUserData(currentUser.uid);
          // Тут теж краще почекати, щоб не було конфліктів
          try { await clearUserDataOnBackend(currentUser.uid); } catch(e){}
        }
        historyCollector.start();
        sendResponse({ success: true });
      })();
      return true;
      
    case 'stopCollection':
      historyCollector.stop();
      sendResponse({ success: true });
      break;
      
      
    case 'getStatus':
      (async () => {
        const user = firebase.auth().currentUser;
        
        let authValid = true;
        if (user) {
          authValid = await validateAuthentication();
        }
        
        let deviceCount = 0;
        let historyCount = 0;
        let sessionCount = 0;
        let lastSync = null;
        try {
          let keys = ['deviceId'];
          if (user?.uid) {
            keys.push(`lastSync_${user.uid}`);
            keys.push(`historyCount_${user.uid}`);
          }
          const data = await chrome.storage.local.get(keys);
          deviceCount = data.deviceId ? 1 : 0;
          if (user?.uid) {
            lastSync = data[`lastSync_${user.uid}`];
            historyCount = data[`historyCount_${user.uid}`] || 0;
          } else {
            lastSync = null;
            historyCount = 0;
          }
          sessionCount = sessionId ? 1 : 0;
        } catch (error) {
          console.error('Помилка отримання статистики:', error);
        }
        sendResponse({
          isCollecting: historyCollector.isCollecting,
          deviceId: deviceId || 'undefined',
          hasUser: !!user && authValid,
          userEmail: user?.email || null,
          deviceCount,
          historyCount,
          sessionCount,
          lastSync
        });
      })();
      return true;
      
    case 'authenticate':
      handleAuthentication().then(sendResponse);
      return true;
      
    case 'logout':
      handleLogout().then(sendResponse);
      return true;
      
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      break;
      
    case 'closeTab':
      if (sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Tab ID not found' });
      }
      break;
      
    case 'testSendData':
      (async () => {
        try {
          if (!request.data) {
            sendResponse({ success: false, error: 'Немає тестових даних' });
            return;
          }
          await historyCollector.processHistoryItem(request.data);
          await historyCollector.flushBatch();
          sendResponse({ success: true, message: 'Тестовий запис відправлено' });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
      
    case 'toggleCollection':
      (async () => {
        if (!currentUser?.uid) {
          sendResponse({ success: false, error: 'Not logged in' });
          return;
        }
        const newState = !historyCollector.isCollecting;
        if (newState) {
          await clearUserData(currentUser.uid);
          try { await clearUserDataOnBackend(currentUser.uid); } catch(e){}
          historyCollector.start();
        } else {
          historyCollector.stop();
        }
        await saveCollectionStateForUser(currentUser.uid, newState);
        sendResponse({ success: true, collecting: newState });
      })();
      return true;
      
    default:
      sendResponse({ success: false, error: 'Невідома дія' });
  }
  return true;
});

// === Стабільна ініціалізація deviceId ===
async function getOrCreateStableDeviceId() {
  let local = await chrome.storage.local.get(['deviceId']);
  if (local.deviceId) {
    let sync = await chrome.storage.sync.get(['deviceId']);
    if (!sync.deviceId) {
      await chrome.storage.sync.set({ deviceId: local.deviceId });
    }
    return local.deviceId;
  }
  let sync = await chrome.storage.sync.get(['deviceId']);
  if (sync.deviceId) {
    await chrome.storage.local.set({ deviceId: sync.deviceId });
    return sync.deviceId;
  }
  const newId = CryptoUtils.generateDeviceId();
  await chrome.storage.local.set({ deviceId: newId });
  await chrome.storage.sync.set({ deviceId: newId });
  return newId;
}

// Ініціалізація при встановленні extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    try {
      sessionId = CryptoUtils.generateSessionId();
      encryptionKey = CryptoUtils.generateKey();
      await chrome.storage.local.set({
        deviceId, 
        encryptionKey,
        sessionId,
        isFirstRun: true,
        installDate: Date.now()
      });
      await chrome.storage.sync.set({ deviceId });
    } catch (error) {
      // Silent fail
    }
  }
  
  chrome.contextMenus.create({
    id: 'chartex-analytics',
    title: '📊 Chartex Analytics',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: 'open-dashboard',
    parentId: 'chartex-analytics',
    title: translationManager.getTranslation('CONTEXT_MENU.OPEN_DASHBOARD'),
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    id: 'toggle-collection',
    parentId: 'chartex-analytics',
    title: translationManager.getTranslation('CONTEXT_MENU.TOGGLE_COLLECTION'),
    contexts: ['action']
  });
});

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

chrome.runtime.onStartup.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(['encryptionKey', 'sessionId', 'user']);
    encryptionKey = data.encryptionKey;
    sessionId = data.sessionId || CryptoUtils.generateSessionId();
    if (!data.sessionId) {
      await chrome.storage.local.set({ sessionId });
    }
    
    setInterval(async () => {
      const user = firebase.auth().currentUser;
      if (user) {
        await validateAuthentication();
      }
    }, 10 * 60 * 1000);
    
  } catch (error) {
    // Silent fail
  }
});

async function checkAndRefreshToken() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      return false;
    }
    
    const tokenResult = await user.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime);
    const now = new Date();
    const timeUntilExpiry = expirationTime.getTime() - now.getTime();
    
    if (timeUntilExpiry < 5 * 60 * 1000) {
      const newToken = await user.getIdToken(true); 
      await chrome.storage.local.set({
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          authMethod: 'firebase',
          idToken: newToken
        }
      });
      return true;
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function validateAuthentication() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      const storedUser = await chrome.storage.local.get(['user']);
      if (storedUser.user) {
        return false;
      }
      return false;
    }
    
    const tokenValid = await checkAndRefreshToken();
    if (!tokenValid) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}