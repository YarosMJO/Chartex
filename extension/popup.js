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
      this.showLoadingOverlay(this.getTranslation('POPUP_MESSAGES.LOADING'));
    
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
        console.log('Зміна мови в popup:', changes.chartex_language.newValue);
        console.log('Поточні переклади перед оновленням:', Object.keys(this.translations));
        this.applyLanguage(changes.chartex_language.newValue);
      }
    });
  }
  
  async loadLanguageSettings() {
    try {
      // Load language from chrome.storage
      const result = await chrome.storage.local.get(['chartex_language']);
      const language = result.chartex_language || 'uk';
      
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
    console.log('URL файлу перекладів:', translationUrl);
    
    fetch(translationUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(translations => {
        this.translatePopup(translations);
        // Update UI after translations are loaded
        this.updateUI();
      })
      .catch(error => {
        console.error('Помилка завантаження перекладів:', error);
        // Try to load Ukrainian as fallback if current language is not Ukrainian
        if (language !== 'uk') {
          console.log('Спроба завантажити українську мову як fallback');
          // Load Ukrainian translations directly without recursive call
          const ukTranslationUrl = chrome.runtime.getURL('dashboard/assets/i18n/uk.json');
          fetch(ukTranslationUrl)
            .then(response => response.json())
            .then(translations => {
              this.translatePopup(translations);
              this.updateUI();
            })
            .catch(fallbackError => {
              console.error('Не вдалося завантажити переклади для української мови:', fallbackError);
            });
        } else {
          console.error('Не вдалося завантажити переклади для української мови');
          // Don't update UI if translations failed to load
        }
      });
  }
  
  translatePopup(translations) {
    console.log('translatePopup викликано з перекладами:', Object.keys(translations));
    console.log('POPUP_MESSAGES секція:', translations.POPUP_MESSAGES);
    this.translations = translations; // Store translations
    
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
      'lastSync': 'POPUP.LAST_SYNC',
      // Header elements
      'headerTitle': 'POPUP_HEADER.TITLE',
      'headerDescription': 'POPUP_HEADER.DESCRIPTION',
      // Stat labels
      'deviceCountLabel': 'POPUP.DEVICE_COUNT',
      'historyCountLabel': 'POPUP.HISTORY_COUNT',
      'sessionCountLabel': 'POPUP.SESSION_COUNT',
      'lastSyncLabel': 'POPUP.LAST_SYNC',
      // Loading text
      'loadingText': 'POPUP_MESSAGES.AUTHORIZING_DEFAULT'
    };
    
    Object.entries(elementsToTranslate).forEach(([elementId, translationKey]) => {
      const element = this.elements[elementId];
      if (element) {
        const translation = this.getNestedTranslation(translations, translationKey);
        if (translation) {
          if (element.tagName === 'INPUT' && element.type === 'placeholder') {
            element.placeholder = translation;
          } else {
            element.textContent = translation;
          }
        }
      }
    });
    
    // Update loading overlay text
    if (this.elements.loadingOverlay) {
      const loadingText = this.getNestedTranslation(translations, 'POPUP.LOADING');
      const loadingTextElement = this.elements.loadingOverlay.querySelector('.loading-text');
      if (loadingTextElement) {
        loadingTextElement.textContent = loadingText;
      }
    }
  }
  
  getNestedTranslation(translations, key) {
    console.log('getNestedTranslation викликано з ключем:', key, 'та перекладами:', Object.keys(translations));
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      console.log('Шукаємо ключ:', k, 'в об\'єкті:', Object.keys(value || {}));
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
        console.log('Знайдено значення:', value);
      } else {
        console.log('Ключ не знайдено:', k);
        console.log('Доступні ключі в поточному об\'єкті:', Object.keys(value || {}));
        return null;
      }
    }
    
    console.log('Повертаємо фінальне значення:', value);
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
      loadingOverlay: document.getElementById('loadingOverlay'),
      // Header elements
      headerTitle: document.getElementById('headerTitle'),
      headerDescription: document.getElementById('headerDescription'),
      // Stat labels
      deviceCountLabel: document.getElementById('deviceCountLabel'),
      historyCountLabel: document.getElementById('historyCountLabel'),
      sessionCountLabel: document.getElementById('sessionCountLabel'),
      lastSyncLabel: document.getElementById('lastSyncLabel'),
      // Loading text
      loadingText: document.getElementById('loadingText')
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
          this.showLoadingOverlay(this.getTranslation('POPUP_MESSAGES.LOGGING_OUT'));
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
          this.showLoadingOverlay(this.getTranslation('POPUP_MESSAGES.AUTHORIZING'));
          try {
                    const response = await this.sendMessage({ action: 'authenticate' });
            
            // After successful login, check if data collection is enabled
            if (response.success && response.user) {
              this.status.hasUser = true;
              this.status.userEmail = response.user.email;
              
              // Check if data collection is enabled for this user
              this.showLoadingOverlay(this.getTranslation('POPUP_MESSAGES.CHECKING_SETTINGS'));
              const statusResponse = await this.sendMessage({ action: 'getStatus' });
              this.status.isCollecting = !!statusResponse.isCollecting;
              
              // If collection is enabled, start it immediately
              if (this.status.isCollecting) {
                this.showLoadingOverlay(this.getTranslation('POPUP_MESSAGES.COLLECTING_DATA'));
                
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
              const errorMsg = this.getTranslation('POPUP_MESSAGES.AUTH_ERROR', { error: response.error || this.getTranslation('POPUP_MESSAGES.UNKNOWN_ERROR') });
              this.showError(errorMsg);
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
      const errorMsg = this.getTranslation('POPUP_MESSAGES.LOAD_STATUS_ERROR', { error: error.message });
      this.showError(errorMsg);
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
      const errorMsg = this.getTranslation('POPUP_MESSAGES.LOGIN_FIRST');
      this.showError(errorMsg);
      return;
    }
    try {
      this.setProcessing(true);
      const response = await this.sendMessage({ action: 'toggleCollection' });
      if (response.success) {
        this.status.isCollecting = response.collecting;
        this.updateUI();
      } else {
        const errorMsg = this.getTranslation('POPUP_MESSAGES.TOGGLE_COLLECTION_ERROR', { error: response.error || this.getTranslation('POPUP_MESSAGES.UNKNOWN_ERROR') });
        this.showError(errorMsg);
      }
    } catch (error) {
      const errorMsg = this.getTranslation('POPUP_MESSAGES.TOGGLE_COLLECTION_ERROR', { error: error.message });
      this.showError(errorMsg);
    } finally {
      this.setProcessing(false);
    }
  }
  
  updateUI() {
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
          const email = this.status.userEmail || this.getTranslation('POPUP_MESSAGES.USER_DEFAULT');
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
      console.log('Оновлення lastSync з timestamp:', this.status.lastSync);
      const formattedText = this.formatLastSync(this.status.lastSync);
      console.log('Форматований текст lastSync:', formattedText);
      this.elements.lastSync.textContent = formattedText;
    }
  }
  
  async startCollection() {
    try {
      this.setLoading(true);
      const response = await this.sendMessage({ action: 'startCollection' });
      
      if (response.success) {
        this.status.isCollecting = true;
        this.updateUI();
        const successMsg = this.getTranslation('POPUP_MESSAGES.COLLECTION_STARTED');
        this.showSuccess(successMsg);
      } else {
                  const errorMsg = this.getTranslation('POPUP_MESSAGES.START_COLLECTION_ERROR', { error: response.error });
        this.showError(errorMsg);
      }
    } catch (error) {
      const errorMsg = this.getTranslation('POPUP_MESSAGES.START_COLLECTION_ERROR', { error: error.message });
      this.showError(errorMsg);
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
        const successMsg = this.getTranslation('POPUP_MESSAGES.COLLECTION_STOPPED');
        this.showSuccess(successMsg);
      } else {
                  const errorMsg = this.getTranslation('POPUP_MESSAGES.STOP_COLLECTION_ERROR', { error: response.error });
        this.showError(errorMsg);
      }
    } catch (error) {
      const errorMsg = this.getTranslation('POPUP_MESSAGES.STOP_COLLECTION_ERROR', { error: error.message });
      this.showError(errorMsg);
    } finally {
      this.setLoading(false);
    }
  }
  
  openDashboard() {
    try {
      chrome.runtime.openOptionsPage();
      const successMsg = this.getTranslation('POPUP_MESSAGES.DASHBOARD_OPENED');
      this.showSuccess(successMsg);
    } catch (error) {
      const errorMsg = this.getTranslation('POPUP_MESSAGES.OPEN_DASHBOARD_ERROR', { error: error.message });
      this.showError(errorMsg);
    }
  }
  
  async testDataCollection() {
    try {
      this.setLoading(true);
      console.log('Тестування збору даних...');
      
      const response = await this.sendMessage({ 
        action: 'testDataCollection',
        data: {
          url: 'https://example.com',
          title: 'Test Page',
          visitTime: new Date().toISOString(),
          duration: 30
        }
      });
      
      if (response.success) {
        console.log('Тест успішний:', response);
        const successMsg = this.getTranslation('POPUP_MESSAGES.TEST_COMPLETED');
        this.showSuccess(successMsg);
      } else {
        console.error('Тест невдалий:', response.error);
                  const errorMsg = this.getTranslation('POPUP_MESSAGES.TEST_ERROR', { error: response.error });
        this.showError(errorMsg);
      }
    } catch (error) {
      console.error('Помилка тесту:', error);
      const errorMsg = this.getTranslation('POPUP_MESSAGES.TEST_ERROR', { error: error.message });
      this.showError(errorMsg);
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
        button.textContent = this.getTranslation('POPUP_MESSAGES.LOADING_TEXT');
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
  
  showLoadingOverlay(text = null) {
    if (!text) {
      text = this.getTranslation('POPUP_MESSAGES.AUTHORIZING_DEFAULT');
    }
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
    console.log('formatLastSync викликано з timestamp:', timestamp);
    
    if (!timestamp) {
      const neverText = this.getTranslation('POPUP_MESSAGES.NEVER');
      console.log('Повертаємо NEVER:', neverText);
      return neverText;
    }
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    console.log('Розрахунок часу:', { date, now, diff, diffMinutes: Math.floor(diff / 60000) });
    
    if (diff < 60000) {
      const justNowText = this.getTranslation('POPUP_MESSAGES.JUST_NOW');
      console.log('Повертаємо JUST_NOW:', justNowText);
      return justNowText;
    }
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      const minutesText = this.getTranslation('POPUP_MESSAGES.MINUTES');
      const result = `${minutes} ${minutesText} тому`;
      console.log('Повертаємо хвилини:', result);
      return result;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      const hoursText = this.getTranslation('POPUP_MESSAGES.HOURS');
      const result = `${hours} ${hoursText} тому`;
      console.log('Повертаємо години:', result);
      return result;
    }
    
    const result = date.toLocaleDateString('uk-UA');
    console.log('Повертаємо дату:', result);
    return result;
  }

  getTranslation(key, params = {}) {
    let translation = this.getNestedTranslation(this.translations, key);
    if (!translation) {
      console.warn('Переклад не знайдено для ключа:', key, 'Доступні переклади:', Object.keys(this.translations));
      return key; // Return key when translation is not found
    }

    // Replace placeholders with actual values
    const result = Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      return acc.replace(regex, paramValue);
    }, translation);
    
    console.log('Переклад для ключа', key, ':', result);
    return result;
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
        alert(this.getTranslation('POPUP_MESSAGES.CANT_OPEN_OPTIONS'));
      }
    });
  }
}); 