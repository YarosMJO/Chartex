# Налаштування Production Середовища

## 🔧 Конфігурація для Production

### 1. Frontend Environment (environment.prod.ts)

Файл `frontend/src/environments/environment.prod.ts` вже оновлено з правильними Firebase налаштуваннями:

```typescript
export const environment = {
  production: true,
  firebase: {
    apiKey: "AIzaSyAeWPZOm7CXCslgyn63ScMBcGK_wg8tUNA",
    authDomain: "chartex-2eae7.firebaseapp.com",
    projectId: "chartex-2eae7",
    storageBucket: "chartex-2eae7.firebasestorage.app",
    messagingSenderId: "264979508048",
    appId: "1:264979508048:web:c9501813cf613160a5da55",
    measurementId: "G-PGGLE2T3TD"
  },
  apiUrl: 'https://your-production-api-url.com/api' // ⚠️ ОБОВ'ЯЗКОВО ОНОВІТЬ!
};
```

### 2. Extension Configuration (config.js)

Файл `extension/config.js` містить налаштування для extension:

```javascript
const config = {
  api: {
    development: 'http://localhost:5000/api',
    production: 'https://your-production-api-url.com/api' // ⚠️ ОБОВ'ЯЗКОВО ОНОВІТЬ!
  },
  // ... інші налаштування
};
```

## 🚀 Кроки для Production

### 1. Оновіть API URL

Замініть `https://your-production-api-url.com/api` на реальний URL вашого production API:

- **Frontend**: `frontend/src/environments/environment.prod.ts`
- **Extension**: `extension/config.js`

### 2. Збірка Frontend для Production

```bash
cd frontend
npm run build:prod
```

### 3. Збірка Extension

```bash
cd frontend
npm run build:extension
```

### 4. Розгортання Backend

Налаштуйте ваш backend сервер з MongoDB та розгорніть його.

### 5. Розгортання Frontend

Завантажте збілджені файли з `frontend/dist/chartex-frontend/browser/` на ваш веб-сервер.

## 🔒 Безпека

### Firebase Security Rules

Переконайтеся, що ваші Firebase Security Rules налаштовані правильно:

```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### CORS налаштування

Налаштуйте CORS на вашому backend сервері:

```javascript
// Backend CORS
app.use(cors({
  origin: [
    'https://your-production-domain.com',
    'chrome-extension://your-extension-id'
  ],
  credentials: true
}));
```

## 📋 Перевірка

### 1. Тестування Extension

1. Завантажте extension в Chrome
2. Перевірте авторизацію через Google
3. Перевірте збір даних
4. Перевірте відправку на production API

### 2. Тестування Frontend

1. Відкрийте production URL
2. Перевірте авторизацію
3. Перевірте завантаження даних
4. Перевірте дешифрування

### 3. Тестування API

1. Перевірте всі endpoints
2. Перевірте авторизацію
3. Перевірте збереження даних

## 🐛 Діагностика

### Логи Extension

Відкрийте DevTools для extension:
1. Перейдіть до `chrome://extensions/`
2. Знайдіть Chartex
3. Натисніть "Inspect views: background page"

### Логи Frontend

Відкрийте DevTools браузера на production сайті.

### Логи Backend

Перевірте логи вашого backend сервера.

## 📝 Примітки

- **Firebase конфігурація** вже налаштована правильно
- **Extension ID** може змінитися при завантаженні в Chrome Web Store
- **API URL** повинен бути HTTPS для production
- **CORS** повинен бути налаштований для вашого домену 