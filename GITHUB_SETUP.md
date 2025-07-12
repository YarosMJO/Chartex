# 🚀 Завантаження Chartex на GitHub

Цей файл містить покрокові інструкції для завантаження проекту Chartex на GitHub.

## 📋 Передумови

- GitHub акаунт
- Git встановлений локально
- Доступ до командного рядка

## 🔧 Підготовка проекту

### 1. Ініціалізація Git репозиторію

```bash
# Перейдіть в кореневу папку проекту
cd /path/to/Chartex

# Ініціалізуйте Git репозиторій
git init

# Додайте всі файли
git add .

# Створіть перший commit
git commit -m "Initial commit: Chartex browser analytics extension"
```

### 2. Перевірте .gitignore

Переконайтеся, що `.gitignore` файл правильно налаштований і не включає:
- `node_modules/`
- `.env` файли
- `firebase-service-account.json`
- Логи та тимчасові файли

### 3. Перевірте конфігурацію

Оновіть наступні файли з вашими даними:

**README.md**
```markdown
git clone https://github.com/YarosMJO/chartex.git
```

**CONTRIBUTING.md**
```markdown
https://github.com/YarosMJO/chartex/issues
```

## 🌐 Створення GitHub репозиторію

### 1. Створіть новий репозиторій

1. Перейдіть на [GitHub](https://github.com)
2. Натисніть **"New repository"**
3. Заповніть форму:
   - **Repository name**: `chartex`
   - **Description**: `Chrome extension for browser analytics and data visualization`
   - **Visibility**: Public (рекомендовано) або Private
   - **Initialize with**: НЕ відмічайте жодного пункту
4. Натисніть **"Create repository"**

### 2. Підключіть локальний репозиторій

```bash
# Додайте remote origin
git remote add origin https://github.com/YarosMJO/chartex.git

# Перевірте remote
git remote -v

# Push до GitHub
git branch -M main
git push -u origin main
```

## 📁 Структура репозиторію

Після завантаження ваш репозиторій повинен мати таку структуру:

```
chartex/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── src/
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   ├── angular.json
│   └── package.json
├── extension/
│   ├── dashboard/
│   ├── background.js
│   ├── popup.js
│   ├── manifest.json
│   └── config.js
├── docs/
│   └── requirements.md
├── .gitignore
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── PRODUCTION_SETUP.md
└── GITHUB_SETUP.md
```

## ⚙️ Налаштування GitHub

### 1. Опис репозиторію

Додайте опис та теги в налаштуваннях репозиторію:
- **Topics**: `chrome-extension`, `analytics`, `angular`, `nodejs`, `mongodb`, `firebase`
- **Website**: URL вашого live demo (якщо є)

### 2. Налаштування Issues

1. Перейдіть в **Settings** → **Features**
2. Увімкніть **Issues**
3. Увімкніть **Discussions** (опціонально)
4. Увімкніть **Wiki** (опціонально)

### 3. Налаштування GitHub Pages (опціонально)

```bash
# Створіть gh-pages branch
git checkout -b gh-pages

# Додайте index.html
echo "<h1>Chartex Documentation</h1>" > index.html

# Push branch
git add index.html
git commit -m "Add GitHub Pages"
git push origin gh-pages
```

Потім в налаштуваннях репозиторію:
- **Settings** → **Pages**
- **Source**: Deploy from a branch
- **Branch**: gh-pages

## 🔐 Налаштування Secrets (для CI/CD)

Якщо ви плануєте використовувати GitHub Actions:

1. Перейдіть в **Settings** → **Secrets and variables** → **Actions**
2. Додайте наступні secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `FIREBASE_SERVICE_ACCOUNT` (якщо потрібно)

## 📝 Перший Release

### 1. Створіть тег

```bash
# Створіть тег для версії
git tag -a v1.0.0 -m "Initial release"

# Push тег
git push origin v1.0.0
```

### 2. Створіть Release

1. Перейдіть в **Releases**
2. Натисніть **"Create a new release"**
3. Виберіть тег `v1.0.0`
4. Заповніть:
   - **Title**: `Chartex v1.0.0 - Initial Release`
   - **Description**: Опис функцій та змін
5. Натисніть **"Publish release"**

## 🎯 Наступні кроки

### 1. Оновлення документації

- Перевірте всі посилання в README.md
- Оновіть інструкції встановлення
- Додайте скріншоти (якщо потрібно)

### 2. Налаштування спільноти

- Створіть шаблони для Issues та Pull Requests
- Налаштуйте CODE_OF_CONDUCT.md (опціонально)
- Додайте CONTRIBUTING.md

### 3. Просування

- Поділіться в соціальних мережах
- Додайте в списки Chrome extensions
- Напишіть статтю в блозі

## 🔧 Корисні команди

```bash
# Перевірка статусу
git status

# Перегляд історії
git log --oneline

# Створення нової гілки
git checkout -b feature/new-feature

# Оновлення з GitHub
git pull origin main

# Push змін
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

## 📞 Підтримка

Якщо у вас виникли проблеми:

1. Перевірте [GitHub Help](https://help.github.com/)
2. Створіть issue в репозиторії
3. Зверніться до спільноти

---

🎉 Вітаємо! Ваш проект Chartex тепер на GitHub! 