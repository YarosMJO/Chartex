// Головний файл запуску Express-сервера для Chartex
require('dotenv').config();
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
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Підключено до MongoDB');
}).catch((err) => {
  console.error('Помилка підключення до MongoDB:', err);
});

// Ініціалізація Firebase Admin SDK
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Підключення маршрутів
const historyRoutes = require('./routes/history');
const globalStatsRoutes = require('./routes/globalStats');
const usersRoutes = require('./routes/users');
const devicesRoutes = require('./routes/devices');

app.use('/api/history', historyRoutes);
app.use('/api/global-stats', globalStatsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/devices', devicesRoutes);

// Проста перевірка роботи API
app.get('/', (req, res) => {
  res.json({
    message: 'Chartex backend працює!',
    version: '1.0.0',
    endpoints: {
      history: '/api/history',
      users: '/api/users',
      devices: '/api/devices',
      globalStats: '/api/global-stats'
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