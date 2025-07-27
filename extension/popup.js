// Popup скрипт для Chartex розширення

class PopupManager {
  constructor() {
    this.elements = {};
    this.status = {
      isCollecting: false,
      deviceId: null,
      hasUser: false,
      userEmail: null
    };
    this.config = window.chartexConfig || { apiUrl: 'http://localhost:5000/api' };
    this.init();
  }
  
  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.loadStatus();
    this.updateUI();
    
    // Автоматично оновлювати статус кожні 5 секунд
    setInterval(() => {
      this.loadStatus();
    }, 5000);
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
      loginBtn: document.getElementById('loginBtn')
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
          await this.sendMessage({ action: 'logout' });
          this.status.hasUser = false;
          this.status.userEmail = null;
          this.updateUI();
        } else {
          // Login
          const response = await this.sendMessage({ action: 'authenticate' });
          console.log('BG RESPONSE:', response);
          await this.loadStatus();
        }
      });
    }
  }
  
  async loadStatus() {
    try {
      const response = await this.sendMessage({ action: 'getStatus' });
      console.log('POPUP: getStatus response', response);
      this.status.isCollecting = !!response.isCollecting;
      this.status.hasUser = !!response.hasUser;
      this.status.userEmail = response.userEmail || null;
      this.status.deviceCount = response.deviceCount || 0;
      this.status.historyCount = response.historyCount || 0;
      this.status.sessionCount = response.sessionCount || 0;
      this.status.lastSync = response.lastSync || null;
      this.updateUI();
    } catch (error) {
      this.showError('Помилка завантаження статусу: ' + error.message);
    }
  }
  
  async toggleCollection() {
    if (!this.status.hasUser) {
      this.showError('Спочатку увійдіть у систему.');
      return;
    }
    try {
      this.setLoading(true);
      const response = await this.sendMessage({ action: 'toggleCollection' });
      if (response.success) {
        this.status.isCollecting = response.collecting;
        this.updateUI();
        this.showSuccess(response.collecting ? 'Збір даних запущено' : 'Збір даних зупинено');
      } else {
        this.showError('Помилка зміни стану збору: ' + (response.error || 'невідома помилка'));
      }
    } catch (error) {
      this.showError('Помилка зміни стану збору: ' + error.message);
    } finally {
      this.setLoading(false);
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
    
    if (this.elements.statusText) {
      this.elements.statusText.textContent = this.status.isCollecting ? 'Збір даних активний' : 'Збір даних зупинено';
    }
    
    if (this.elements.startBtn) {
      this.elements.startBtn.disabled = !this.status.hasUser;
      this.elements.startBtn.textContent = this.status.isCollecting ? '⏹️ Зупинити збір' : '▶️ Почати збір даних';
      this.elements.startBtn.className = this.status.isCollecting ? 'danger' : 'primary';
    }
    if (this.elements.stopBtn) {
      this.elements.stopBtn.style.display = 'none'; // Hide stopBtn, use only one button
    }
    // Show/hide mainButtons div based on auth status
    const mainButtons = document.getElementById('mainButtons');
    if (mainButtons) {
      mainButtons.style.display = this.status.hasUser ? 'flex' : 'none';
    }
    
    // Оновлення статистики
    if (this.elements.deviceCount) {
      this.elements.deviceCount.textContent = this.status.deviceCount || '-';
    }
    if (this.elements.historyCount) {
      this.elements.historyCount.textContent = this.status.historyCount || '-';
    }
    if (this.elements.sessionCount) {
      this.elements.sessionCount.textContent = this.status.sessionCount || '-';
    }
    if (this.elements.lastSync) {
      this.elements.lastSync.textContent = this.formatLastSync(this.status.lastSync);
    }
    
    // Оновлення статусу авторизації
    if (this.elements.authStatus) {
      if (this.status.hasUser) {
        const email = this.status.userEmail || 'Користувач';
        this.elements.authStatus.textContent = `Авторизовано: ${email}`;
      } else {
        this.elements.authStatus.textContent = 'Статус авторизації: Не авторизовано';
      }
    }
    
    if (this.elements.loginBtn) {
      if (this.status.hasUser) {
        this.elements.loginBtn.textContent = '🔓 Вийти';
      } else {
        this.elements.loginBtn.textContent = '🔐 Увійти через Google';
      }
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
    // Відкрити сторінку options (dashboard) extension через background script
    this.sendMessage({ action: 'openOptions' }).then(response => {
      if (response.success) {
        console.log('Options page відкрито');
      } else {
        console.error('Помилка відкриття options page:', response.error);
      }
    }).catch(error => {
      console.error('Помилка відкриття options page:', error);
      // Fallback - спробувати відкрити напряму
      chrome.runtime.openOptionsPage();
    });
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