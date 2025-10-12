// Middleware для авторизації - підтримує Firebase та Google OAuth токени
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Middleware для перевірки авторизації
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Токен авторизації не надано');
      return res.status(401).json({ error: 'Токен авторизації не надано' });
    }
    
    const token = authHeader.substring(7); // Видалити 'Bearer '
    
    // Спробувати перевірити як Firebase токен
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
        picture: decodedToken.picture,
        provider: 'firebase'
      };
      return next();
    } catch (firebaseError) {
      // Firebase токен недійсний, спробуємо Google OAuth токен
    }
    
    // Якщо Firebase токен не спрацював, спробувати Google OAuth токен
    try {
      const userInfo = await verifyGoogleToken(token);
      req.user = {
        uid: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.name,
        picture: userInfo.picture,
        provider: 'google'
      };
      return next();
    } catch (googleError) {
      console.error('Помилка перевірки токена:', googleError.message);
      return res.status(401).json({ error: 'Недійсний токен авторизації' });
    }
    
  } catch (error) {
    console.error('Помилка авторизації:', error);
    return res.status(500).json({ error: 'Помилка сервера авторизації' });
  }
};

// Функція для перевірки Google OAuth токена
async function verifyGoogleToken(token) {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    
    if (!response.ok) {
      throw new Error('Недійсний Google токен');
    }
    
    const tokenInfo = await response.json();
    
    // Отримати інформацію про користувача
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Не вдалося отримати інформацію про користувача');
    }
    
    const userInfo = await userResponse.json();
    
    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    };
  } catch (error) {
    throw new Error(`Помилка перевірки Google токена: ${error.message}`);
  }
}

// Middleware для опціональної авторизації (для публічних endpoint'ів)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    
    const token = authHeader.substring(7);
    
    // Спробувати Firebase токен
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
        picture: decodedToken.picture,
        provider: 'firebase'
      };
      return next();
    } catch (firebaseError) {
      // Спробувати Google OAuth токен
      try {
        const userInfo = await verifyGoogleToken(token);
        req.user = {
          uid: userInfo.id,
          email: userInfo.email,
          displayName: userInfo.name,
          picture: userInfo.picture,
          provider: 'google'
        };
        return next();
      } catch (googleError) {
        req.user = null;
        return next();
      }
    }
  } catch (error) {
    req.user = null;
    return next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  verifyGoogleToken
}; 