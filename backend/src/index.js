// Головний файл запуску Express-сервера для Chartex
const path = require('path');
// Завантажуємо .env з кореневої директорії проекту (на рівень вище backend/)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors({
  origin: [
    'http://localhost:80',
    'http://localhost:8080',
    /^chrome-extension:\/\/.*$/
  ],
  credentials: true
}));
app.use(express.json());

// Підключення до MongoDB
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Підключено до MongoDB');
}).catch((err) => {
  console.error('Помилка підключення до MongoDB:', err);
});

// Ініціалізація Firebase Admin SDK
// Використовуємо змінні середовища замість JSON файлу для більшої безпеки
if (process.env.FIREBASE_PRIVATE_KEY) {
  // Ініціалізація з environment variables
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
} else {
  // Fallback: спроба завантажити з JSON файлу (для локальної розробки)
  try {
    const serviceAccount = require('../firebase-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('ПОМИЛКА: Не знайдено Firebase credentials!');
    console.error('Будь ласка, налаштуйте одне з наступного:');
    console.error('1. Додайте змінні середовища: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    console.error('2. Або створіть файл firebase-service-account.json в кореневій директорії');
    console.error('\nДетальні інструкції дивіться в backend/README.md');
    process.exit(1);
  }
}

// Підключення маршрутів
const historyRoutes = require('./routes/history');
const globalStatsRoutes = require('./routes/globalStats');
const usersRoutes = require('./routes/users');
const devicesRoutes = require('./routes/devices');

app.use('/api/history', historyRoutes);
app.use('/api/global-stats', globalStatsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/devices', devicesRoutes);

// Health check endpoint для extension
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chartex backend працює!',
    timestamp: new Date().toISOString()
  });
});

// Проста перевірка роботи API
app.get('/', (req, res) => {
  res.json({
    message: 'Chartex backend працює!',
    version: '1.0.0',
    endpoints: {
      history: '/api/history',
      users: '/api/users',
      devices: '/api/devices',
      globalStats: '/api/global-stats',
      health: '/api/health'
    }
  });
});

// Обробка помилок
app.use((err, req, res, next) => {
  console.error('Помилка сервера:', err);
  res.status(500).json({ error: 'Внутрішня помилка сервера' });
});

// Обробка неіснуючих маршрутів
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Маршрут не знайдено' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
}); 