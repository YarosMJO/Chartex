// MongoDB initialization script for Chartex
db = db.getSiblingDB('chartex');

// Створення користувача для додатку
db.createUser({
  user: 'chartex_user',
  pwd: 'chartex_password',
  roles: [
    {
      role: 'readWrite',
      db: 'chartex'
    }
  ]
});

// Створення колекцій
db.createCollection('users');
db.createCollection('devices');
db.createCollection('historyitems');
db.createCollection('globalstats');

// Створення індексів для оптимізації
db.users.createIndex({ "uid": 1 }, { unique: true });
db.devices.createIndex({ "userId": 1 });
db.historyitems.createIndex({ "userId": 1, "timestamp": -1 });
db.historyitems.createIndex({ "url": 1 });
db.globalstats.createIndex({ "date": 1 }, { unique: true });

print('MongoDB initialization completed for Chartex');
