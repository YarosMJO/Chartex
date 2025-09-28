# 🐳 Docker Setup для Chartex

Цей документ описує, як розгорнути Chartex проект за допомогою Docker на будь-якому пристрої.

## 📋 Передумови

- Docker Desktop або Docker Engine
- Docker Compose
- Git (для клонування репозиторію)

## 🚀 Швидкий старт

### 1. Клонування репозиторію
```bash
git clone <your-repository-url>
cd Chartex
```

### 2. Налаштування змінних середовища
```bash
# Скопіюйте приклад конфігурації
cp env.example .env

# Відредагуйте .env файл згідно з вашими налаштуваннями
nano .env
```

### 3. Запуск всіх сервісів
```bash
# Запуск всіх контейнерів
docker-compose up -d

# Перегляд логів
docker-compose logs -f
```

### 4. Доступ до додатку
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:5000/api
- **MongoDB**: localhost:27017
- **Nginx Proxy**: http://localhost:8080

## 🔧 Детальна конфігурація

### Структура Docker сервісів

```
chartex/
├── backend/           # Node.js API сервер
├── frontend/          # Angular SPA з Nginx
├── mongodb/           # MongoDB база даних
└── nginx-proxy/       # Reverse proxy (опціонально)
```

### Портові налаштування

| Сервіс | Порт | Опис |
|--------|------|------|
| Frontend | 80 | Angular додаток |
| Backend | 5000 | API сервер |
| MongoDB | 27017 | База даних |
| Nginx Proxy | 8080 | Об'єднаний доступ |

### Змінні середовища

Основні змінні в `.env` файлі:

```bash
# MongoDB
MONGODB_URI=mongodb://admin:password123@mongodb:27017/chartex?authSource=admin
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password123

# Backend
NODE_ENV=production
PORT=5000

# Security
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_encryption_key_here
```

## 🛠️ Команди управління

### Основні команди
```bash
# Запуск всіх сервісів
docker-compose up -d

# Зупинка всіх сервісів
docker-compose down

# Перезапуск сервісів
docker-compose restart

# Перегляд статусу
docker-compose ps

# Перегляд логів
docker-compose logs -f [service_name]
```

### Робота з окремими сервісами
```bash
# Запуск тільки backend
docker-compose up -d backend mongodb

# Перебудова frontend
docker-compose build frontend
docker-compose up -d frontend

# Очищення volumes
docker-compose down -v
```

### Оновлення коду
```bash
# Перебудова та перезапуск
docker-compose build
docker-compose up -d

# Тільки frontend (після змін в Angular)
docker-compose build frontend
docker-compose up -d frontend
```

## 🔍 Діагностика та налагодження

### Перевірка статусу сервісів
```bash
# Статус всіх контейнерів
docker-compose ps

# Детальна інформація
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb
```

### Доступ до контейнерів
```bash
# Backend контейнер
docker-compose exec backend sh

# MongoDB контейнер
docker-compose exec mongodb mongosh

# Frontend контейнер
docker-compose exec frontend sh
```

### Перевірка мережі
```bash
# Список мереж
docker network ls

# Деталі мережі
docker network inspect chartex_chartex-network
```

## 🚀 Розгортання на production

### 1. Налаштування production змінних
```bash
# Оновіть .env для production
NODE_ENV=production
MONGODB_URI=mongodb://your-production-mongodb
API_URL=https://your-domain.com/api
FRONTEND_URL=https://your-domain.com
```

### 2. Безпека
```bash
# Змініть паролі за замовчуванням
MONGO_INITDB_ROOT_PASSWORD=strong_password_here
JWT_SECRET=very_strong_jwt_secret
ENCRYPTION_KEY=very_strong_encryption_key
```

### 3. SSL/TLS (рекомендовано)
Додайте SSL сертифікати та налаштуйте HTTPS в nginx конфігурації.

### 4. Моніторинг
```bash
# Перегляд ресурсів
docker stats

# Логи з ротацією
docker-compose logs --tail=100 -f
```

## 🐛 Вирішення проблем

### Проблема: Контейнери не запускаються
```bash
# Перевірте логи
docker-compose logs

# Перевірте конфігурацію
docker-compose config

# Очистіть та перезапустіть
docker-compose down -v
docker-compose up -d
```

### Проблема: MongoDB не підключається
```bash
# Перевірте статус MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Перевірте змінні середовища
docker-compose exec backend env | grep MONGO
```

### Проблема: Frontend не завантажується
```bash
# Перевірте збірку
docker-compose build frontend

# Перевірте nginx конфігурацію
docker-compose exec frontend nginx -t
```

## 📝 Додаткові налаштування

### Backup бази даних
```bash
# Створення backup
docker-compose exec mongodb mongodump --out /backup

# Відновлення з backup
docker-compose exec mongodb mongorestore /backup
```

### Масштабування
```bash
# Запуск кількох backend інстансів
docker-compose up -d --scale backend=3
```

## 🔗 Корисні посилання

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Docker Image](https://hub.docker.com/_/mongo)
- [Nginx Docker Image](https://hub.docker.com/_/nginx)

## 📞 Підтримка

Якщо виникають проблеми:
1. Перевірте логи: `docker-compose logs`
2. Перевірте статус: `docker-compose ps`
3. Перезапустіть сервіси: `docker-compose restart`
4. Створіть issue в репозиторії проекту
