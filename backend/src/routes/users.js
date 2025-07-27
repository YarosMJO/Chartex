const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Device = require('../models/Device');
const HistoryItem = require('../models/HistoryItem');
const { authenticateToken } = require('../utils/auth');

// Створити або оновити користувача (при першому вході)
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { email, displayName, photoURL } = req.body;
    
    let user = await User.findOne({ firebaseUid: req.user.uid });
    
    if (user) {
      // Оновити існуючого користувача
      user.lastLogin = new Date();
      user.email = email || user.email;
      user.displayName = displayName || user.displayName;
      user.photoURL = photoURL || user.photoURL;
      await user.save();
    } else {
      // Створити нового користувача
      user = new User({
        firebaseUid: req.user.uid,
        email: email || req.user.email,
        displayName: displayName || req.user.name,
        photoURL: photoURL || req.user.picture
      });
      await user.save();
    }
    
    res.json({ success: true, user });
  } catch (err) {
    console.error('Помилка реєстрації користувача:', err);
    res.status(500).json({ error: 'Помилка реєстрації користувача' });
  }
});

// Отримати профіль користувача
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    // Отримати статистику
    const deviceCount = await Device.countDocuments({ userId: req.user.uid, isActive: true });
    const historyCount = await HistoryItem.countDocuments({ userId: req.user.uid });
    
    const profile = {
      ...user.toObject(),
      deviceCount,
      historyCount
    };
    
    res.json(profile);
  } catch (err) {
    console.error('Помилка отримання профілю:', err);
    res.status(500).json({ error: 'Помилка отримання профілю' });
  }
});

// Оновити налаштування користувача
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { dataRetentionDays, allowGlobalAnalytics, language, timezone, theme } = req.body;
    
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    
    // Оновити налаштування
    if (dataRetentionDays !== undefined) user.dataRetentionDays = dataRetentionDays;
    if (allowGlobalAnalytics !== undefined) user.allowGlobalAnalytics = allowGlobalAnalytics;
    if (language !== undefined) user.language = language;
    if (timezone !== undefined) user.timezone = timezone;
    if (theme !== undefined) user.theme = theme;
    
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('Помилка оновлення налаштувань:', err);
    res.status(500).json({ error: 'Помилка оновлення налаштувань' });
  }
});

// Видалити акаунт користувача та всі його дані
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Видалити всі дані користувача
    await Promise.all([
      User.deleteOne({ firebaseUid: userId }),
      Device.deleteMany({ userId }),
      HistoryItem.deleteMany({ userId })
    ]);
    
    res.json({ success: true, message: 'Акаунт та всі дані успішно видалено' });
  } catch (err) {
    console.error('Помилка видалення акаунту:', err);
    res.status(500).json({ error: 'Помилка видалення акаунту' });
  }
});

// Очистити дані користувача (для перезапису, не видалення акаунту)
router.post('/clear-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    console.log(`Очищення даних для користувача ${userId}`);
    
    // Видалити тільки дані історії, залишити користувача та пристрої
    const deletedCount = await HistoryItem.deleteMany({ userId });
    
    console.log(`Видалено ${deletedCount.deletedCount} записів історії для користувача ${userId}`);
    
    res.json({ 
      success: true, 
      message: 'Дані користувача очищено',
      deletedCount: deletedCount.deletedCount
    });
  } catch (err) {
    console.error('Помилка очищення даних користувача:', err);
    res.status(500).json({ error: 'Помилка очищення даних користувача' });
  }
});

// Отримати статистику користувача
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { period = '30d', deviceId } = req.query; // 7d, 30d, 90d, 1y, all
    
    console.log('Запит статистики користувача:', { userId, period, deviceId });
    
    let dateFilter = {};
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      dateFilter.visitTime = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    
    // Додаємо фільтр по пристрою, якщо вказано
    let deviceFilter = {};
    if (deviceId && deviceId !== 'undefined') {
      deviceFilter.deviceId = deviceId;
    }
    
    console.log('Фільтри:', { dateFilter, deviceFilter });
    
    const stats = await HistoryItem.aggregate([
      { $match: { userId, ...dateFilter, ...deviceFilter } },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: 1 },
          uniqueDomains: { $addToSet: '$domainHash' },
          totalDuration: { $sum: '$duration' },
          avgDuration: { $avg: '$duration' }
        }
      },
      {
        $project: {
          _id: 0,
          totalVisits: 1,
          uniqueDomains: { $size: '$uniqueDomains' },
          totalDuration: 1,
          avgDuration: { $round: ['$avgDuration', 2] }
        }
      }
    ]);
    
    console.log('Загальна статистика:', stats[0]);
    
    // Отримати топ доменів з зашифрованими даними для дешифрування
    const topDomains = await HistoryItem.aggregate([
      { $match: { userId, ...dateFilter, ...deviceFilter } },
      {
        $group: {
          _id: '$domainHash',
          visits: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          // Зберігаємо зашифровані дані для дешифрування
          encryptedData: { $last: '$encryptedData' }
        }
      },
      { $sort: { visits: -1 } },
      { $limit: 10 }
    ]);
    
    console.log('Топ доменів:', topDomains.length);
    console.log('Результат статистики:', {
      period,
      deviceId,
      stats: stats[0] || { totalVisits: 0, uniqueDomains: 0, totalDuration: 0, avgDuration: 0 },
      topDomainsCount: topDomains.length
    });
    
    res.json({
      period,
      stats: stats[0] || { totalVisits: 0, uniqueDomains: 0, totalDuration: 0, avgDuration: 0 },
      topDomains
    });
  } catch (err) {
    console.error('Помилка отримання статистики:', err);
    res.status(500).json({ error: 'Помилка отримання статистики' });
  }
});

module.exports = router; 