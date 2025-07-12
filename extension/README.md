# Chartex Chrome Extension

Chrome розширення для збору історії браузерної активності.

## Встановлення

### 1. Підготовка іконок
- Відкрийте `icon.html` в браузері
- Зробіть скріншот кожної іконки
- Збережіть як PNG файли:
  - `icon16.png` (16x16 пікселів)
  - `icon48.png` (48x48 пікселів) 
  - `icon128.png` (128x128 пікселів)

### 2. Встановлення в Chrome
1. Відкрийте Chrome Extensions: `chrome://extensions/`
2. Увімкніть "Developer mode" (праворуч зверху)
3. Натисніть "Load unpacked"
4. Виберіть папку `extension/`

### 3. Перевірка роботи
- Розширення з'явиться в toolbar
- Натисніть на іконку для відкриття popup
- Перевірте, що backend запущений на `http://localhost:5000`

## Функціональність

- ✅ Збір історії браузера
- ✅ Шифрування даних
- ✅ Відправка на backend
- ✅ Firebase Auth (Google авторизація)
- ✅ Синхронізація з dashboard

## Структура файлів

```
extension/
├── manifest.json          # Маніфест розширення
├── background.js          # Фоновий скрипт
├── popup.html            # Popup інтерфейс
├── popup.js              # Popup логіка
├── firebase-app-compat.js # Firebase App
├── firebase-auth-compat.js # Firebase Auth
├── firebase-config.js     # Firebase конфігурація
├── crypto-js.min.js       # CryptoJS бібліотека
├── crypto-utils.js        # Утиліти шифрування
├── chrome-auth.js         # Chrome Identity API (fallback)
├── icon.html             # Генератор іконок
├── icon.svg              # SVG іконка
└── README.md             # Цей файл
```

## Налаштування

### Backend URL
Змініть `API_BASE_URL` в `background.js` якщо потрібно:
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

### Firebase (майбутнє)
Коли буде додано Firebase Auth, розкоментуйте відповідні рядки в `background.js`.

## Безпека

- Всі приватні дані шифруються перед відправкою
- Використовується zero-knowledge шифрування
- Ключі шифрування зберігаються локально
- Сервер отримує лише зашифровані дані

## Розробка

Для розробки:
1. Внесіть зміни в файли
2. Перейдіть в `chrome://extensions/`
3. Натисніть "Reload" на розширенні
4. Тестуйте зміни 