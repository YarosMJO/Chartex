# 📊 Chartex - Browser Analytics Extension

**Chartex** - це Chrome extension для збору та аналізу історії браузерної активності користувача з красивою візуалізацією даних. Проект реалізує концепцію Zero Knowledge з повним шифруванням даних на клієнті.

## 🌟 Особливості

- **🔍 Збір історії браузера** - автоматичний збір даних про відвідування сайтів
- **🔐 Zero Knowledge** - повне шифрування даних на клієнті (AES), сервер зберігає лише зашифровані дані
- **📊 Аналітика** - детальні графіки та статистика активності з ApexCharts
# Chartex — Browser Analytics Extension

Chartex is a browser extension + dashboard for collecting and visualizing browsing activity. Data is encrypted on the client (Zero Knowledge).

## Quick start

Requirements: Node.js 18+, MongoDB, Chrome (for the extension).

```bash
git clone https://github.com/your-username/chartex.git
cd chartex
npm run install:all
```

Run backend and frontend for development:

```bash
cd backend
npm run dev

cd ../frontend
npm start
```

## Project structure

```
Chartex/
├── backend/     # Node.js + Express + MongoDB
├── frontend/    # Angular SPA
├── extension/   # Chrome extension (built from frontend)
└── docs/        # Documentation
```

## Screenshots gallery (from docs/screenshots)

Below are all screenshots placed in `docs/screenshots/`.

Popup / Extension overview
![screenshot_1](docs/screenshots/screenshot_1.png)
Dashboard (light)
![screenshot_2](docs/screenshots/screenshot_2.png)
Dashboard (dark)
![screenshot_3](docs/screenshots/screenshot_3.png)
Charts & Top sites
![screenshot_4](docs/screenshots/screenshot_4.png)
Heatmap / Time of day
![screenshot_5](docs/screenshots/screenshot_5.png)
Devices card
![screenshot_6](docs/screenshots/screenshot_6.png)
Settings export/import
![screenshot_7](docs/screenshots/screenshot_7.png)
Extension install dialog
![screenshot_8](docs/screenshots/screenshot_8.png)

---

For full documentation see `PRODUCTION_SETUP.md` and `docs/requirements.md`.

- **🔍 Збір історії браузера** - автоматичний збір даних про відвідування сайтів
- **🔐 Zero Knowledge** - повне шифрування даних на клієнті (AES), сервер зберігає лише зашифровані дані
- **📊 Аналітика** - детальні графіки та статистика активності з ApexCharts
- **🎨 Сучасний UI** - Material Design інтерфейс з Angular 19
- **⚡ Швидкість** - оптимізований збір та обробка даних
- **🔧 Налаштування** - гнучкі опції збору та відображення
- **🌐 Багатомовність** - підтримка української та англійської мов
- **📱 Мультиплатформність** - синхронізація між пристроями
- **🔒 Приватність** - GDPR-сумісний, користувач контролює свої дані

## 🏗️ Архітектура

```
Chartex/
├── backend/           # Node.js + Express + MongoDB API
├── frontend/          # Angular 19 SPA для dashboard
├── extension/         # Chrome Extension (Manifest V3)
└── docs/             # Документація
```

### Backend (Node.js)
- **Express.js** - REST API
- **MongoDB** - зберігання зашифрованих даних
- **Firebase Admin** - авторизація та валідація токенів
- **Crypto-JS** - серверна частина шифрування

### Frontend (Angular 19)
- **Angular 19** - SPA framework (standalone компоненти)
- **Angular Material** - UI компоненти
- **ApexCharts** - графіки та діаграми
- **RxJS** - реактивне програмування
- **ngx-translate** - інтернаціоналізація

### Chrome Extension (Manifest V3)
- **Manifest V3** - сучасний extension API
- **Service Worker** - фоновий збір даних
- **Chrome Identity** - OAuth авторизація
- **Storage API** - локальне зберігання
- **History API** - доступ до історії браузера

## 🚀 Швидкий старт

### Вимоги
- **Node.js 18+** - для backend та frontend
- **MongoDB 6+** - для зберігання даних
- **Chrome браузер** - для extension
- **Firebase проект** - для авторизації (вже налаштовано)

### Встановлення

1. **Клонуйте репозиторій**
```bash
git clone https://github.com/your-username/chartex.git
cd chartex
```

2. **Встановіть залежності для всіх частин**
```bash
npm run install:all
```

3. **Налаштуйте Backend**
```bash
cd backend
# Створіть .env файл з налаштуваннями MongoDB
npm run dev  # для розробки
# або
npm start    # для production
```

4. **Запустіть Frontend**
```bash
cd frontend
npm start    # для розробки
# або
npm run build:prod  # для production
```

5. **Встановіть Extension**
```bash
# Спочатку зберіть frontend для extension
cd frontend
npm run build:extension

# Потім встановіть extension
# Відкрийте chrome://extensions/
# Увімкніть "Developer mode"
# Натисніть "Load unpacked" і виберіть папку extension
```

## 📖 Документація

- [🚀 Налаштування production](PRODUCTION_SETUP.md)
- [📋 Вимоги проекту](docs/requirements.md)

## 🎯 Основні функції

### 📊 Dashboard
- **Статистичні картки** - загальна кількість відвідувань, унікальних сайтів, час, пристрої
- **Графік активності** - відвідування по днях з можливістю вибору періоду
- **Топ сайтів** - найпопулярніші сайти з кількістю відвідувань
- **Статистика пристроїв** - розподіл активності по пристроях
- **Теплова карта** - активність по днях тижня
- **Розподіл за категоріями** - автоматична категоризація сайтів
- **Bubble Chart** - візуалізація активності сайтів (час vs кількість відвідувань)
- **Добова активність** - активність по годинах по тижнях

### 🔍 Пошук та фільтрація
- **Пошук по сайтах** - швидкий пошук в історії
- **Розширені фільтри** - фільтрація за категоріями, тривалістю, датами, пристроями
- **Періоди** - 7 днів, 30 днів, 90 днів, 1 рік, весь час

### ⚙️ Налаштування
- **Збір даних** - увімкнення/вимкнення збору
- **Приватність** - налаштування рівня приватності
- **Відображення** - налаштування UI
- **Синхронізація** - синхронізація між пристроями
- **Мова** - українська/англійська
- **Тема** - світла/темна/авто

### 🔐 Безпека та приватність
- **Zero Knowledge** - всі дані шифруються на клієнті
- **AES шифрування** - використання Crypto-JS для шифрування
- **Firebase Auth** - безпечна авторизація через Google
- **GDPR сумісність** - користувач контролює свої дані
- **Локальне зберігання** - ключі шифрування зберігаються локально

## 🛠️ Розробка

### Структура проекту

```
Chartex/
├── backend/                    # Node.js + Express + MongoDB API
│   ├── src/
│   │   ├── models/            # MongoDB моделі (User, Device, HistoryItem)
│   │   ├── routes/            # API маршрути (devices, history, users, globalStats)
│   │   ├── utils/             # Утиліти (auth, crypto)
│   │   └── index.js           # Головний файл сервера
│   ├── package.json
│   └── README.md
├── frontend/                   # Angular 19 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # Angular standalone компоненти
│   │   │   │   ├── dashboard/ # Dashboard з усіма секціями
│   │   │   │   ├── settings/  # Налаштування
│   │   │   │   └── confirm-dialog/ # Діалоги підтвердження
│   │   │   ├── services/      # API сервіси та сервіси додатку
│   │   │   ├── interceptors/  # HTTP інтерцептори
│   │   │   └── utils/         # Утиліти та переклади
│   │   ├── assets/i18n/       # Файли локалізації
│   │   └── environments/      # Конфігурація середовищ
│   ├── angular.json
│   └── package.json
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── dashboard/             # Angular build для extension
│   ├── _locales/             # Локалізація extension
│   ├── background.js         # Service Worker
│   ├── popup.js              # Popup логіка
│   ├── manifest.json         # Extension маніфест
│   ├── config.js             # Конфігурація extension
│   └── firebase-*.js         # Firebase файли
└── docs/                     # Документація
    └── requirements.md       # Вимоги проекту
```

### Команди розробки

```bash
# Кореневі команди
npm run install:all          # Встановити залежності для всіх частин
npm run start:frontend       # Запустити frontend
npm run start:backend        # Запустити backend
npm run build:frontend       # Зібрати frontend

# Backend
cd backend
npm run dev                  # Розробка з nodemon
npm start                    # Production запуск

# Frontend
cd frontend
npm start                    # Dev server (ng serve)
npm run build                # Development build
npm run build:prod           # Production build
npm run build:extension      # Build для extension
npm test                     # Unit тести
npm run lint                 # Лінтер

# Extension
cd frontend
npm run build:extension      # Зібрати frontend для extension
# Потім встановити extension в Chrome
```

## 🔧 Налаштування

### Environment Variables

**Backend (.env)**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chartex
FIREBASE_PROJECT_ID=chartex-2eae7
FIREBASE_PRIVATE_KEY=your-private-key
JWT_SECRET=your-jwt-secret
```

**Frontend (environment.ts)**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  firebase: {
    apiKey: "AIzaSyAeWPZOm7CXCslgyn63ScMBcGK_wg8tUNA",
    authDomain: "chartex-2eae7.firebaseapp.com",
    projectId: "chartex-2eae7",
    storageBucket: "chartex-2eae7.firebasestorage.app",
    messagingSenderId: "264979508048",
    appId: "1:264979508048:web:c9501813cf613160a5da55",
    measurementId: "G-PGGLE2T3TD"
  }
};
```

**Extension (config.js)**
```javascript
const config = {
  api: {
    development: 'http://localhost:5000/api',
    production: 'https://your-production-api-url.com/api'
  },
  firebase: {
    apiKey: "AIzaSyAeWPZOm7CXCslgyn63ScMBcGK_wg8tUNA",
    authDomain: "chartex-2eae7.firebaseapp.com",
    projectId: "chartex-2eae7",
    storageBucket: "chartex-2eae7.firebasestorage.app",
    messagingSenderId: "264979508048",
    appId: "1:264979508048:web:c9501813cf613160a5da55",
    measurementId: "G-PGGLE2T3TD"
  }
};
```

### Firebase налаштування

Проект вже налаштований з Firebase:
- **Project ID**: chartex-2eae7
- **Auth Domain**: chartex-2eae7.firebaseapp.com
- **OAuth Client ID**: 264979508048-soi5cpcu8j46dos38tq6hr314cguqeh5.apps.googleusercontent.com

### MongoDB налаштування

Створіть базу даних `chartex` в MongoDB. Моделі автоматично створять необхідні колекції:
- `users` - користувачі
- `devices` - пристрої
- `historyitems` - записи історії

## 🧪 Тестування

### Backend тести
```bash
cd backend
npm test
```

### Frontend тести
```bash
cd frontend
npm test
npm run lint
```

## 📦 Deployment

### Backend
```bash
cd backend
# Налаштуйте production змінні середовища
npm start
```

### Frontend
```bash
cd frontend
npm run build:prod
# Завантажте файли з dist/chartex-frontend/browser/ на веб-сервер
```

### Extension
```bash
cd frontend
npm run build:extension
# Створіть ZIP архів з папки extension
# Завантажте на Chrome Web Store
```

### Production налаштування
Детальні інструкції дивіться в [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)

## 🤝 Внесок

1. Fork репозиторію
2. Створіть feature branch: `git checkout -b feature/amazing-feature`
3. Commit зміни: `git commit -m 'Add amazing feature'`
4. Push до branch: `git push origin feature-amazing-feature`
5. Відкрийте Pull Request

## 📄 Ліцензія

Цей проект ліцензований під MIT License - дивіться [LICENSE](LICENSE) файл для деталей.

## 🙏 Подяки

- [Angular](https://angular.io/) - SPA framework
- [Angular Material](https://material.angular.io/) - UI компоненти
- [ApexCharts](https://apexcharts.com/) - Графіки та діаграми
- [Firebase](https://firebase.google.com/) - Авторизація та аутентифікація
- [MongoDB](https://www.mongodb.com/) - База даних
- [Crypto-JS](https://cryptojs.gitbook.io/) - Шифрування даних
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/) - Extension функціональність

## 🔒 Безпека та приватність

- **Zero Knowledge Architecture** - всі дані шифруються на клієнті
- **AES-256 шифрування** - використання Crypto-JS для захисту даних
- **Firebase Auth** - безпечна авторизація через Google OAuth
- **GDPR сумісність** - користувач має повний контроль над своїми даними
- **Локальне зберігання ключів** - ключі шифрування ніколи не передаються на сервер

## 📞 Підтримка

Якщо у вас є питання або проблеми:

- 🐛 Issues: [GitHub Issues](https://github.com/your-username/chartex/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/chartex/discussions)

