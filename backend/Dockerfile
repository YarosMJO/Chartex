# Backend Dockerfile для Chartex
FROM node:18-alpine

# Встановлення робочої директорії
WORKDIR /app

# Копіювання package.json
COPY package.json ./

# Встановлення залежностей
RUN npm install --omit=dev

# Копіювання вихідного коду
COPY . .

# Створення користувача для безпеки
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Зміна власника файлів
RUN chown -R nodejs:nodejs /app
USER nodejs

# Відкриття порту
EXPOSE 5000

# Команда запуску
CMD ["npm", "start"]
