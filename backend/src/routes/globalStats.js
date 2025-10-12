const express = require('express');
const router = express.Router();
const HistoryItem = require('../models/HistoryItem');

// Кореневий маршрут для глобальної статистики
router.get('/', async (req, res) => {
  try {
    const totalVisits = await HistoryItem.aggregate([
      { $group: { _id: null, total: { $sum: '$visitCount' } } }
    ]);
    
    const uniqueDomains = await HistoryItem.distinct('domainHash').length;
    
    const topDomains = await HistoryItem.aggregate([
      { $group: { _id: '$domainHash', count: { $sum: '$visitCount' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      totalVisits: totalVisits[0]?.total || 0,
      uniqueDomains: uniqueDomains,
      topDomains: topDomains,
      message: 'Глобальна статистика Chartex'
    });
  } catch (err) {
    console.error('Помилка отримання глобальної статистики:', err);
    res.status(500).json({ error: 'Помилка отримання глобальної статистики' });
  }
});

// Отримати топ-домени за кількістю відвідувань (глобальна аналітика)
router.get('/top-domains', async (req, res) => {
  try {
    const stats = await HistoryItem.aggregate([
      { $group: { _id: '$domainHash', count: { $sum: '$visitCount' } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Помилка отримання глобальної статистики' });
  }
});

module.exports = router; 