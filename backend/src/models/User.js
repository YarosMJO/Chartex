const mongoose = require('mongoose');

// Схема користувача для зберігання налаштувань та метаданих
const UserSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true }, // Firebase UID
  email: { type: String, required: true },
  displayName: { type: String },
  photoURL: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  // Налаштування приватності
  dataRetentionDays: { type: Number, default: 365 }, // Скільки днів зберігати дані
  allowGlobalAnalytics: { type: Boolean, default: true }, // Дозволити анонімну статистику
  // Налаштування інтерфейсу
  language: { type: String, default: 'uk' },
  timezone: { type: String, default: 'Europe/Kiev' },
  theme: { type: String, default: 'light' }, // light/dark
  // Статистика
  totalDevices: { type: Number, default: 0 },
  totalHistoryItems: { type: Number, default: 0 },
  lastDataSync: { type: Date }
});

// Індекси для швидкого пошуку
UserSchema.index({ firebaseUid: 1 });
UserSchema.index({ email: 1 });

module.exports = mongoose.model('User', UserSchema); 