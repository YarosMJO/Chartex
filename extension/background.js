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
    
    // Don't validate during initialization to avoid blocking auth process
    // Validation will happen during getStatus calls
  } catch (error) {
    console.error(translationManager.getTranslation('BACKGROUND.INIT_ERROR'), error);
  }
})();

// API URL з конфігурації (для Service Worker)
const chartexConfig = self.chartexConfig || { apiUrl: 'http://localhost:5000/api' }; // Fallback до API (5000)
const API_BASE_URL = chartexConfig.apiUrl;

console.log('Chartex Background: API URL:', API_BASE_URL);
console.log('Chartex Background: Режим роботи: Unified (5000)');

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
    console.log('Chartex API: Making request to:', url);
    
    let authHeader = {};
    
    // Завжди беремо idToken з локального сховища
    try {
      const userData = await chrome.storage.local.get(['user']);
      const idToken = userData.user?.idToken;
      
      if (idToken) {
        authHeader = { 'Authorization': `Bearer ${idToken}` };
        console.log('Chartex API: Using auth token');
      } else {
        console.log('Chartex API: No auth token found');
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
      console.log('Chartex API: Request successful:', endpoint);
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
    
    // Перевірити налаштування збору даних
    const collectionEnabled = await this.checkDataCollectionSettings();
    if (!collectionEnabled) {
      console.log('Збір даних вимкнено в налаштуваннях');
      return;
    }
    
    this.isCollecting = true;
    
    // Зареєструвати пристрій
    await this.registerDevice();
    
    // Запустити збір історії
    this.collectHistory();
    
    // Слухати нові записи історії
    chrome.history.onVisited.addListener(this.handleHistoryVisit.bind(this));
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
      let processedCount = 0;
      for (const item of historyItems) {
        await this.processHistoryItem(item);
        processedCount++;
      }
      // Відправити накопичені записи
      await this.flushBatch();
      
      // Notify popups that initial data collection is complete
      chrome.runtime.sendMessage({ action: 'dataSyncComplete' });
    } catch (error) {
      // Silent fail
    }
  }
  
  async handleHistoryVisit(historyItem) {
    if (this.isCollecting) {
      await this.processHistoryItem(historyItem);
    }
  }
  
  async processHistoryItem(historyItem) {
    try {
      // Перевірити налаштування збору даних
      const collectionEnabled = await this.checkDataCollectionSettings();
      if (!collectionEnabled) {
        return;
      }
      
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
      
      // Перевірити та ініціалізувати необхідні дані, якщо потрібно
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
      
      // Отримати налаштування збору даних
      const collectionSettings = await this.getDataCollectionSettings();
      
      // Отримати інформацію про пристрій (тільки якщо дозволено)
      const deviceInfo = collectionSettings.collectDeviceInfo ? DeviceUtils.getDeviceInfo() : null;
      
      // Обчислення duration: використовуємо більш надійний метод (тільки якщо дозволено)
      let duration = 0;
      if (collectionSettings.collectVisitDuration && historyItem.duration && historyItem.duration > 0) {
        // Chrome API може повертати duration в мілісекундах, потрібно конвертувати в секунди
        // Якщо значення більше 1000, це ймовірно мілісекунди
        if (historyItem.duration > 1000) {
          duration = Math.round(historyItem.duration / 1000); // Конвертуємо мс в секунди
        } else {
          duration = historyItem.duration; // Вже в секундах
        }
        
        // Обмежуємо максимальний час 1 годиною (3600 сек) для одного відвідування
        if (duration > 3600) {
          duration = 3600;
        }
      } else {
        // Інакше використовуємо приблизний час на основі типу переходу
        // Це приблизний час, який користувач провів на сторінці
        duration = 30; // 30 секунд за замовчуванням для звичайних переходів
        if (historyItem.transition === 'typed' || historyItem.transition === 'generated') {
          duration = 120; // 2 хвилини для введених URL
        } else if (historyItem.transition === 'reload') {
          duration = 60; // 1 хвилина для перезавантажень
        }
      }
      
      // Створити запис для відправки з валідацією
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
          
          const encrypted = CryptoUtils.encrypt(dataToEncrypt, encryptionKey);
          
          return encrypted;
        })(),
        domainHash: CryptoUtils.hashDomain(historyItem.url),
        visitCount: historyItem.visitCount || 1,
        typedCount: historyItem.typedCount || 0,
        duration: collectionSettings.collectVisitDuration ? duration : 0,
        transitionType: historyItem.transition || 'link',
        // Завжди відправляємо поля пристрою, але зі значеннями за замовчуванням якщо збір відключений
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
      
      // Оновити лічильник для поточного користувача
      const historyCountKey = `historyCount_${currentUser?.uid}`;
      const currentCount = await chrome.storage.local.get([historyCountKey]);
      const newCount = (currentCount[historyCountKey] || 0) + 1;
      await chrome.storage.local.set({ [historyCountKey]: newCount });
      
      // Запланувати відправку, якщо досягнуто розмір пакету
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
    
    // Оголошуємо itemsToSend поза try-catch для доступу в catch блоці
    let itemsToSend = [];
    
    try {
      itemsToSend = [...this.pendingItems];
      this.pendingItems = [];
      
      // Валідація та очищення даних перед відправкою
      const validatedItems = itemsToSend.filter(item => {
        // Перевіряємо основні обов'язкові поля
        if (!item.userId || !item.deviceId || !item.sessionId || !item.encryptedData) {
          console.warn('Пропускаємо невалідний запис:', item);
          return false;
        }
        
        // Перевіряємо, чи URL не порожній
        if (!item.domainHash) {
          console.warn('Пропускаємо запис без домену:', item);
          return false;
        }
        
        return true;
      });
      
      if (validatedItems.length === 0) {
        return;
      }
      
      await APIUtils.sendHistoryBatch(validatedItems);
      
      // Оновити час останньої синхронізації для поточного користувача
      if (currentUser?.uid) {
        const lastSyncKey = `lastSync_${currentUser.uid}`;
        await chrome.storage.local.set({ [lastSyncKey]: new Date().toISOString() });
      }
      
      // Повідомити popup про завершення синхронізації
      chrome.runtime.sendMessage({ action: 'dataSyncComplete' });
      
    } catch (error) {
      console.error('Помилка відправки batch:', error);
      // Повернути валідні елементи назад до черги
      if (itemsToSend.length > 0) {
        this.pendingItems.unshift(...itemsToSend);
      }
    }
  }
  
  stop() {
    this.isCollecting = false;
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // Відправити залишкові записи
    this.flushBatch();
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
    // Clear history count
    await chrome.storage.local.set({ [`historyCount_${uid}`]: 0 });
    // Clear last sync time
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
    const response = await APIUtils.makeRequest('/users/clear-data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // Silent fail
  }
}

// Update collection state on user change
async function handleUserSwitch(newUser) {
  if (lastUserUid && lastUserUid !== newUser?.uid) {
    // Save previous user's state
    await saveCollectionStateForUser(lastUserUid, historyCollector.isCollecting);
    historyCollector.stop();
  }
  
  if (newUser?.uid) {
    // Clear old data for new user before starting collection
    await clearUserData(newUser.uid);
    
    // Don't await this - let it run in background
    clearUserDataOnBackend(newUser.uid).catch(error => {
      // Silent fail
    });
    
    const collecting = await loadCollectionStateForUser(newUser.uid);
    
    if (collecting) {
      historyCollector.start();
      // Don't send dataSyncComplete here - let the collection process send it when complete
    } else {
      historyCollector.stop();
    }
    lastUserUid = newUser.uid;
  } else {
    lastUserUid = null;
    historyCollector.stop();
  }
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
      await handleUserSwitch(user);
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
    // Видалити користувача з локального сховища
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
          // Зберігаємо ключ в chrome.storage.local для доступу з дашборду
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
          // Зберігаємо налаштування в chrome.storage для використання в popup
          await chrome.storage.local.set({ 
            chartex_settings: request.settings,
            chartex_language: request.settings.display?.language || 'uk'
          });
          
          // Оновлюємо переклади в background script
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
          // Clear data before starting manual collection
          await clearUserData(currentUser.uid);
          await clearUserDataOnBackend(currentUser.uid);
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
        
        // Only validate authentication if user exists, don't block during auth process
        let authValid = true;
        if (user) {
          authValid = await validateAuthentication();
        }
        
        // Status logging removed for cleaner console
        
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
            // User data logging removed for cleaner console
          } else {
            lastSync = null;
            historyCount = 0;
          }
          sessionCount = sessionId ? 1 : 0;
          // Storage data logging removed for cleaner console
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
          // Clear data before starting collection
          await clearUserData(currentUser.uid);
          await clearUserDataOnBackend(currentUser.uid);
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
  // 1. Спробувати отримати з local
  let local = await chrome.storage.local.get(['deviceId']);
  if (local.deviceId) {
    // Синхронізувати у sync, якщо там немає
    let sync = await chrome.storage.sync.get(['deviceId']);
    if (!sync.deviceId) {
      await chrome.storage.sync.set({ deviceId: local.deviceId });
    }
    return local.deviceId;
  }
  // 2. Спробувати отримати з sync
  let sync = await chrome.storage.sync.get(['deviceId']);
  if (sync.deviceId) {
    // Синхронізувати у local
    await chrome.storage.local.set({ deviceId: sync.deviceId });
    return sync.deviceId;
  }
  // 3. Згенерувати новий, зберегти в обидва сховища
  const newId = CryptoUtils.generateDeviceId();
  await chrome.storage.local.set({ deviceId: newId });
  await chrome.storage.sync.set({ deviceId: newId });
  return newId;
}

// Ініціалізація при встановленні extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    try {
      // === Стабільна ініціалізація deviceId ===
      // deviceId = await getOrCreateStableDeviceId(); // This is now handled by initializeGlobals
      sessionId = CryptoUtils.generateSessionId();
      encryptionKey = CryptoUtils.generateKey();
      await chrome.storage.local.set({
        deviceId, // This will be updated by initializeGlobals
        encryptionKey,
        sessionId,
        isFirstRun: true,
        installDate: Date.now()
      });
      // Також оновити у sync
      await chrome.storage.sync.set({ deviceId });
    } catch (error) {
      // Silent fail
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
  try {
    // === Стабільна ініціалізація deviceId ===
    // deviceId = await getOrCreateStableDeviceId(); // This is now handled by initializeGlobals
    // Завантажити інші дані
    const data = await chrome.storage.local.get(['encryptionKey', 'sessionId', 'user']);
    encryptionKey = data.encryptionKey;
    sessionId = data.sessionId || CryptoUtils.generateSessionId();
    if (!data.sessionId) {
      await chrome.storage.local.set({ sessionId });
    }
    
    // Set up periodic token validation (every 10 minutes)
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

// Helper: Check if token is valid and refresh if needed
async function checkAndRefreshToken() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      return false;
    }
    
    // Check if token needs refresh (Firebase tokens expire after 1 hour)
    const tokenResult = await user.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime);
    const now = new Date();
    const timeUntilExpiry = expirationTime.getTime() - now.getTime();
    
    // Refresh token if it expires in less than 5 minutes
    if (timeUntilExpiry < 5 * 60 * 1000) {
      const newToken = await user.getIdToken(true); // Force refresh
      
      // Update stored token
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

// Helper: Validate current authentication state
async function validateAuthentication() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      // Check if we have stored user data
      const storedUser = await chrome.storage.local.get(['user']);
      if (storedUser.user) {
        // Don't call handleAuthentication here, just return false
        return false;
      }
      return false;
    }
    
    // Check and refresh token if needed
    const tokenValid = await checkAndRefreshToken();
    if (!tokenValid) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}