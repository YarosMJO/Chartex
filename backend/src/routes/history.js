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
    
    console.log('🔍 BACKEND DURATION DEBUG: Received batch request:', { 
      userId: req.user.uid, 
      itemsCount: items?.length,
      firstItem: items?.[0],
      durations: items?.slice(0, 5).map((item, index) => ({
        index,
        duration: item.duration,
        durationHours: Math.round((item.duration || 0) / 3600 * 100) / 100,
        url: item.encryptedData ? '[encrypted]' : 'no-data'
      }))
    });
    
    if (!Array.isArray(items) || items.length === 0) {
      console.error('Невірний формат batch запиту');
      return res.status(400).json({ error: 'Необхідно передати масив записів' });
    }
    
    // Додати userId до кожного запису та валідувати duration
    const historyItems = items.map(item => {
      let duration = item.duration || 0;
      
      // Захист від неправильних значень duration
      if (duration > 3600) {
        console.log('🔍 BACKEND DURATION FIX: Capping duration from', duration, 'to 3600 seconds');
        duration = 3600; // Максимум 1 година
      }
      
      // Якщо duration в мілісекундах (більше 1000), конвертуємо
      if (duration > 1000 && duration < 1000000) {
        const originalDuration = duration;
        duration = Math.round(duration / 1000);
        console.log('🔍 BACKEND DURATION FIX: Converted from ms:', {
          original: originalDuration,
          converted: duration
        });
      }
      
      return {
        ...item,
        userId: req.user.uid,
        duration: duration,
        visitTime: item.visitTime ? new Date(item.visitTime) : new Date()
      };
    });
    
    console.log('Підготовлені записи для збереження:', historyItems.length);
    
    const result = await HistoryItem.insertMany(historyItems);
    console.log('Успішно збережено записів:', result.length);
    
    res.json({ success: true, count: result.length });
  } catch (err) {
    console.error('Помилка batch збереження історії:', err);
    res.status(500).json({ error: 'Помилка збереження історії' });
  }
});

// Очистити всі дані історії для поточного користувача
router.delete('/clear-all', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 CLEAR DEBUG: Clearing all history for user:', req.user.uid);
    
    const result = await HistoryItem.deleteMany({ userId: req.user.uid });
    
    console.log('🔍 CLEAR DEBUG: Deleted records:', result.deletedCount);
    
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `Видалено ${result.deletedCount} записів історії`
    });
  } catch (err) {
    console.error('Помилка очищення історії:', err);
    res.status(500).json({ error: 'Помилка очищення історії' });
  }
});

// Діагностика даних duration
router.get('/duration-analysis', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 DURATION ANALYSIS: Starting analysis for user:', req.user.uid);
    
    // Загальна статистика duration
    const durationStats = await HistoryItem.aggregate([
      { $match: { userId: req.user.uid } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          minDuration: { $min: '$duration' },
          maxDuration: { $max: '$duration' },
          avgDuration: { $avg: '$duration' },
          totalDuration: { $sum: '$duration' }
        }
      }
    ]);
    
    // Записи з duration > 3600 (більше 1 години)
    const invalidRecords = await HistoryItem.find({ 
      userId: req.user.uid,
      duration: { $gt: 3600 }
    }).limit(10);
    
    // Записи з дуже великими duration (можливо мілісекунди)
    const suspiciousRecords = await HistoryItem.find({ 
      userId: req.user.uid,
      duration: { $gt: 100000 }
    }).limit(10);
    
    // Розподіл по діапазонах
    const durationRanges = await HistoryItem.aggregate([
      { $match: { userId: req.user.uid } },
      {
        $bucket: {
          groupBy: '$duration',
          boundaries: [0, 60, 300, 1800, 3600, 36000, 360000, Infinity],
          default: 'unknown',
          output: {
            count: { $sum: 1 },
            totalDuration: { $sum: '$duration' }
          }
        }
      }
    ]);
    
    console.log('🔍 DURATION ANALYSIS: Results:', {
      durationStats: durationStats[0],
      invalidCount: invalidRecords.length,
      suspiciousCount: suspiciousRecords.length,
      ranges: durationRanges
    });
    
    res.json({
      success: true,
      analysis: {
        stats: durationStats[0] || {},
        invalidRecords: invalidRecords.map(r => ({
          id: r._id,
          duration: r.duration,
          durationHours: Math.round(r.duration / 3600 * 100) / 100,
          visitTime: r.visitTime
        })),
        suspiciousRecords: suspiciousRecords.map(r => ({
          id: r._id,
          duration: r.duration,
          durationHours: Math.round(r.duration / 3600 * 100) / 100,
          visitTime: r.visitTime
        })),
        durationRanges
      }
    });
  } catch (err) {
    console.error('Помилка аналізу duration:', err);
    res.status(500).json({ error: 'Помилка аналізу duration' });
  }
});

// Виправити неправильні значення duration в існуючих даних
router.post('/fix-durations', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 DURATION FIX: Starting duration fix for user:', req.user.uid);
    
    // Спочатку виправляємо мілісекунди (duration > 100000, але < 10000000)
    const millisecondsRecords = await HistoryItem.find({ 
      userId: req.user.uid,
      duration: { $gt: 100000, $lt: 10000000 }
    });
    
    console.log('🔍 DURATION FIX: Found milliseconds records:', millisecondsRecords.length);
    
    let msFixedCount = 0;
    for (const record of millisecondsRecords) {
      const newDuration = Math.round(record.duration / 1000);
      // Обмежуємо 1 годиною
      const finalDuration = Math.min(newDuration, 3600);
      
      await HistoryItem.updateOne(
        { _id: record._id },
        { duration: finalDuration }
      );
      
      msFixedCount++;
      console.log('🔍 DURATION FIX: Fixed milliseconds record:', {
        id: record._id,
        oldDuration: record.duration,
        newDuration: finalDuration
      });
    }
    
    // Потім виправляємо дуже великі значення (> 3600 секунд)
    const invalidRecords = await HistoryItem.find({ 
      userId: req.user.uid,
      duration: { $gt: 3600 }
    });
    
    console.log('🔍 DURATION FIX: Found invalid records after ms fix:', invalidRecords.length);
    
    let cappedCount = 0;
    for (const record of invalidRecords) {
      let newDuration = record.duration;
      
      // Якщо все ще дуже велике значення, це може бути дуже довга сесія
      // Обмежуємо 1 годиною як максимальний реалістичний час на одній сторінці
      if (newDuration > 3600) {
        newDuration = 3600;
      }
      
      await HistoryItem.updateOne(
        { _id: record._id },
        { duration: newDuration }
      );
      
      cappedCount++;
      console.log('🔍 DURATION FIX: Capped record:', {
        id: record._id,
        oldDuration: record.duration,
        newDuration: newDuration
      });
    }
    
    // Виправляємо від'ємні значення
    const negativeRecords = await HistoryItem.find({ 
      userId: req.user.uid,
      duration: { $lt: 0 }
    });
    
    console.log('🔍 DURATION FIX: Found negative records:', negativeRecords.length);
    
    let negativeFixedCount = 0;
    for (const record of negativeRecords) {
      await HistoryItem.updateOne(
        { _id: record._id },
        { duration: 0 }
      );
      negativeFixedCount++;
    }
    
    const totalFixedCount = msFixedCount + cappedCount + negativeFixedCount;
    
    console.log('🔍 DURATION FIX: Summary:', {
      millisecondsFixed: msFixedCount,
      cappedFixed: cappedCount,
      negativeFixed: negativeFixedCount,
      totalFixed: totalFixedCount
    });
    
    res.json({ 
      success: true, 
      fixedCount: totalFixedCount,
      details: {
        millisecondsFixed: msFixedCount,
        cappedFixed: cappedCount,
        negativeFixed: negativeFixedCount
      },
      message: `Виправлено ${totalFixedCount} записів з неправильним duration`
    });
  } catch (err) {
    console.error('Помилка виправлення duration:', err);
    res.status(500).json({ error: 'Помилка виправлення duration' });
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