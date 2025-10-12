const crypto = require('crypto');

// Утиліти для шифрування та хешування даних

/**
 * Генерує випадковий ключ для AES шифрування
 * @param {number} length - Довжина ключа в байтах (за замовчуванням 32)
 * @returns {string} - Base64 закодований ключ
 */
function generateAESKey(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * Генерує випадковий IV (Initialization Vector) для AES
 * @returns {string} - Base64 закодований IV
 */
function generateIV() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Шифрує дані за допомогою AES-256-GCM
 * @param {string} data - Дані для шифрування
 * @param {string} key - Base64 закодований ключ
 * @param {string} iv - Base64 закодований IV
 * @returns {string} - Зашифровані дані у форматі: iv:authTag:encryptedData
 */
function encryptAES(data, key, iv) {
  try {
    const keyBuffer = Buffer.from(key, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    cipher.setAAD(Buffer.from('chartex', 'utf8')); // Додаткові автентифіковані дані
    
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Формат: iv:authTag:encryptedData
    return `${iv}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    throw new Error('Помилка шифрування даних');
  }
}

/**
 * Розшифровує дані за допомогою AES-256-GCM
 * @param {string} encryptedData - Зашифровані дані у форматі: iv:authTag:encryptedData
 * @param {string} key - Base64 закодований ключ
 * @returns {string} - Розшифровані дані
 */
function decryptAES(encryptedData, key) {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Невірний формат зашифрованих даних');
    }
    
    const [iv, authTag, data] = parts;
    const keyBuffer = Buffer.from(key, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    decipher.setAAD(Buffer.from('chartex', 'utf8'));
    decipher.setAuthTag(authTagBuffer);
    
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Помилка розшифрування даних');
  }
}

/**
 * Генерує хеш домену для анонімної статистики
 * @param {string} url - URL для хешування
 * @param {string} salt - Сіль для хешування (опціонально)
 * @returns {string} - SHA-256 хеш домену
 */
function hashDomain(url, salt = 'chartex') {
  try {
    const domain = new URL(url).hostname;
    const hash = crypto.createHash('sha256');
    hash.update(domain + salt);
    return hash.digest('hex');
  } catch (error) {
    // Повернути хеш від URL якщо не вдалося розпарсити
    const hash = crypto.createHash('sha256');
    hash.update(url + salt);
    return hash.digest('hex');
  }
}

/**
 * Генерує хеш для ідентифікації пристрою
 * @param {string} userAgent - User Agent рядок
 * @param {string} screenResolution - Роздільність екрану
 * @param {string} timezone - Часовий пояс
 * @returns {string} - SHA-256 хеш пристрою
 */
function hashDevice(userAgent, screenResolution, timezone) {
  const hash = crypto.createHash('sha256');
  const deviceString = `${userAgent}|${screenResolution}|${timezone}`;
  hash.update(deviceString);
  return hash.digest('hex');
}

/**
 * Генерує унікальний ідентифікатор сесії
 * @returns {string} - Унікальний ID сесії
 */
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Генерує унікальний ідентифікатор пристрою
 * @returns {string} - Унікальний ID пристрою
 */
function generateDeviceId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Перевіряє валідність AES ключа
 * @param {string} key - Base64 закодований ключ
 * @returns {boolean} - true якщо ключ валідний
 */
function isValidAESKey(key) {
  try {
    const keyBuffer = Buffer.from(key, 'base64');
    return keyBuffer.length === 32; // AES-256 потребує 32 байти
  } catch {
    return false;
  }
}

module.exports = {
  generateAESKey,
  generateIV,
  encryptAES,
  decryptAES,
  hashDomain,
  hashDevice,
  generateSessionId,
  generateDeviceId,
  isValidAESKey
}; 