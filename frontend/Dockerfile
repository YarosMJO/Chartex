# Multi-stage build для Angular frontend
FROM node:18-alpine AS build

# Встановлення робочої директорії
WORKDIR /app

# Копіювання package.json
COPY package.json ./

# Встановлення залежностей
RUN npm install

# Копіювання вихідного коду
COPY . .

# Збірка Angular додатку для production
RUN npm run build:prod

# Production stage з Nginx
FROM nginx:alpine

# Копіювання збілдженого додатку
COPY --from=build /app/dist/chartex-frontend/browser /usr/share/nginx/html

# Копіювання конфігурації Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Відкриття порту
EXPOSE 80

# Команда запуску
CMD ["nginx", "-g", "daemon off;"]
