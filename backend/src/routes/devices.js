const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const HistoryItem = require('../models/HistoryItem');
const { authenticateToken } = require('../utils/auth');

// Зареєструвати новий пристрій
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const {
      deviceId,
      deviceName,
      deviceType,
      browser,
      userAgent,
      screenResolution,
      language,
      timezone,
      os,
      version,
      extensions
    } = req.body;
    
    // Перевірити, чи існує вже пристрій
    let device = await Device.findOne({ userId: req.user.uid, deviceId });
    
    if (device) {
      // Оновити існуючий пристрій
      device.lastSync = new Date();
      device.deviceName = deviceName || device.deviceName;
      device.browser = browser || device.browser;
      device.userAgent = userAgent || device.userAgent;
      device.screenResolution = screenResolution || device.screenResolution;
      device.language = language || device.language;
      device.timezone = timezone || device.timezone;
      device.os = os || device.os;
      device.version = version || device.version;
      device.extensions = extensions || device.extensions;
      device.isActive = true;
    } else {
      // Створити новий пристрій
      device = new Device({
        userId: req.user.uid,
        deviceId,
        deviceName: deviceName || `Пристрій ${deviceType}`,
        deviceType,
        browser,
        userAgent,
        screenResolution,
        language: language || 'uk',
        timezone: timezone || 'Europe/Kiev',
        os,
        version,
        extensions: extensions || []
      });
    }
    
    await device.save();
    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ error: 'Помилка реєстрації пристрою' });
  }
});

// Отримати список пристроїв користувача
router.get('/', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user.uid, isActive: true })
      .sort({ lastSync: -1 });
    
    // Додати статистику для кожного пристрою
    const devicesWithStats = await Promise.all(
      devices.map(async (device) => {
        const stats = await HistoryItem.aggregate([
          { $match: { userId: req.user.uid, deviceId: device.deviceId } },
          {
            $group: {
              _id: null,
              totalVisits: { $sum: 1 },
              totalDuration: { $sum: '$duration' },
              lastVisit: { $max: '$visitTime' }
            }
          }
        ]);
        
        return {
          ...device.toObject(),
          stats: stats[0] || { totalVisits: 0, totalDuration: 0, lastVisit: null }
        };
      })
    );
    
    res.json(devicesWithStats);
  } catch (err) {
    res.status(500).json({ error: 'Помилка отримання пристроїв' });
  }
});

// Оновити назву пристрою
router.put('/:deviceId/name', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { deviceName } = req.body;
    
    const device = await Device.findOneAndUpdate(
      { userId: req.user.uid, deviceId },
      { deviceName },
      { new: true }
    );
    
    if (!device) {
      return res.status(404).json({ error: 'Пристрій не знайдено' });
    }
    
    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ error: 'Помилка оновлення назви пристрою' });
  }
});

// Деактивувати пристрій
router.put('/:deviceId/deactivate', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOneAndUpdate(
      { userId: req.user.uid, deviceId },
      { isActive: false },
      { new: true }
    );
    
    if (!device) {
      return res.status(404).json({ error: 'Пристрій не знайдено' });
    }
    
    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ error: 'Помилка деактивації пристрою' });
  }
});

// Видалити пристрій та всі його дані
router.delete('/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Видалити пристрій та всі його записи історії
    await Promise.all([
      Device.deleteOne({ userId: req.user.uid, deviceId }),
      HistoryItem.deleteMany({ userId: req.user.uid, deviceId })
    ]);
    
    res.json({ success: true, message: 'Пристрій та всі його дані успішно видалено' });
  } catch (err) {
    res.status(500).json({ error: 'Помилка видалення пристрою' });
  }
});

// Отримати статистику пристрою
router.get('/:deviceId/stats', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = '30d' } = req.query;
    
    let dateFilter = {};
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      dateFilter.visitTime = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    
    const stats = await HistoryItem.aggregate([
      { $match: { userId: req.user.uid, deviceId, ...dateFilter } },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: 1 },
          uniqueDomains: { $addToSet: '$domainHash' },
          totalDuration: { $sum: '$duration' },
          avgDuration: { $avg: '$duration' },
          firstVisit: { $min: '$visitTime' },
          lastVisit: { $max: '$visitTime' }
        }
      },
      {
        $project: {
          _id: 0,
          totalVisits: 1,
          uniqueDomains: { $size: '$uniqueDomains' },
          totalDuration: 1,
          avgDuration: { $round: ['$avgDuration', 2] },
          firstVisit: 1,
          lastVisit: 1
        }
      }
    ]);
    
    // Отримати активність по днях
    const dailyActivity = await HistoryItem.aggregate([
      { $match: { userId: req.user.uid, deviceId, ...dateFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$visitTime' },
            month: { $month: '$visitTime' },
            day: { $dayOfMonth: '$visitTime' }
          },
          visits: { $sum: 1 },
          duration: { $sum: '$duration' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    res.json({
      period,
      stats: stats[0] || { totalVisits: 0, uniqueDomains: 0, totalDuration: 0, avgDuration: 0 },
      dailyActivity
    });
  } catch (err) {
    res.status(500).json({ error: 'Помилка отримання статистики пристрою' });
  }
});

module.exports = router; 