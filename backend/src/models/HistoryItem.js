const mongoose = require('mongoose');

// Схема для зберігання історії браузера користувача
const HistoryItemSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Firebase UID
  deviceId: { type: String, required: true }, // Ідентифікатор пристрою
  sessionId: { type: String, required: true }, // Ідентифікатор сесії
  
  // Зашифровані приватні дані (AES шифрування на клієнті)
  encryptedData: { type: String, required: true }, // url, title, notes, geoLocation, referrer, userAgent, tags
  
  // Метадані для аналітики (не зашифровані)
  domainHash: { type: String, required: true }, // Хеш домену для анонімної статистики
  visitCount: { type: Number, default: 1 }, // Кількість відвідувань цього URL
  typedCount: { type: Number, default: 0 }, // Кількість разів, коли URL був введений вручну
  duration: { type: Number, default: 0 }, // Час проведений на сторінці (в секундах)
  transitionType: { type: String }, // Тип переходу (typed, link, auto_bookmark, etc.)
  
  // Технічні метадані (необов'язкові для приватності)
  deviceType: { type: String, default: 'unknown' }, // desktop, mobile, tablet
  browser: { type: String, default: 'unknown' }, // Chrome, Firefox, Safari, etc.
  language: { type: String, default: 'uk' },
  screenResolution: { type: String, default: 'unknown' },
  os: { type: String, default: 'unknown' }, // Operating System
  
  // Часові метки
  visitTime: { type: Date, required: true }, // Час відвідування (з Chrome API)
  createdAt: { type: Date, default: Date.now }, // Час збереження в БД
  updatedAt: { type: Date, default: Date.now }, // Час останнього оновлення
  
  // Додаткові поля для аналітики
  isBookmarked: { type: Boolean, default: false },
  isIncognito: { type: Boolean, default: false },
  tabId: { type: Number }, // ID вкладки (якщо доступно)
  windowId: { type: Number }, // ID вікна (якщо доступно)
  
  // Для глобальної аналітики (анонімні дані)
  countryCode: { type: String }, // Код країни (з IP або геолокації)
  timeOfDay: { type: Number }, // Година дня (0-23)
  dayOfWeek: { type: Number }, // День тижня (0-6, де 0 = неділя)
  month: { type: Number }, // Місяць (1-12)
  year: { type: Number } // Рік
});

// Індекси для швидкого пошуку та аналітики
HistoryItemSchema.index({ userId: 1, deviceId: 1 });
HistoryItemSchema.index({ userId: 1, visitTime: -1 });
HistoryItemSchema.index({ userId: 1, domainHash: 1 });
HistoryItemSchema.index({ domainHash: 1, visitTime: -1 }); // Для глобальної аналітики
HistoryItemSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // TTL індекс для автоматичного видалення старих даних

// Middleware для оновлення updatedAt
HistoryItemSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('HistoryItem', HistoryItemSchema); 