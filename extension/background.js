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
let lastUserUid = null; // Track previous user for state persistence

// === Ініціалізація глобальних змінних ===
(async function initializeGlobals() {
  try {
    console.log('Ініціалізація глобальних змінних...');
    
    // === Стабільна ініціалізація deviceId ===
    deviceId = await getOrCreateStableDeviceId();
    console.log('DeviceId ініціалізовано:', deviceId);
    
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
    
    console.log('EncryptionKey та SessionId ініціалізовано');
    
    // Автоматично зберегти ключ шифрування в chrome.storage для дашборду
    if (encryptionKey) {
      console.log('Автоматичне збереження ключа шифрування для дашборду...');
      await chrome.storage.local.set({ chartex_encryption_key: encryptionKey });
      console.log('Ключ шифрування збережено в chrome.storage.local');
    }
    
    // Don't validate during initialization to avoid blocking auth process
    // Validation will happen during getStatus calls
  } catch (error) {
    console.error('Помилка ініціалізації глобальних змінних:', error);
  }
})();

// API URL з конфігурації (для Service Worker)
const chartexConfig = self.chartexConfig || { apiUrl: 'http://localhost:5000/api' };
const API_BASE_URL = chartexConfig.apiUrl;

// Діагностика конфігурації
console.log('Chartex Config:', {
  config: chartexConfig,
  apiUrl: API_BASE_URL,
  environment: chartexConfig.environment || 'unknown'
});

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
      let processedCount = 0;
      for (const item of historyItems) {
        await this.processHistoryItem(item);
        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`Оброблено ${processedCount}/${historyItems.length} записів`);
        }
      }
      console.log(`Завершено обробку ${processedCount} записів історії`);
      // Відправити накопичені записи
      await this.flushBatch();
      console.log('Збір існуючої історії завершено');
      
      // Notify popups that initial data collection is complete
      chrome.runtime.sendMessage({ action: 'dataSyncComplete' });
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
        console.log('Пропущено внутрішню сторінку браузера:', historyItem.url);
        return;
      }
      
      // Перевірити та ініціалізувати необхідні дані, якщо потрібно
      if (!deviceId || !encryptionKey || !sessionId) {
        console.log('Ініціалізація необхідних змінних...');
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
      
      // Перевірити, чи є необхідні дані
      if (!deviceId || !encryptionKey || !sessionId) {
        console.warn('Відсутні необхідні дані для обробки запису');
        return;
      }
      
      // Отримати інформацію про пристрій
      const deviceInfo = DeviceUtils.getDeviceInfo();
      
      // Обчислення duration: використовуємо більш надійний метод
      let duration = 0;
      if (historyItem.duration && historyItem.duration > 0) {
        // Якщо Chrome надав duration, використовуємо його
        duration = historyItem.duration;
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
      
      console.log('Обчислений duration для запису:', {
        url: historyItem.url,
        originalDuration: historyItem.duration,
        calculatedDuration: duration,
        transition: historyItem.transition
      });
      
      // Створити запис для відправки
      const record = {
        userId: currentUser?.uid || 'anonymous',
        deviceId: deviceId,
        sessionId: sessionId,
        encryptedData: (() => {
          const dataToEncrypt = {
            url: historyItem.url,
            title: historyItem.title || '',
            faviconUrl: historyItem.favicon || '',
            referrer: historyItem.referrer || ''
          };
          
          console.log('Шифрування даних:', {
            hasEncryptionKey: !!encryptionKey,
            keyLength: encryptionKey?.length,
            dataToEncrypt: dataToEncrypt
          });
          
          const encrypted = CryptoUtils.encrypt(dataToEncrypt, encryptionKey);
          
          console.log('Результат шифрування:', {
            success: !!encrypted,
            encryptedLength: encrypted?.length
          });
          
          return encrypted;
        })(),
        domainHash: CryptoUtils.hashDomain(historyItem.url),
        visitCount: historyItem.visitCount || 1,
        typedCount: historyItem.typedCount || 0,
        duration: duration,
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
      
      // Оновити лічильник для поточного користувача
      const historyCountKey = `historyCount_${currentUser?.uid}`;
      const currentCount = await chrome.storage.local.get([historyCountKey]);
      const newCount = (currentCount[historyCountKey] || 0) + 1;
      await chrome.storage.local.set({ [historyCountKey]: newCount });
      
      console.log(`Запис додано до черги. Загальна кількість: ${newCount}, Duration: ${duration}с`);
      
      // Запланувати відправку, якщо досягнуто розмір пакету
      if (this.pendingItems.length >= this.batchSize) {
        this.flushBatch();
      } else {
        this.scheduleBatchFlush();
      }
      
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
      const itemsToSend = [...this.pendingItems];
      this.pendingItems = [];
      
      // Обчислити загальну суму duration для логування
      const totalDuration = itemsToSend.reduce((sum, item) => sum + (item.duration || 0), 0);
      console.log(`Відправка пакету з ${itemsToSend.length} записами, загальний duration: ${totalDuration}с`);
      
      await APIUtils.sendHistoryBatch(itemsToSend);
      
      // Оновити час останньої синхронізації для поточного користувача
      if (currentUser?.uid) {
        const lastSyncKey = `lastSync_${currentUser.uid}`;
        await chrome.storage.local.set({ [lastSyncKey]: new Date().toISOString() });
        console.log(`Оновлено час останньої синхронізації для користувача ${currentUser.uid}`);
      }
      
      console.log('Пакет успішно відправлено');
      
      // Повідомити popup про завершення синхронізації
      chrome.runtime.sendMessage({ action: 'dataSyncComplete' });
      
    } catch (error) {
      console.error('Помилка відправки пакету:', error);
      // Повернути елементи назад до черги
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
    console.log(`Очищення старих даних для користувача ${uid}`);
    // Clear history count
    await chrome.storage.local.set({ [`historyCount_${uid}`]: 0 });
    // Clear last sync time
    await chrome.storage.local.set({ [`lastSync_${uid}`]: null });
    console.log(`Дані користувача ${uid} очищено`);
  } catch (error) {
    console.error(`Помилка очищення даних користувача ${uid}:`, error);
  }
}

// Helper: Clear user data on backend
async function clearUserDataOnBackend(uid) {
  try {
    console.log(`Очищення даних користувача ${uid} на бекенді`);
    // Wait a bit to ensure Firebase auth is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    const user = firebase.auth().currentUser;
    console.log('Поточний користувач Firebase:', user ? user.uid : 'null');
    if (!user) {
      console.warn('Користувач не авторизований для очищення даних');
      return;
    }
    if (user.uid !== uid) {
      console.warn(`UID не співпадає: очікував ${uid}, отримав ${user.uid}`);
      return;
    }
    const idToken = await user.getIdToken();
    console.log('Отримано ID токен для очищення даних');
    const response = await APIUtils.makeRequest('/users/clear-data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Дані користувача очищено на бекенді:', response);
  } catch (error) {
    console.error(`Помилка очищення даних користувача на бекенді:`, error);
    // Don't throw error - just log it and continue
    console.log('Продовжуємо без очищення даних на бекенді');
  }
}

// Update collection state on user change
async function handleUserSwitch(newUser) {
  console.log('handleUserSwitch: початок для користувача:', newUser?.uid);
  
  if (lastUserUid && lastUserUid !== newUser?.uid) {
    console.log('handleUserSwitch: зберігаємо стан попереднього користувача:', lastUserUid);
    // Save previous user's state
    await saveCollectionStateForUser(lastUserUid, historyCollector.isCollecting);
    historyCollector.stop();
  }
  
  if (newUser?.uid) {
    console.log('handleUserSwitch: налаштовуємо нового користувача:', newUser.uid);
    
    // Clear old data for new user before starting collection
    console.log('handleUserSwitch: крок 1 - очищення локальних даних...');
    await clearUserData(newUser.uid);
    
    console.log('handleUserSwitch: крок 2 - очищення даних на бекенді (асинхронно)...');
    // Don't await this - let it run in background
    clearUserDataOnBackend(newUser.uid).catch(error => {
      console.error('Помилка асинхронного очищення даних на бекенді:', error);
    });
    
    console.log('handleUserSwitch: крок 3 - перевірка стану збору даних...');
    const collecting = await loadCollectionStateForUser(newUser.uid);
    console.log(`handleUserSwitch: стан збору даних для користувача ${newUser.uid}: ${collecting}`);
    
    if (collecting) {
      console.log('handleUserSwitch: крок 4 - запуск збору даних...');
      historyCollector.start();
      // Don't send dataSyncComplete here - let the collection process send it when complete
    } else {
      console.log('handleUserSwitch: крок 4 - збір даних вимкнено для цього користувача');
      historyCollector.stop();
    }
    lastUserUid = newUser.uid;
    console.log('handleUserSwitch: завершено для користувача:', newUser.uid);
  } else {
    console.log('handleUserSwitch: користувач не вказаний, зупиняємо збір');
    lastUserUid = null;
    historyCollector.stop();
  }
}

// handleAuthentication: інтеграція chrome.identity + Firebase Auth
async function handleAuthentication() {
  try {
    console.log('handleAuthentication: початок');
    
    // Якщо вже залогінений у Firebase
    const user = firebase.auth().currentUser;
    console.log('handleAuthentication: поточний користувач Firebase:', user ? user.uid : 'null');
    
    if (user) {
      console.log('handleAuthentication: користувач вже авторизований, оновлюємо токен');
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
      console.log('handleAuthentication: викликаємо handleUserSwitch');
      await handleUserSwitch(user);
      console.log('handleAuthentication: handleUserSwitch завершено');
      return { success: true, user };
    }
    
    console.log('handleAuthentication: користувач не авторизований, починаємо OAuth');
    // Якщо не залогінений — отримати Google OAuth токен через chrome.identity
    const googleToken = await getGoogleOAuthToken();
    console.log('handleAuthentication: отримано Google токен');
    
    const firebaseUser = await firebaseSignInWithGoogleToken(googleToken);
    console.log('handleAuthentication: увійшли в Firebase:', firebaseUser.uid);
    
    const idToken = await firebaseUser.getIdToken();
    console.log('handleAuthentication: отримано Firebase токен');
    
    await chrome.storage.local.set({
      user: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        authMethod: 'firebase',
        idToken
      }
    });
    console.log('handleAuthentication: збережено дані користувача');
    
    currentUser = firebaseUser;
    console.log('handleAuthentication: викликаємо handleUserSwitch для нового користувача');
    await handleUserSwitch(firebaseUser);
    console.log('handleAuthentication: handleUserSwitch завершено для нового користувача');
    
    return { success: true, user: firebaseUser };
  } catch (error) {
    console.error('handleAuthentication: помилка:', error);
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
      console.log('Ключ шифрування:', { 
        hasKey: !!encryptionKey, 
        keyLength: encryptionKey?.length,
        keyPreview: encryptionKey?.substring(0, 10) + '...'
      });
      sendResponse({ encryptionKey: encryptionKey });
      return;
      
    case 'saveEncryptionKeyToStorage':
      (async () => {
        console.log('Збереження ключа шифрування в chrome.storage для дашборду');
        if (encryptionKey) {
          // Зберігаємо ключ в chrome.storage.local для доступу з дашборду
          await chrome.storage.local.set({ chartex_encryption_key: encryptionKey });
          console.log('Ключ шифрування збережено в chrome.storage.local');
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Ключ шифрування не знайдено' });
        }
      })();
      return true;
      
    case 'updateSettings':
      (async () => {
        console.log('Отримано налаштування від дашборду:', request.settings);
        try {
          // Зберігаємо налаштування в chrome.storage для використання в popup
          await chrome.storage.local.set({ 
            chartex_settings: request.settings,
            chartex_language: request.settings.display?.language || 'uk'
          });
          console.log('Налаштування збережено в chrome.storage');
          sendResponse({ success: true });
        } catch (error) {
          console.error('Помилка збереження налаштувань:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;
      
    case 'startCollection':
      (async () => {
        console.log('Ручний запуск збору даних');
        if (currentUser?.uid) {
          // Clear data before starting manual collection
          console.log('Очищення даних перед ручним збором...');
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
        
        console.log('BG: getStatus', { 
          isCollecting: historyCollector.isCollecting,
          deviceId: deviceId,
          hasDeviceId: !!deviceId,
          authValid: authValid,
          hasUser: !!user
        });
        
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
            console.log(`Отримано дані для користувача ${user.uid}:`, {
              historyCount,
              lastSync,
              hasHistoryCount: !!data[`historyCount_${user.uid}`],
              storageKey: `historyCount_${user.uid}`,
              allKeys: keys,
              allData: data
            });
          } else {
            lastSync = null;
            historyCount = 0;
          }
          sessionCount = sessionId ? 1 : 0;
          console.log('Storage data:', {
            storedDeviceId: data.deviceId,
            hasStoredDeviceId: !!data.deviceId,
            globalDeviceId: deviceId,
            hasGlobalDeviceId: !!deviceId
          });
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
      
    case 'toggleCollection':
      (async () => {
        if (!currentUser?.uid) {
          sendResponse({ success: false, error: 'Not logged in' });
          return;
        }
        const newState = !historyCollector.isCollecting;
        if (newState) {
          // Clear data before starting collection
          console.log('Очищення даних перед перемиканням збору...');
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
  console.log('Розширення Chartex встановлено:', details.reason);
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
      console.log('Розширення ініціалізовано з deviceId:', deviceId);
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
    // === Стабільна ініціалізація deviceId ===
    // deviceId = await getOrCreateStableDeviceId(); // This is now handled by initializeGlobals
    // Завантажити інші дані
    const data = await chrome.storage.local.get(['encryptionKey', 'sessionId', 'user']);
    encryptionKey = data.encryptionKey;
    sessionId = data.sessionId || CryptoUtils.generateSessionId();
    if (!data.sessionId) {
      await chrome.storage.local.set({ sessionId });
    }
    console.log('Дані розширення відновлено, deviceId:', deviceId);
    if (data.user) {
      console.log('Відновлення сесії користувача:', data.user.email);
      // Don't validate during startup to avoid blocking auth process
      // Validation will happen during getStatus calls
    }
    
    // Set up periodic token validation (every 10 minutes)
    setInterval(async () => {
      const user = firebase.auth().currentUser;
      if (user) {
        await validateAuthentication();
      }
    }, 10 * 60 * 1000);
    
  } catch (error) {
    console.error('Помилка ініціалізації при запуску:', error);
  }
});

// Helper: Check if token is valid and refresh if needed
async function checkAndRefreshToken() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      console.log('Користувач не авторизований');
      return false;
    }
    
    // Check if token needs refresh (Firebase tokens expire after 1 hour)
    const tokenResult = await user.getIdTokenResult();
    const expirationTime = new Date(tokenResult.expirationTime);
    const now = new Date();
    const timeUntilExpiry = expirationTime.getTime() - now.getTime();
    
    // Refresh token if it expires in less than 5 minutes
    if (timeUntilExpiry < 5 * 60 * 1000) {
      console.log('Токен скоро закінчиться, оновлюємо...');
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
      
      console.log('Токен успішно оновлено');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('Помилка перевірки/оновлення токена:', error);
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
        console.log('Знайдено збережені дані користувача, але користувач не авторизований');
        // Don't call handleAuthentication here, just return false
        return false;
      }
      return false;
    }
    
    // Check and refresh token if needed
    const tokenValid = await checkAndRefreshToken();
    if (!tokenValid) {
      console.log('Токен недійсний, вимагається повторна авторизація');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Помилка валідації авторизації:', error);
    return false;
  }
}