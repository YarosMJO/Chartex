# 📊 Chartex - Browser Analytics Extension

**Chartex** - це Chrome extension для збору та аналізу історії браузерної активності користувача з красивою візуалізацією даних.

## 🌟 Особливості

- **🔍 Збір історії браузера** - автоматичний збір даних про відвідування сайтів
- **🔐 Безпека** - шифрування даних та Google OAuth авторизація
- **📊 Аналітика** - детальні графіки та статистика активності
- **🎨 Сучасний UI** - Material Design інтерфейс з Angular
- **⚡ Швидкість** - оптимізований збір та обробка даних
- **🔧 Налаштування** - гнучкі опції збору та відображення

## 🏗️ Архітектура

```
Chartex/
├── backend/           # Node.js + Express + MongoDB API
├── frontend/          # Angular SPA для dashboard
├── extension/         # Chrome Extension
└── docs/             # Документація
```

### Backend (Node.js)
- **Express.js** - REST API
- **MongoDB** - зберігання даних
- **Firebase Auth** - авторизація
- **JWT** - токени безпеки

### Frontend (Angular)
- **Angular 17** - SPA framework
- **Material Design** - UI компоненти
- **Chart.js** - графіки та діаграми
- **RxJS** - реактивне програмування

### Chrome Extension
- **Manifest V3** - сучасний extension API
- **Service Worker** - фоновий збір даних
- **Chrome Identity** - OAuth авторизація
- **Storage API** - локальне зберігання

## 🚀 Швидкий старт

### Вимоги
- Node.js 18+
- MongoDB 6+
- Chrome браузер
- Firebase проект

### Встановлення

1. **Клонуйте репозиторій**
```bash
git clone https://github.com/your-username/chartex.git
cd chartex
```

2. **Налаштуйте Backend**
```bash
cd backend
npm install
cp .env.example .env
# Відредагуйте .env файл
npm start
```

3. **Налаштуйте Frontend**
```bash
cd frontend
npm install
ng serve
```

4. **Встановіть Extension**
```bash
cd extension
# Відкрийте chrome://extensions/
# Увімкніть "Developer mode"
# Натисніть "Load unpacked" і виберіть папку extension
```

## 📖 Документація

- [📊 Використання Dashboard](extension/DASHBOARD_USAGE.md)
- [🔧 Виправлення помилок](extension/TROUBLESHOOTING.md)
- [🚀 Налаштування production](PRODUCTION_SETUP.md)
- [📋 Вимоги проекту](docs/requirements.md)

## 🛠️ Розробка

### Структура проекту

```
Chartex/
├── backend/
│   ├── src/
│   │   ├── models/          # MongoDB моделі
│   │   ├── routes/          # API маршрути
│   │   ├── utils/           # Утиліти
│   │   └── index.js         # Головний файл
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # Angular компоненти
│   │   │   └── services/    # API сервіси
│   │   └── environments/    # Конфігурація
│   ├── angular.json
│   └── package.json
├── extension/
│   ├── dashboard/           # Angular build
│   ├── background.js        # Service Worker
│   ├── popup.js            # Popup логіка
│   ├── manifest.json       # Extension маніфест
│   └── config.js           # Конфігурація
└── docs/
    └── requirements.md      # Вимоги проекту
```

### Команди розробки

```bash
# Backend
cd backend
npm run dev          # Розробка з nodemon
npm run start        # Production запуск
npm test             # Тести

# Frontend
cd frontend
ng serve             # Dev server
ng build --prod      # Production build
ng test              # Unit тести
ng e2e               # E2E тести

# Extension
cd extension
# Відкрийте chrome://extensions/ і перезавантажте
```

## 🔧 Налаштування

### Environment Variables

**Backend (.env)**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chartex
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
JWT_SECRET=your-jwt-secret
```

**Frontend (environment.ts)**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  firebase: {
    apiKey: 'your-api-key',
    projectId: 'your-project-id'
  }
};
```

**Extension (config.js)**
```javascript
const config = {
  api: {
    development: 'http://localhost:5000/api',
    production: 'https://your-api.com/api'
  },
  firebase: {
    apiKey: 'your-api-key',
    projectId: 'your-project-id'
  }
};
```

## 🧪 Тестування

### Backend тести
```bash
cd backend
npm test
npm run test:coverage
```

### Frontend тести
```bash
cd frontend
ng test
ng e2e
```

## 📦 Deployment

### Backend (Heroku)
```bash
cd backend
heroku create chartex-api
heroku config:set NODE_ENV=production
git push heroku main
```

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

### Extension (Chrome Web Store)
1. Збудуйте extension: `npm run build:extension`
2. Створіть ZIP архів
3. Завантажте на Chrome Web Store

## 🤝 Внесок

1. Fork репозиторію
2. Створіть feature branch: `git checkout -b feature/amazing-feature`
3. Commit зміни: `git commit -m 'Add amazing feature'`
4. Push до branch: `git push origin feature/amazing-feature`
5. Відкрийте Pull Request

## 📄 Ліцензія

Цей проект ліцензований під MIT License - дивіться [LICENSE](LICENSE) файл для деталей.

## 👥 Автори

- **Ваше ім'я** - *Початкова робота* - [GitHub](https://github.com/your-username)

## 🙏 Подяки

- [Angular](https://angular.io/) - SPA framework
- [Material Design](https://material.io/) - UI компоненти
- [Chart.js](https://www.chartjs.org/) - Графіки
- [Firebase](https://firebase.google.com/) - Авторизація
- [MongoDB](https://www.mongodb.com/) - База даних

## 📞 Підтримка

Якщо у вас є питання або проблеми:

- 📧 Email: your-email@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/chartex/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/your-username/chartex/discussions)

---

⭐ Якщо проект вам сподобався, поставте зірочку на GitHub! 