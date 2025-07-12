const mongoose = require('mongoose');

// Схема пристрою для відстеження різних пристроїв користувача
const DeviceSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Firebase UID
  deviceId: { type: String, required: true }, // Унікальний ідентифікатор пристрою
  deviceName: { type: String, required: true }, // Назва пристрою (наприклад, "Мій ноутбук")
  deviceType: { type: String, required: true }, // desktop, mobile, tablet
  browser: { type: String, required: true }, // Chrome, Firefox, Safari, etc.
  userAgent: { type: String },
  screenResolution: { type: String },
  language: { type: String, default: 'uk' },
  timezone: { type: String, default: 'Europe/Kiev' },
  // Статистика пристрою
  totalVisits: { type: Number, default: 0 },
  lastVisit: { type: Date },
  firstVisit: { type: Date, default: Date.now },
  // Статус
  isActive: { type: Boolean, default: true },
  lastSync: { type: Date, default: Date.now },
  // Геолокація (зашифрована)
  encryptedLocation: { type: String }, // Зашифровані координати
  // Додаткові метадані
  os: { type: String }, // Operating System
  version: { type: String }, // Версія браузера
  extensions: [{ type: String }] // Список встановлених розширень
});

// Складений індекс для унікальності пристрою для користувача
DeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
DeviceSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('Device', DeviceSchema); 