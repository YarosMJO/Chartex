// Popup скрипт для Chartex розширення

class PopupManager {
  constructor() {
    this.status = {
      isCollecting: false,
      hasUser: false,
      userEmail: null,
      deviceCount: 0,
      historyCount: 0,
      sessionCount: 0,
      lastSync: null,
      isProcessing: false // New state for processing
    };
    this.elements = {};
    this.config = window.chartexConfig || { apiUrl: 'http://localhost:5000/api' };
    this.translations = {}; // Store current translations
    this.init();
  }
  
  async init() {
    this.cacheElements();
    this.bindEvents();
    
    // Load language settings first
    await this.loadLanguageSettings();
    
    // Show loading overlay to prevent flickering during initial status check
    this.showLoadingOverlay('Завантаження...');
    
    await this.loadStatus(true); // Skip spinner since overlay is active
    this.updateUI();
    
    // Hide loading overlay after initial load
    this.hideLoadingOverlay();
    
    // Listen for background messages about data sync completion
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.action === 'dataSyncComplete') {
        this.loadStatus();
      }
    });
    
    // Listen for storage changes to update language
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.chartex_language) {
        console.log('Мова змінена в налаштуваннях:', changes.chartex_language.newValue);
        this.applyLanguage(changes.chartex_language.newValue);
      }
    });
  }
  
  async loadLanguageSettings() {
    try {
      // Load language from chrome.storage
      const result = await chrome.storage.local.get(['chartex_language']);
      const language = result.chartex_language || 'uk';
      
      console.log('Завантажена мова для popup:', language);
      console.log('Результат з chrome.storage:', result);
      
      // Apply language to popup
      this.applyLanguage(language);
      
    } catch (error) {
      console.error('Помилка завантаження мови:', error);
      // Fallback to Ukrainian
      this.applyLanguage('uk');
    }
  }
  
  applyLanguage(language) {
    console.log('Застосування мови в popup:', language);
    
    // Load translation file based on language
    const translationFile = language === 'en' ? 'en.json' : 'uk.json';
    const translationUrl = chrome.runtime.getURL(`dashboard/assets/i18n/${translationFile}`);
    
    console.log('URL для завантаження перекладів:', translationUrl);
    
    fetch(translationUrl)
      .then(response => {
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(translations => {
        console.log('Переклади завантажено:', translations);
        this.translatePopup(translations);
        // Update UI after translations are loaded
        this.updateUI();
      })
      .catch(error => {
        console.error('Помилка завантаження перекладів:', error);
        // Try to load Ukrainian as fallback if current language is not Ukrainian
        if (language !== 'uk') {
          console.log('Спроба fallback на українську мову');
          this.applyLanguage('uk');
        } else {
          console.error('Не вдалося завантажити переклади для української мови');
          // Don't update UI if translations failed to load
        }
      });
  }
  
  translatePopup(translations) {
    this.translations = translations; // Store translations
    console.log('Початок перекладу popup елементів');
    
    // Translate popup elements
    const elementsToTranslate = {
      'startBtn': 'POPUP.START_COLLECTION',
      'openDashboard': 'POPUP.OPEN_DASHBOARD',
      'loginBtn': 'POPUP.LOGIN',
      'authStatus': 'POPUP.AUTH_STATUS',
      'statusText': 'POPUP.STATUS_TEXT',
      'deviceCount': 'POPUP.DEVICE_COUNT',
      'historyCount': 'POPUP.HISTORY_COUNT',
      'sessionCount': 'POPUP.SESSION_COUNT',
      'lastSync': 'POPUP.LAST_SYNC'
    };
    
    Object.entries(elementsToTranslate).forEach(([elementId, translationKey]) => {
      const element = this.elements[elementId];
      console.log(`Переклад елемента ${elementId}:`, element ? 'знайдено' : 'не знайдено');
      if (element) {
        const translation = this.getNestedTranslation(translations, translationKey);
        console.log(`Ключ ${translationKey}:`, translation);
        if (translation) {
          if (element.tagName === 'INPUT' && element.type === 'placeholder') {
            element.placeholder = translation;
          } else {
            element.textContent = translation;
          }
          console.log(`Елемент ${elementId} перекладено на:`, translation);
        } else {
          console.warn(`Переклад не знайдено для ключа: ${translationKey}`);
        }
      }
    });
    
    // Update loading overlay text
    if (this.elements.loadingOverlay) {
      const loadingText = this.getNestedTranslation(translations, 'POPUP.LOADING') || 'Завантаження...';
      const loadingTextElement = this.elements.loadingOverlay.querySelector('.loading-text');
      if (loadingTextElement) {
        loadingTextElement.textContent = loadingText;
      }
    }
    
    console.log('Переклад popup завершено');
  }
  
  getNestedTranslation(translations, key) {
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }
    
    return value;
  }
  
  cacheElements() {
    this.elements = {
      error: document.getElementById('error'),
      statusIndicator: document.getElementById('statusIndicator'),
      statusText: document.getElementById('statusText'),
      deviceCount: document.getElementById('deviceCount'),
      historyCount: document.getElementById('historyCount'),
      sessionCount: document.getElementById('sessionCount'),
      lastSync: document.getElementById('lastSync'),
      startBtn: document.getElementById('startBtn'),
      stopBtn: document.getElementById('stopBtn'),
      openDashboard: document.getElementById('openDashboard'),
      authStatus: document.getElementById('authStatus'),
      loginBtn: document.getElementById('loginBtn'),
      loadingOverlay: document.getElementById('loadingOverlay')
    };
  }
  
  bindEvents() {
    // Перевіряємо, чи всі елементи існують перед додаванням event listeners
    if (this.elements.startBtn) {
      this.elements.startBtn.addEventListener('click', () => this.toggleCollection());
    }
    if (this.elements.stopBtn) {
      this.elements.stopBtn.addEventListener('click', () => this.toggleCollection());
    }
    if (this.elements.openDashboard) {
      this.elements.openDashboard.addEventListener('click', () => this.openDashboard());
    }
    if (this.elements.loginBtn) {
      this.elements.loginBtn.addEventListener('click', async () => {
        console.log('LOGIN BUTTON CLICKED');
        if (this.status.hasUser) {
          // Logout
          this.showLoadingOverlay('Вихід з системи...');
          try {
            await this.sendMessage({ action: 'logout' });
            this.status.hasUser = false;
            this.status.userEmail = null;
            this.updateUI();
          } finally {
            this.hideLoadingOverlay();
          }
        } else {
          // Login
          this.showLoadingOverlay('Авторизація...');
          try {
            const response = await this.sendMessage({ action: 'authenticate' });
            console.log('BG RESPONSE:', response);
            
            // After successful login, check if data collection is enabled
            if (response.success && response.user) {
              this.status.hasUser = true;
              this.status.userEmail = response.user.email;
              
              // Check if data collection is enabled for this user
              this.showLoadingOverlay('Перевірка налаштувань...');
              const statusResponse = await this.sendMessage({ action: 'getStatus' });
              this.status.isCollecting = !!statusResponse.isCollecting;
              
              if (this.status.isCollecting) {
                // Show spinner immediately when data collection is enabled
                this.showLoadingOverlay('Збір даних...');
                
                // Update UI to show user is logged in and spinner is active
                this.updateUI();
                
                // Data collection is already started by handleUserSwitch, just wait for completion
                // The dataSyncComplete message will be sent when collection finishes
                const spinnerStartTime = Date.now();
                
                // Ensure spinner shows for at least 2 seconds
                const elapsed = Date.now() - spinnerStartTime;
                const remainingTime = Math.max(0, 2000 - elapsed);
                if (remainingTime > 0) {
                  await new Promise(resolve => setTimeout(resolve, remainingTime));
                }
                
                // Reload status to get updated counts (skip spinner since overlay is active)
                await this.loadStatus(true);
              } else {
                // If collection is not enabled, just update UI normally
                await this.loadStatus(true);
                this.updateUI();
              }
            } else {
              // Login failed
              this.showError('Помилка авторизації: ' + (response.error || 'невідома помилка'));
            }
          } finally {
            this.hideLoadingOverlay();
          }
        }
      });
    }
  }
  
  async loadStatus(skipSpinner = false) {
    try {
      // Show spinner for history count only if not already showing and not skipped
      const historyCount = document.getElementById('historyCount');
      const historyCountSpinner = document.getElementById('historyCountSpinner');
      const isSpinnerVisible = historyCountSpinner && historyCountSpinner.style.display === 'block';
      
      if (historyCount && historyCountSpinner && !isSpinnerVisible && !skipSpinner) {
        historyCount.style.display = 'none';
        historyCountSpinner.style.display = 'block';
      }
      
      // Wait at least 2 seconds before showing the number (only if spinner is shown)
      let minDelay = Promise.resolve();
      if (!skipSpinner && historyCountSpinner && historyCountSpinner.style.display === 'block') {
        minDelay = new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const response = await this.sendMessage({ action: 'getStatus' });
      console.log('POPUP: getStatus response', response);
      this.status.isCollecting = !!response.isCollecting;
      this.status.hasUser = !!response.hasUser;
      this.status.userEmail = response.userEmail || null;
      this.status.deviceCount = response.deviceCount || 0;
      this.status.historyCount = response.historyCount || 0;
      this.status.sessionCount = response.sessionCount || 0;
      this.status.lastSync = response.lastSync || null;
      await minDelay;
      // Hide spinner, show number
      if (historyCount && historyCountSpinner) {
        historyCount.style.display = 'block';
        historyCountSpinner.style.display = 'none';
      }
      this.updateUI();
    } catch (error) {
      this.showError('Помилка завантаження статусу: ' + error.message);
      // Hide spinner, show number even on error
      const historyCount = document.getElementById('historyCount');
      const historyCountSpinner = document.getElementById('historyCountSpinner');
      if (historyCount && historyCountSpinner) {
        historyCount.style.display = 'block';
        historyCountSpinner.style.display = 'none';
      }
    }
  }
  
  async toggleCollection() {
    if (!this.status.hasUser) {
      this.showError('Спочатку увійдіть у систему.');
      return;
    }
    try {
      this.setProcessing(true);
      const response = await this.sendMessage({ action: 'toggleCollection' });
      if (response.success) {
        this.status.isCollecting = response.collecting;
        this.updateUI();
      } else {
        this.showError('Помилка зміни стану збору: ' + (response.error || 'невідома помилка'));
      }
    } catch (error) {
      this.showError('Помилка зміни стану збору: ' + error.message);
    } finally {
      this.setProcessing(false);
    }
  }
  
  updateUI() {
    console.log('updateUI', this.status);
    // Оновлення індикатора статусу
    if (this.elements.statusIndicator) {
      if (this.status.isCollecting) {
        this.elements.statusIndicator.className = 'status-indicator active';
      } else {
        this.elements.statusIndicator.className = 'status-indicator inactive';
      }
    }
    
    // Only update text elements if translations are loaded
    if (Object.keys(this.translations).length > 0) {
      if (this.elements.statusText) {
        const statusText = this.status.isCollecting ? 
          this.getTranslation('POPUP.STATUS_TEXT_COLLECTING') : 
          this.getTranslation('POPUP.STATUS_TEXT_STOPPED');
        if (statusText) {
          this.elements.statusText.textContent = statusText;
        }
      }
      
      if (this.elements.startBtn) {
        this.elements.startBtn.disabled = !this.status.hasUser || this.status.isProcessing;
        const btnText = this.status.isCollecting ? 
          this.getTranslation('POPUP.STOP_COLLECTION') : 
          this.getTranslation('POPUP.START_COLLECTION');
        if (btnText) {
          this.elements.startBtn.textContent = btnText;
        }
        this.elements.startBtn.className = this.status.isCollecting ? 'danger' : 'primary';
      }
      
      if (this.elements.authStatus) {
        if (this.status.hasUser) {
          const email = this.status.userEmail || 'Користувач';
          const authText = this.getTranslation('POPUP.AUTH_STATUS_LOGGED_IN', { email: email });
          if (authText) {
            this.elements.authStatus.textContent = authText;
          }
        } else {
          const authText = this.getTranslation('POPUP.AUTH_STATUS_NOT_LOGGED_IN');
          if (authText) {
            this.elements.authStatus.textContent = authText;
          }
        }
      }
      
      if (this.elements.loginBtn) {
        if (this.status.hasUser) {
          const logoutText = this.getTranslation('POPUP.LOGOUT');
          if (logoutText) {
            this.elements.loginBtn.textContent = logoutText;
          }
        } else {
          const loginText = this.getTranslation('POPUP.LOGIN_GOOGLE');
          if (loginText) {
            this.elements.loginBtn.textContent = loginText;
          }
        }
      }
    }
    
    if (this.elements.stopBtn) {
      this.elements.stopBtn.style.display = 'none'; // Hide stopBtn, use only one button
    }
    if (this.elements.openDashboard) {
      this.elements.openDashboard.disabled = this.status.isProcessing;
    }
    if (this.elements.loginBtn) {
      this.elements.loginBtn.disabled = this.status.isProcessing;
    }
    // Show/hide mainButtons div based on auth status
    const mainButtons = document.getElementById('mainButtons');
    if (mainButtons) {
      mainButtons.style.display = this.status.hasUser ? 'flex' : 'none';
    }
    // Show/hide statusPanel based on auth status
    const statusPanel = document.getElementById('statusPanel');
    if (statusPanel) {
      statusPanel.style.display = this.status.hasUser ? 'block' : 'none';
    }
    
    // Оновлення статистики (завжди оновлюємо, незалежно від перекладів)
    if (this.elements.deviceCount) {
      this.elements.deviceCount.textContent = this.status.deviceCount || '-';
    }
    if (this.elements.historyCount) {
      this.elements.historyCount.textContent = this.status.historyCount > 0 ? this.status.historyCount : '-';
    }
    if (this.elements.sessionCount) {
      this.elements.sessionCount.textContent = this.status.sessionCount || '-';
    }
    if (this.elements.lastSync) {
      this.elements.lastSync.textContent = this.formatLastSync(this.status.lastSync);
    }
  }
  
  async startCollection() {
    try {
      this.setLoading(true);
      const response = await this.sendMessage({ action: 'startCollection' });
      
      if (response.success) {
        this.status.isCollecting = true;
        this.updateUI();
        this.showSuccess('Збір даних запущено');
      } else {
        this.showError('Помилка запуску збору даних: ' + response.error);
      }
    } catch (error) {
      this.showError('Помилка запуску збору даних: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }
  
  async stopCollection() {
    try {
      this.setLoading(true);
      const response = await this.sendMessage({ action: 'stopCollection' });
      
      if (response.success) {
        this.status.isCollecting = false;
        this.updateUI();
        this.showSuccess('Збір даних зупинено');
      } else {
        this.showError('Помилка зупинки збору даних: ' + response.error);
      }
    } catch (error) {
      this.showError('Помилка зупинки збору даних: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }
  
  openDashboard() {
    this.setProcessing(true);
    try {
      chrome.runtime.openOptionsPage();
      this.showSuccess('Dashboard відкрито');
    } catch (error) {
      this.showError('Помилка відкриття dashboard: ' + error.message);
    } finally {
      this.setProcessing(false);
    }
  }
  
  async testDataCollection() {
    try {
      this.setLoading(true);
      console.log('=== ПОЧАТОК ТЕСТУ ЗБОРУ ДАНИХ ===');
      
      // Тест 1: Перевірити доступ до історії
      const historyTest = await new Promise((resolve) => {
        chrome.history.search({
          text: '',
          maxResults: 5,
          startTime: Date.now() - 24 * 60 * 60 * 1000 // Останні 24 години
        }, resolve);
      });
      
      console.log('Тест доступу до історії:', {
        hasAccess: !!historyTest,
        itemsCount: historyTest?.length || 0,
        sampleItem: historyTest?.[0]
      });
      
      // Тест 2: Перевірити збережені дані
      const storageTest = await new Promise((resolve) => {
        chrome.storage.local.get(['deviceId', 'encryptionKey', 'user'], resolve);
      });
      
      console.log('Тест збережених даних:', {
        hasDeviceId: !!storageTest.deviceId,
        hasEncryptionKey: !!storageTest.encryptionKey,
        hasUser: !!storageTest.user,
        userEmail: storageTest.user?.email
      });
      
      // Тест 3: Перевірити статус збору
      const statusTest = await this.sendMessage({ action: 'getStatus' });
      console.log('Тест статусу:', statusTest);
      
      // Тест 4: Спробувати відправити тестовий запис
      if (historyTest.length > 0 && storageTest.user) {
        console.log('Спроба відправки тестового запису...');
        const testResponse = await this.sendMessage({ 
          action: 'testSendData',
          data: historyTest[0]
        });
        console.log('Результат тестової відправки:', testResponse);
      }
      
      console.log('=== КІНЕЦЬ ТЕСТУ ===');
      this.showSuccess('Тест завершено. Перевірте консоль для деталей.');
      
    } catch (error) {
      console.error('Помилка тесту:', error);
      this.showError('Помилка тесту: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }
  
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
  
  setLoading(loading) {
    const buttons = [
      this.elements.startBtn,
      this.elements.stopBtn,
      this.elements.openDashboard,
      this.elements.loginBtn
    ].filter(Boolean);
    
    buttons.forEach(button => {
      button.disabled = loading;
      if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = '⏳ Завантаження...';
      } else if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    });
  }
  
  setProcessing(processing) {
    this.status.isProcessing = processing;
    
    // Handle all buttons - make them visually disabled but keep text unchanged
    const allButtons = [
      this.elements.startBtn,
      this.elements.stopBtn,
      this.elements.openDashboard,
      this.elements.loginBtn
    ].filter(Boolean);
    
    allButtons.forEach(button => {
      button.disabled = processing;
      if (processing) {
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
      } else {
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
    });
    
    // Update UI to reflect processing state
    this.updateUI();
  }
  
  showLoadingOverlay(text = 'Авторизація...') {
    if (this.elements.loadingOverlay) {
      const loadingText = this.elements.loadingOverlay.querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = text;
      }
      this.elements.loadingOverlay.style.display = 'flex';
    }
  }
  
  hideLoadingOverlay() {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = 'none';
    }
  }
  
  showError(message) {
    if (this.elements.error) {
      this.elements.error.textContent = message;
      this.elements.error.style.display = 'block';
      this.elements.error.className = 'error-message';
      
      setTimeout(() => {
        this.elements.error.style.display = 'none';
      }, 5000);
    }
    console.error('Popup Error:', message);
  }
  
  showSuccess(message) {
    if (this.elements.error) {
      this.elements.error.textContent = message;
      this.elements.error.style.display = 'block';
      this.elements.error.className = 'success-message';
      
      setTimeout(() => {
        this.elements.error.style.display = 'none';
      }, 3000);
    }
    console.log('Popup Success:', message);
  }
  
  formatLastSync(timestamp) {
    if (!timestamp) return 'Ніколи';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Тільки що';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} хв тому`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
    
    return date.toLocaleDateString('uk-UA');
  }

  getTranslation(key, params = {}) {
    let translation = this.getNestedTranslation(this.translations, key);
    if (!translation) {
      console.warn(`Translation key not found: ${key}`);
      return null; // Return null when translation is not found
    }

    // Replace placeholders with actual values
    return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      return acc.replace(regex, paramValue);
    }, translation);
  }
}

// Ініціалізація popup при завантаженні
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('open-options');
  if (btn) {
    btn.addEventListener('click', function () {
      if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        alert('Не вдалося відкрити сторінку налаштувань.');
      }
    });
  }
}); 