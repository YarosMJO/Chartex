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
  
  return cleaned.toLowerCase();
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