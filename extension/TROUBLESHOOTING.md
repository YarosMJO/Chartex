# 🔧 Виправлення помилок Chartex Extension

## Помилка: "Uncaught ReferenceError: window is not defined"

### Опис проблеми
Ця помилка виникає в Service Worker (background.js), оскільки в ньому немає об'єкта `window`.

### Рішення
✅ **ВИПРАВЛЕНО** - Оновлено `config.js` для підтримки Service Worker:

```javascript
// Визначення середовища для Service Worker
const isDevelopment = typeof window === 'undefined' || 
                     (window.location && (
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.protocol === 'chrome-extension:'
                     ));

// Експорт конфігурації
if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = { ... };
} else if (typeof window !== 'undefined') {
  // Browser
  window.chartexConfig = { ... };
} else {
  // Service Worker
  self.chartexConfig = { ... };
}
```

### Зміни в файлах

1. **config.js** - Додано підтримку Service Worker
2. **background.js** - Оновлено для використання `self.chartexConfig`
3. **popup.js** - Оновлено для використання `window.chartexConfig`
4. **popup.html** - Додано завантаження `config.js`

## Тестування конфігурації

### Відкрити тестовий файл
1. Відкрийте Chrome
2. Перейдіть до `chrome-extension://[ID]/test-config.html`
3. Перевірте результати тестів

### Перевірка в консолі
```javascript
// В popup
console.log(window.chartexConfig);

// В background script (Service Worker)
console.log(self.chartexConfig);
```

## Інші поширені помилки

### 1. "Failed to load resource"
- Перевірте, чи запущений backend на `http://localhost:5000`
- Перевірте CORS налаштування

### 2. "Firebase is not defined"
- Перевірте, чи завантажені Firebase скрипти
- Перевірте порядок завантаження скриптів

### 3. "Permission denied"
- Перевірте permissions в `manifest.json`
- Перезавантажте extension

## Структура файлів

```
extension/
├── config.js              # Центральна конфігурація
├── background.js          # Service Worker
├── popup.js              # Popup скрипт
├── popup.html            # Popup HTML
├── test-config.html      # Тест конфігурації
├── manifest.json         # Маніфест extension
└── dashboard/            # Angular додаток
    └── dashboard.html
```

## Налаштування середовищ

### Development
- API URL: `http://localhost:5000/api`
- Firebase: development проект
- Збір даних: тестовий режим

### Production
- API URL: `https://your-production-api-url.com/api`
- Firebase: production проект
- Збір даних: повний режим

## Оновлення конфігурації

1. Відредагуйте `config.js`
2. Перезавантажте extension
3. Перевірте тестовий файл
4. Протестуйте функціональність

## Логування

### Включення детального логування
```javascript
// В background.js
console.log('API URL:', chartexConfig.apiUrl);
console.log('Environment:', chartexConfig.environment);
```

### Перегляд логів
1. Відкрийте Chrome DevTools
2. Перейдіть до вкладки "Console"
3. Виберіть "Service Worker" для background.js
4. Виберіть "Extension" для popup.js 