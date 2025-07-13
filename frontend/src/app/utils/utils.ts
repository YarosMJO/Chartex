// Форматування часу для UI
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}хв`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}год ${minutes}хв`;
};

// Форматування чисел для UI
export const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

// Отримати підпис для періоду
export const getPeriodLabel = (period: string): string => {
  const labels: Record<string, string> = {
    '7d': '7 днів',
    '30d': '30 днів',
    '90d': '90 днів',
    '1y': '1 рік',
    'all': 'Весь час'
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