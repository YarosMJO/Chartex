# Chartex Frontend

Angular SPA для візуалізації історії браузерної активності користувача.

## Розробка

### Звичайна розробка (localhost:4200)
```bash
npm start
```

### Збірка для Chrome Extension
```bash
npm run build:extension
```

Або використайте скрипти:
```cmd
# Batch файл
build-extension.bat

# PowerShell скрипт (рекомендовано)
.\build-extension.ps1
```

> **Примітка для PowerShell**: Якщо виникає помилка "execution policy", виконайте:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

Цей скрипт:
1. Збирає проект з конфігурацією `extension`
2. Автоматично копіює файли в `../extension/dashboard/`

### Конфігурації збірки

- `development` - для розробки з source maps
- `production` - оптимізована збірка для продакшену
- `extension` - оптимізована збірка для Chrome Extension з відключеними інлайн-скриптами

## Особливості для Chrome Extension

### CSP (Content Security Policy)
- Додано CSP мета-тег в `index.html`
- Відключено `inlineCritical` в конфігурації extension
- Всі скрипти завантажуються через `src` атрибути

### Відключення Service Worker
Service worker відключено для Chrome Extension через `main.ts`:
```typescript
if ('serviceWorker' in navigator && environment.production && !window.location.href.includes('chrome-extension://')) {
  // Реєстрація service worker тільки для звичайного веб-додатку
}
```

### Шляхи до ресурсів
Всі шляхи налаштовані для роботи в контексті Chrome Extension.

## Структура проекту

```
src/
├── app/
│   ├── components/
│   │   └── dashboard/          # Компонент дашборду
│   ├── services/
│   │   ├── api.service.ts      # API сервіс
│   │   └── auth.service.ts     # Аутентифікація
│   └── app.component.*         # Головний компонент
├── environments/
│   ├── environment.ts          # Конфігурація розробки
│   └── environment.prod.ts     # Конфігурація продакшену
└── index.html                  # Головний HTML файл
```

## Залежності

- Angular 18
- Angular Material
- ApexCharts для графіків
- CryptoJS для шифрування
- Firebase для аутентифікації 