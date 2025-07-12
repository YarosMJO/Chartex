const express = require('express');
const router = express.Router();
const HistoryItem = require('../models/HistoryItem');
const { authenticateToken } = require('../utils/auth');

// Додати новий запис історії
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const {
      deviceId,
      sessionId,
      encryptedData,
      domainHash,
      visitCount,
      typedCount,
      duration,
      transitionType,
      deviceType,
      browser,
      language,
      screenResolution,
      os,
      visitTime,
      isBookmarked,
      isIncognito,
      tabId,
      windowId,
      countryCode,
      timeOfDay,
      dayOfWeek,
      month,
      year
    } = req.body;
    
    const item = new HistoryItem({
      userId: req.user.uid,
      deviceId,
      sessionId,
      encryptedData,
      domainHash,
      visitCount: visitCount || 1,
      typedCount: typedCount || 0,
      duration: duration || 0,
      transitionType,
      deviceType,
      browser,
      language: language || 'uk',
      screenResolution,
      os,
      visitTime: visitTime ? new Date(visitTime) : new Date(),
      isBookmarked: isBookmarked || false,
      isIncognito: isIncognito || false,
      tabId,
      windowId,
      countryCode,
      timeOfDay,
      dayOfWeek,
      month,
      year
    });
    
    await item.save();
    res.json({ success: true, id: item._id });
  } catch (err) {
    console.error('Помилка збереження історії:', err);
    res.status(500).json({ error: 'Помилка збереження історії' });
  }
});

// Додати кілька записів історії (batch)
router.post('/batch', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    
    console.log('Отримано batch запит:', { 
      userId: req.user.uid, 
      itemsCount: items?.length,
      firstItem: items?.[0] 
    });
    
    if (!Array.isArray(items) || items.length === 0) {
      console.error('Невірний формат batch запиту');
      return res.status(400).json({ error: 'Необхідно передати масив записів' });
    }
    
    // Додати userId до кожного запису
    const historyItems = items.map(item => ({
      ...item,
      userId: req.user.uid,
      visitTime: item.visitTime ? new Date(item.visitTime) : new Date()
    }));
    
    console.log('Підготовлені записи для збереження:', historyItems.length);
    
    const result = await HistoryItem.insertMany(historyItems);
    console.log('Успішно збережено записів:', result.length);
    
    res.json({ success: true, count: result.length });
  } catch (err) {
    console.error('Помилка batch збереження історії:', err);
    res.status(500).json({ error: 'Помилка збереження історії' });
  }
});

// Отримати історію з фільтрами
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      deviceId, 
      from, 
      to, 
      search, 
      limit = 100, 
      offset = 0,
      sortBy = 'visitTime',
      sortOrder = 'desc'
    } = req.query;
    
    const query = { userId: req.user.uid };
    
    // Фільтр по пристрою
    if (deviceId) query.deviceId = deviceId;
    
    // Фільтр по даті
    if (from || to) {
      query.visitTime = {};
      if (from) query.visitTime.$gte = new Date(from);
      if (to) query.visitTime.$lte = new Date(to);
    }
    
    // Пошук (по зашифрованих даних - обмежена функціональність)
    if (search) {
      query.encryptedData = { $regex: search, $options: 'i' };
    }
    
    // Сортування
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const items = await HistoryItem.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    // Загальна кількість для пагінації
    const total = await HistoryItem.countDocuments(query);
    
    res.json({
      items,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + items.length < total
      }
    });
  } catch (err) {
    console.error('Помилка отримання історії:', err);
    res.status(500).json({ error: 'Помилка отримання історії' });
  }
});

// Отримати статистику історії
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { deviceId, from, to, groupBy = 'day' } = req.query;
    
    const matchQuery = { userId: req.user.uid };
    if (deviceId) matchQuery.deviceId = deviceId;
    if (from || to) {
      matchQuery.visitTime = {};
      if (from) matchQuery.visitTime.$gte = new Date(from);
      if (to) matchQuery.visitTime.$lte = new Date(to);
    }
    
    let groupQuery = {};
    if (groupBy === 'day') {
      groupQuery = {
        _id: {
          year: { $year: '$visitTime' },
          month: { $month: '$visitTime' },
          day: { $dayOfMonth: '$visitTime' }
        }
      };
    } else if (groupBy === 'hour') {
      groupQuery = {
        _id: {
          year: { $year: '$visitTime' },
          month: { $month: '$visitTime' },
          day: { $dayOfMonth: '$visitTime' },
          hour: { $hour: '$visitTime' }
        }
      };
    } else if (groupBy === 'domain') {
      groupQuery = {
        _id: '$domainHash'
      };
    }
    
    const stats = await HistoryItem.aggregate([
      { $match: matchQuery },
      {
        $group: {
          ...groupQuery,
          visits: { $sum: 1 },
          duration: { $sum: '$duration' },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          _id: 1,
          visits: 1,
          duration: 1,
          uniqueSessions: { $size: '$uniqueSessions' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    res.json(stats);
  } catch (err) {
    console.error('Помилка отримання статистики історії:', err);
    res.status(500).json({ error: 'Помилка отримання статистики історії' });
  }
});

// Видалити записи історії
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { deviceId, from, to, domainHash } = req.query;
    
    const query = { userId: req.user.uid };
    if (deviceId) query.deviceId = deviceId;
    if (domainHash) query.domainHash = domainHash;
    if (from || to) {
      query.visitTime = {};
      if (from) query.visitTime.$gte = new Date(from);
      if (to) query.visitTime.$lte = new Date(to);
    }
    
    const result = await HistoryItem.deleteMany(query);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Помилка видалення історії:', err);
    res.status(500).json({ error: 'Помилка видалення історії' });
  }
});

module.exports = router; 