import { TranslateService } from '@ngx-translate/core';

// Форматування часу для UI
export const formatDuration = (seconds: number, translateService?: TranslateService): string => {
  const getTranslation = (key: string): string => {
    if (translateService) {
      return translateService.instant(key);
    }
    // Fallback translations
    const fallbacks: Record<string, string> = {
      'UTILS.SECONDS': 'с',
      'UTILS.MINUTES': 'хв',
      'UTILS.HOURS': 'год'
    };
    return fallbacks[key] || key;
  };

  if (seconds < 60) return `${seconds}${getTranslation('UTILS.SECONDS')}`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}${getTranslation('UTILS.MINUTES')}`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}${getTranslation('UTILS.HOURS')} ${minutes}${getTranslation('UTILS.MINUTES')}`;
};

// Форматування чисел для UI
export const formatNumber = (num: number, translateService?: TranslateService): string => {
  const getTranslation = (key: string): string => {
    if (translateService) {
      return translateService.instant(key);
    }
    // Fallback translations
    const fallbacks: Record<string, string> = {
      'UTILS.THOUSANDS': 'тис.',
      'UTILS.MILLIONS': 'млн'
    };
    return fallbacks[key] || key;
  };

  if (num >= 1000000) return (num / 1000000).toFixed(1) + getTranslation('UTILS.MILLIONS');
  if (num >= 1000) return (num / 1000).toFixed(1) + getTranslation('UTILS.THOUSANDS');
  return num.toString();
};

// Отримати підпис для періоду
export const getPeriodLabel = (period: string, translateService?: TranslateService): string => {
  const getTranslation = (key: string): string => {
    if (translateService) {
      return translateService.instant(key);
    }
    // Fallback translations
    const fallbacks: Record<string, string> = {
      'UTILS.PERIODS.7D': '7 днів',
      'UTILS.PERIODS.30D': '30 днів',
      'UTILS.PERIODS.90D': '90 днів',
      'UTILS.PERIODS.1Y': '1 рік',
      'UTILS.PERIODS.ALL': 'Весь час'
    };
    return fallbacks[key] || key;
  };

  const labels: Record<string, string> = {
    '7d': getTranslation('UTILS.PERIODS.7D'),
    '30d': getTranslation('UTILS.PERIODS.30D'),
    '90d': getTranslation('UTILS.PERIODS.90D'),
    '1y': getTranslation('UTILS.PERIODS.1Y'),
    'all': getTranslation('UTILS.PERIODS.ALL')
  };
  return labels[period] || period;
};

// Отримати домен з URL
export const getDomainFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

// Очистити назву домену від зайвих частин
export const cleanDomainName = (domain: string): string => {
  if (!domain) return domain;
  
  // Видаляємо протокол якщо є
  let cleaned = domain.replace(/^https?:\/\//, '');
  
  // Видаляємо www та інші поширені префікси
  cleaned = cleaned.replace(/^www\./, '');
  cleaned = cleaned.replace(/^m\./, ''); // мобільна версія
  cleaned = cleaned.replace(/^mobile\./, ''); // мобільна версія
  cleaned = cleaned.replace(/^app\./, ''); // додаток
  cleaned = cleaned.replace(/^api\./, ''); // API
  cleaned = cleaned.replace(/^cdn\./, ''); // CDN
  cleaned = cleaned.replace(/^static\./, ''); // статичні файли
  cleaned = cleaned.replace(/^blog\./, ''); // блог
  cleaned = cleaned.replace(/^shop\./, ''); // магазин
  cleaned = cleaned.replace(/^store\./, ''); // магазин
  cleaned = cleaned.replace(/^support\./, ''); // підтримка
  cleaned = cleaned.replace(/^help\./, ''); // допомога
  cleaned = cleaned.replace(/^docs\./, ''); // документація
  cleaned = cleaned.replace(/^dev\./, ''); // розробка
  cleaned = cleaned.replace(/^staging\./, ''); // тестування
  cleaned = cleaned.replace(/^test\./, ''); // тестування
  cleaned = cleaned.replace(/^beta\./, ''); // бета версія
  cleaned = cleaned.replace(/^alpha\./, ''); // альфа версія
  
  // Видаляємо порт якщо є
  cleaned = cleaned.replace(/:\d+$/, '');
  
  // Видаляємо шлях та параметри
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  
  // Видаляємо доменні закінчення (.com, .org, .net тощо)
  const tlds = [
    '.com', '.org', '.net', '.edu', '.gov', '.mil', '.int',
    '.co.uk', '.com.ua', '.ua', '.ru', '.de', '.fr', '.it', '.es', '.pl',
    '.io', '.ai', '.me', '.tv', '.cc', '.ly', '.be', '.sh', '.so',
    '.app', '.dev', '.tech', '.info', '.biz', '.name', '.pro',
    '.eu', '.us', '.ca', '.au', '.jp', '.cn', '.in', '.br',
    '.ms', '.gs', '.tk', '.ml', '.ga', '.cf', '.mcas'
  ];
  
  // Сортуємо за довжиною (спочатку довші, щоб .co.uk працювало правильно)
  const sortedTlds = tlds.sort((a, b) => b.length - a.length);
  
  let result = cleaned.toLowerCase();
  
  // Розбиваємо домен на частини по крапках
  let parts = result.split('.');
  
  // Видаляємо доменні закінчення з кінця та з середини
  for (let i = parts.length - 1; i >= 0; i--) {
    const partWithDot = '.' + parts[i];
    if (tlds.includes(partWithDot)) {
      parts.splice(i, 1);
    }
  }
  
  // Також перевіряємо складні домени типу .co.uk
  for (let i = parts.length - 2; i >= 0; i--) {
    if (i + 1 < parts.length) {
      const combinedTld = '.' + parts[i] + '.' + parts[i + 1];
      if (tlds.includes(combinedTld)) {
        parts.splice(i, 2);
        break;
      }
    }
  }
  
  // Збираємо всі залишені значущі частини назад через крапку
  result = parts.length > 0 ? parts.join('.') : cleaned;
  
  return result;
};

// Категорізація сайтів
export const categorizeWebsite = (domain: string): string => {
  const cleanDomain = cleanDomainName(domain);
  
  // Функція для перевірки відповідності очищеного домену
  const matchesDomain = (targetDomain: string): boolean => {
    const cleanTarget = cleanDomainName(targetDomain);
    return cleanDomain === cleanTarget || cleanDomain.includes(cleanTarget) || cleanTarget.includes(cleanDomain);
  };
  
  // Пошукові системи - виключаємо з аналітики
  const searchEngines = [
    'google.com', 'google.co.uk', 'google.de', 'google.fr', 'google.it', 'google.es', 'google.ca', 'google.com.au',
    'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com', 'searchencrypt.com',
    'startpage.com', 'qwant.com', 'ecosia.org', 'brave.com', 'swisscows.com'
  ];
  
  // Якщо це пошукова система - не категорізуємо
  if (searchEngines.some(d => matchesDomain(d))) {
    return 'search_engine';
  }
  
  // Соцмережі
  const socialDomains = [
    'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 
    'linkedin.com', 'youtube.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
    'reddit.com', 'discord.com', 'telegram.org', 'whatsapp.com', 'vk.com',
    'ok.ru', 't.me', 'twitch.tv', 'spotify.com', 'soundcloud.com'
  ];
  
  // Новини
  const newsDomains = [
    'bbc.com', 'cnn.com', 'reuters.com', 'nytimes.com', 'washingtonpost.com',
    'theguardian.com', 'independent.co.uk', 'telegraph.co.uk', 'forbes.com',
    'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'time.com',
    'news.yahoo.com', 'msn.com', 'abcnews.go.com', 'nbcnews.com', 'cbsnews.com',
    'foxnews.com', 'huffpost.com', 'buzzfeed.com', 'vox.com', 'theverge.com',
    'techcrunch.com', 'wired.com', 'ars-technica.com', 'engadget.com'
  ];
  
  // Робота
  const workDomains = [
    'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
    'jira.com', 'confluence.com', 'trello.com', 'asana.com', 'notion.so',
    'slack.com', 'teams.microsoft.com', 'zoom.us', 'webex.com',
    'dropbox.com', 'onedrive.live.com', 'box.com', 'evernote.com',
    'figma.com', 'sketch.com', 'invisionapp.com', 'zeplin.io', 'abstract.com',
    'linear.app', 'clickup.com', 'monday.com', 'basecamp.com', 'airtable.com'
  ];
  
  // Освіта
  const educationDomains = [
    'coursera.org', 'edx.org', 'udemy.com', 'khanacademy.org', 'udacity.com',
    'skillshare.com', 'pluralsight.com', 'lynda.com', 'linkedin-learning.com',
    'codecademy.com', 'freecodecamp.org', 'w3schools.com', 'mdn-web-docs.com',
    'stackoverflow.com', 'github.com', 'gitlab.com', 'bitbucket.org',
    'medium.com', 'dev.to', 'hashnode.dev', 'css-tricks.com', 'smashingmagazine.com',
    'sitepoint.com', 'tutsplus.com', 'envato.com', 'creativebloq.com'
  ];
  
  // Розваги
  const entertainmentDomains = [
    'netflix.com', 'hulu.com', 'disneyplus.com', 'amazon.com', 'primevideo.com',
    'youtube.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv', 'mixer.com',
    'spotify.com', 'apple.com', 'music.apple.com', 'soundcloud.com', 'bandcamp.com',
    'deezer.com', 'tidal.com', 'pandora.com', 'last.fm', 'rateyourmusic.com',
    'imdb.com', 'rottentomatoes.com', 'metacritic.com', 'letterboxd.com',
    'goodreads.com', 'amazon.com', 'barnesandnoble.com', 'bookdepository.com'
  ];
  
  // Покупки
  const shoppingDomains = [
    'amazon.com', 'ebay.com', 'etsy.com', 'shopify.com', 'woocommerce.com',
    'walmart.com', 'target.com', 'bestbuy.com', 'homedepot.com', 'lowes.com',
    'costco.com', 'samsclub.com', 'kroger.com', 'safeway.com', 'publix.com',
    'alibaba.com', 'aliexpress.com', 'wish.com', 'temu.com', 'shein.com',
    'zara.com', 'h&m.com', 'uniqlo.com', 'gap.com', 'oldnavy.com',
    'nike.com', 'adidas.com', 'underarmour.com', 'puma.com', 'reebok.com'
  ];
  
  // Технології
  const technologyDomains = [
    'apple.com', 'microsoft.com', 'amazon.com', 'meta.com',
    'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'github.com',
    'stackoverflow.com', 'reddit.com', 'hackernews.com', 'producthunt.com',
    'techcrunch.com', 'wired.com', 'theverge.com', 'ars-technica.com',
    'engadget.com', 'gizmodo.com', 'mashable.com', 'readwrite.com',
    'venturebeat.com', 'recode.net', 'techdirt.com', 'slashdot.org',
    'digg.com', 'stumbleupon.com', 'delicious.com', 'pinterest.com'
  ];
  
  if (socialDomains.some(d => matchesDomain(d))) return 'social';
  if (newsDomains.some(d => matchesDomain(d))) return 'news';
  if (workDomains.some(d => matchesDomain(d))) return 'work';
  if (educationDomains.some(d => matchesDomain(d))) return 'education';
  if (entertainmentDomains.some(d => matchesDomain(d))) return 'entertainment';
  if (shoppingDomains.some(d => matchesDomain(d))) return 'shopping';
  if (technologyDomains.some(d => matchesDomain(d))) return 'technology';
  
  return 'other';
};

// Локалізація типу пристрою
export const getDeviceTypeLabel = (deviceType: string, translateService?: TranslateService): string => {
  const getTranslation = (key: string): string => {
    if (translateService) {
      return translateService.instant(key);
    }
    // Fallback translations
    const fallbacks: Record<string, string> = {
      'DEVICE_TYPES.DESKTOP': 'Настільний комп\'ютер',
      'DEVICE_TYPES.MOBILE': 'Мобільний пристрій',
      'DEVICE_TYPES.TABLET': 'Планшет'
    };
    return fallbacks[key] || deviceType;
  };

  switch (deviceType?.toLowerCase()) {
    case 'desktop':
      return getTranslation('DEVICE_TYPES.DESKTOP');
    case 'mobile':
      return getTranslation('DEVICE_TYPES.MOBILE');
    case 'tablet':
      return getTranslation('DEVICE_TYPES.TABLET');
    default:
      return deviceType || 'Unknown';
  }
}; 