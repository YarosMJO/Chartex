# 🚀 Перше налаштування Chartex

Цей файл містить інструкції для першого запуску проекту Chartex після клонування з GitHub.

## 📋 Передумови

### Обов'язкові
- **Node.js 18+** - [Завантажити](https://nodejs.org/)
- **Git** - [Завантажити](https://git-scm.com/)
- **Chrome браузер** - для extension
- **MongoDB 6+** - [Завантажити](https://www.mongodb.com/try/download/community)

### Опціональні
- **Angular CLI** - `npm install -g @angular/cli`
- **MongoDB Compass** - GUI для MongoDB

## 🔧 Швидкий старт

### 1. Клонування репозиторію

```bash
# Клонуйте репозиторій
git clone https://github.com/YarosMJO/chartex.git
cd chartex

# Перевірте структуру
ls -la
```

### 2. Налаштування Backend

```bash
# Перейдіть в папку backend
cd backend

# Встановіть залежності
npm install

# Створіть .env файл
cp .env.example .env

# Відредагуйте .env файл
notepad .env  # або використайте ваш редактор
```

**Приклад .env файлу:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chartex
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
JWT_SECRET=your-super-secret-jwt-key
NODE_ENV=development
```

### 3. Налаштування Frontend

```bash
# Перейдіть в папку frontend
cd ../frontend

# Встановіть залежності
npm install

# Відредагуйте environment.ts
notepad src/environments/environment.ts
```

**Приклад environment.ts:**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  firebase: {
    apiKey: 'your-api-key',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: '123456789',
    appId: 'your-app-id',
    measurementId: 'your-measurement-id'
  }
};
```

### 4. Налаштування Extension

```bash
# Перейдіть в папку extension
cd ../extension

# Відредагуйте config.js
notepad config.js
```

**Приклад config.js:**
```javascript
const config = {
  api: {
    development: 'http://localhost:5000/api',
    production: 'https://your-production-api.com/api'
  },
  firebase: {
    apiKey: 'your-api-key',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: '123456789',
    appId: 'your-app-id',
    measurementId: 'your-measurement-id'
  }
};
```

## 🔥 Firebase налаштування

### 1. Створення Firebase проекту

1. Перейдіть на [Firebase Console](https://console.firebase.google.com/)
2. Натисніть **"Create a project"**
3. Введіть назву проекту: `chartex`
4. Увімкніть Google Analytics (опціонально)
5. Створіть проект

### 2. Налаштування Authentication

1. В **Authentication** → **Sign-in method**
2. Увімкніть **Google** провайдер
3. Додайте ваш email як тестовий користувач

### 3. Отримання конфігурації

1. В **Project settings** → **General**
2. Прокрутіть до **"Your apps"**
3. Натисніть **"Add app"** → **Web**
4. Скопіюйте конфігурацію

### 4. Service Account

1. В **Project settings** → **Service accounts**
2. Натисніть **"Generate new private key"**
3. Збережіть JSON файл як `firebase-service-account.json`
4. Додайте в `.env` файл backend

## 🗄️ MongoDB налаштування

### 1. Встановлення MongoDB

**Windows:**
1. Завантажте MongoDB Community Server
2. Встановіть з налаштуваннями за замовчуванням
3. MongoDB буде доступна на `mongodb://localhost:27017`

**macOS:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### 2. Створення бази даних

```bash
# Підключіться до MongoDB
mongosh

# Створіть базу даних
use chartex

# Створіть користувача (опціонально)
db.createUser({
  user: "chartex_user",
  pwd: "your_password",
  roles: ["readWrite"]
})

# Вийдіть
exit
```

## 🚀 Запуск проекту

### 1. Запуск Backend

```bash
cd backend
npm start
```

Backend буде доступний на `http://localhost:5000`

### 2. Запуск Frontend

```bash
cd frontend
ng serve
```

Frontend буде доступний на `http://localhost:4200`

### 3. Встановлення Extension

1. Відкрийте Chrome
2. Перейдіть до `chrome://extensions/`
3. Увімкніть **"Developer mode"**
4. Натисніть **"Load unpacked"**
5. Виберіть папку `extension`

## 🧪 Тестування

### 1. Тест Backend

```bash
cd backend
npm test
```

### 2. Тест Frontend

```bash
cd frontend
ng test
```

### 3. Тест Extension

1. Відкрийте `chrome-extension://[ID]/test-config.html`
2. Перевірте всі тести
3. Перегляньте консоль на помилки

### 4. Тест повної системи

1. Запустіть backend та frontend
2. Встановіть extension
3. Увійдіть через Google
4. Запустіть збір даних
5. Перевірте dashboard

## 🔧 Розв'язання проблем

### Помилка "MongoDB connection failed"
- Перевірте, чи запущений MongoDB
- Перевірте URI в `.env` файлі
- Перевірте мережеві налаштування

### Помилка "Firebase not initialized"
- Перевірте конфігурацію Firebase
- Перевірте API ключі
- Перевірте домени в Firebase Console

### Extension не завантажується
- Перевірте manifest.json
- Перевірте всі файли в extension папці
- Перезавантажте extension

### CORS помилки
- Перевірте налаштування CORS в backend
- Перевірте URL в конфігурації
- Перевірте домени в Firebase

## 📞 Підтримка

Якщо у вас виникли проблеми:

1. Перевірте [TROUBLESHOOTING.md](extension/TROUBLESHOOTING.md)
2. Створіть issue на GitHub
3. Перевірте логи в консолі браузера
4. Перевірте логи сервера

## 🎯 Наступні кроки

Після успішного налаштування:

1. **Налаштуйте production середовище**
2. **Додайте тести**
3. **Налаштуйте CI/CD**
4. **Додайте документацію**
5. **Просувайте проект**

---

🎉 Вітаємо! Chartex успішно налаштовано! 