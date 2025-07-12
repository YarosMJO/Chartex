# Chartex Backend

Node.js + Express API для системи аналітики браузерної історії Chartex.

## Технології

- **Node.js** - серверна платформа
- **Express** - веб-фреймворк
- **MongoDB** - база даних
- **Mongoose** - ODM для MongoDB
- **Firebase Admin SDK** - аутентифікація
- **Crypto-js** - шифрування даних

## Функціональність

### API Endpoints

#### Користувачі (`/api/users`)
- `POST /register` - реєстрація/оновлення користувача
- `GET /profile` - отримання профілю
- `PUT /settings` - оновлення налаштувань
- `DELETE /account` - видалення акаунту
- `GET /stats` - статистика користувача

#### Пристрої (`/api/devices`)
- `POST /register` - реєстрація пристрою
- `GET /` - список пристроїв
- `PUT /:deviceId/name` - оновлення назви пристрою
- `PUT /:deviceId/deactivate` - деактивація пристрою
- `DELETE /:deviceId` - видалення пристрою
- `GET /:deviceId/stats` - статистика пристрою

#### Історія (`/api/history`)
- `POST /add` - додати запис історії
- `POST /batch` - додати кілька записів
- `GET /` - отримати історію з фільтрами
- `GET /stats` - статистика історії
- `DELETE /` - видалити записи

#### Глобальна статистика (`/api/global-stats`)
- `GET /` - анонімна статистика

## Встановлення

1. **Клонувати репозиторій**
   ```bash
   git clone <repository-url>
   cd chartex/backend
   ```

2. **Встановити залежності**
   ```bash
   npm install
   ```

3. **Налаштувати змінні середовища**
   ```bash
   cp env.example .env
   ```
   
   Відредагувати `.env` файл:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/chartex
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_CLIENT_EMAIL=your-firebase-client-email@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Firebase Private Key Here\n-----END PRIVATE KEY-----\n"
   JWT_SECRET=your-jwt-secret-key
   ENCRYPTION_KEY=your-encryption-key-32-bytes
   CORS_ORIGIN=http://localhost:4200
   LOG_LEVEL=info
   ```

4. **Запустити MongoDB**
   ```bash
   # Локально
   mongod
   
   # Або використовувати MongoDB Atlas
   ```

5. **Запустити сервер**
   ```bash
   # Development режим
   npm run dev
   
   # Production режим
   npm start
   ```

## Структура проекту

```
backend/
├── src/
│   ├── models/
│   │   ├── HistoryItem.js    # Модель запису історії
│   │   ├── User.js           # Модель користувача
│   │   └── Device.js         # Модель пристрою
│   ├── routes/
│   │   ├── history.js        # Маршрути історії
│   │   ├── users.js          # Маршрути користувачів
│   │   ├── devices.js        # Маршрути пристроїв
│   │   └── globalStats.js    # Глобальна статистика
│   ├── utils/
│   │   └── crypto.js         # Утиліти шифрування
│   └── index.js              # Головний файл
├── package.json
├── env.example
└── README.md
```

## Моделі даних

### HistoryItem
- `userId` - Firebase UID користувача
- `deviceId` - ідентифікатор пристрою
- `sessionId` - ідентифікатор сесії
- `encryptedData` - зашифровані приватні дані
- `domainHash` - хеш домену для анонімної статистики
- `visitCount`, `typedCount`, `duration` - метрики
- `deviceType`, `browser`, `os` - технічні метадані
- `visitTime`, `createdAt`, `updatedAt` - часові метки

### User
- `firebaseUid` - Firebase UID
- `email`, `displayName`, `photoURL` - профіль
- `dataRetentionDays`, `allowGlobalAnalytics` - налаштування приватності
- `language`, `timezone`, `theme` - налаштування інтерфейсу
- `totalDevices`, `totalHistoryItems` - статистика

### Device
- `userId` - Firebase UID користувача
- `deviceId` - унікальний ідентифікатор пристрою
- `deviceName`, `deviceType` - інформація про пристрій
- `browser`, `userAgent`, `os` - технічні характеристики
- `totalVisits`, `lastVisit`, `firstVisit` - статистика
- `isActive`, `lastSync` - статус

## Безпека

### Zero-Knowledge Шифрування
- Всі приватні дані шифруються на клієнті (AES-256-GCM)
- Сервер зберігає лише зашифровані дані
- Ключ шифрування знаходиться лише у користувача

### Аутентифікація
- Firebase Auth для аутентифікації користувачів
- JWT токени для API авторизації
- Middleware для перевірки токенів

### GDPR Compliance
- Користувач може видалити всі свої дані
- Анонімна глобальна статистика
- Налаштування збереження даних

## API Документація

### Аутентифікація
Всі захищені endpoints потребують заголовок:
```
Authorization: Bearer <firebase-id-token>
```

### Приклади запитів

#### Реєстрація користувача
```bash
curl -X POST http://localhost:5000/api/users/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "displayName": "John Doe"
  }'
```

#### Додавання запису історії
```bash
curl -X POST http://localhost:5000/api/history/add \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device123",
    "sessionId": "session456",
    "encryptedData": "encrypted-data-here",
    "domainHash": "domain-hash",
    "visitCount": 1,
    "duration": 300,
    "deviceType": "desktop",
    "browser": "Chrome"
  }'
```

#### Отримання статистики
```bash
curl -X GET "http://localhost:5000/api/users/stats?period=30d" \
  -H "Authorization: Bearer <token>"
```

## Розробка

### Логування
Використовується вбудований логер Node.js з рівнями:
- `error` - помилки
- `warn` - попередження
- `info` - інформація
- `debug` - детальна інформація

### Тестування
```bash
# Запустити тести
npm test

# Запустити тести з покриттям
npm run test:coverage
```

### Лінтер
```bash
# Перевірити код
npm run lint

# Виправити помилки
npm run lint:fix
```

## Розгортання

### Docker
```bash
# Збірка образу
docker build -t chartex-backend .

# Запуск контейнера
docker run -p 5000:5000 chartex-backend
```

### Heroku
```bash
# Налаштування змінних середовища
heroku config:set MONGODB_URI=your-mongodb-uri
heroku config:set FIREBASE_PROJECT_ID=your-project-id
# ... інші змінні

# Розгортання
git push heroku main
```

## Підтримка

Для питань та підтримки звертайтеся до:
- Issues на GitHub
- Email: support@chartex.com
- Документація: https://docs.chartex.com 