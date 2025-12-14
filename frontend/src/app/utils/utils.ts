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

  // Normalize helper: prepare a cleaned set from a list of domains
  const buildCleanSet = (arr: string[]) => new Set(arr.map(d => cleanDomainName(d)));

  const domainInList = (cleaned: string, list: string[]) => {
    const set = buildCleanSet(list);
    if (set.has(cleaned)) return true;
    // Check if cleaned domain ends with any of the targets (handles subdomains and variants)
    for (const t of set) {
      if (!t) continue;
      if (cleaned === t) return true;
      if (cleaned.endsWith('.' + t)) return true;
      if (t.endsWith('.' + cleaned)) return true;
    }
    return false;
  };
  
  // Пошукові системи - виключаємо з аналітики
  const searchEngines = [
    'google.com', 'google.co.uk', 'google.de', 'google.fr', 'google.it', 'google.es', 'google.ca', 'google.com.au',
    'google.com.ua', 'google.pl', 'google.ru', 'google.jp', 'google.co.in', 'google.com.br', 'google.com.mx',
    'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.com', 'yandex.ua', 'searchencrypt.com',
    'startpage.com', 'qwant.com', 'ecosia.org', 'brave.com', 'swisscows.com', 'ask.com', 'excite.com',
    'aol.com', 'lycos.com', 'webcrawler.com'
  ];
  
  // Якщо це пошукова система - не категорізуємо
  if (domainInList(cleanDomain, searchEngines)) {
    return 'search_engine';
  }
  
  // Соцмережі
  const socialDomains = [
    'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 
    'linkedin.com', 'youtube.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
    'reddit.com', 'discord.com', 'telegram.org', 'whatsapp.com', 'vk.com',
    'ok.ru', 't.me', 'twitch.tv', 'spotify.com', 'soundcloud.com',
    'viber.com', 'wechat.com', 'line.me', 'qq.com', 'weibo.com',
    'mixi.jp', 'orkut.com', 'myspace.com', 'flickr.com', 'tumblr.com',
    'meetup.com', 'nextdoor.com', 'houseparty.com', 'clubhouse.com'
  ];
  
  // Новини
  const newsDomains = [
    'bbc.com', 'cnn.com', 'reuters.com', 'nytimes.com', 'washingtonpost.com',
    'theguardian.com', 'independent.co.uk', 'telegraph.co.uk', 'forbes.com',
    'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com', 'time.com',
    'news.yahoo.com', 'msn.com', 'abcnews.go.com', 'nbcnews.com', 'cbsnews.com',
    'foxnews.com', 'huffpost.com', 'buzzfeed.com', 'vox.com', 'theverge.com',
    'techcrunch.com', 'wired.com', 'ars-technica.com', 'engadget.com',
    // Українські новини
    'ukraine.ua', 'unian.ua', 'liga.net', 'pravda.com.ua', 'pravda.ua',
    'censor.net', 'novynarnia.com', 'tsn.ua', '24tv.ua', 'espreso.tv',
    'hromadske.ua', 'ukrinform.ua', 'zn.ua', 'dzerkalo.tyzhnia.ua', 'texty.org.ua',
    'lb.ua', 'gazeta.ua', 'unn.com.ua', 'korespondent.net', 'pravda.if.ua',
    'vechirniy.kyiv.ua', 'radiosvoboda.org', 'suspilne.media', 'nv.ua',
    'dw.com', 'eurointegration.com.ua',
    // Регіональні українські ЗМІ
    '032.ua', '048.ua', '056.ua', '061.ua', '062.ua',
    // Міжнародні новини
    'ap.org', 'afp.com', 'aljazeera.com', 'euronews.com', 'france24.com',
    'deutschland.de', 'spiegel.de', 'lemonde.fr', 'corriere.it', 'elpais.com',
    'rt.com', 'tass.ru', 'xinhuanet.com', 'scmp.com', 'asahi.com'
  ];
  
  // Робота
  const workDomains = [
    'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
    'jira.com', 'confluence.com', 'trello.com', 'asana.com', 'notion.so',
    'slack.com', 'teams.microsoft.com', 'zoom.us', 'webex.com',
    'dropbox.com', 'onedrive.live.com', 'outlook.live.com', 'mail.live.com',
    'outlook.office.com', 'office.com', 'office365.com', 'microsoft.com',
    'box.com', 'evernote.com', 'onenote.com',
    'login.microsoftonline.com', 'gmail.google', 'people.zoho.me',
    'figma.com', 'sketch.com', 'invisionapp.com', 'zeplin.io', 'abstract.com',
    'linear.app', 'clickup.com', 'monday.com', 'basecamp.com', 'airtable.com',
    // Українські платформи для роботи
    'work.ua', 'robota.ua', 'rabota.ua', 'jobs.ua', 'dou.ua',
    'djinni.co', 'grc.ua', 'trud.ua',
    // Додаткові міжнародні інструменти
    'atlassian.com', 'miro.com', 'mural.co', 'whiteboard.microsoft.com',
    'obsidian.md', 'roamresearch.com', 'logseq.com', 'remnote.com',
    'todoist.com', 'any.do', 'rememberthemilk.com', 'habitica.com',
    'clockify.me', 'toggl.com', 'harvest.com', 'rescuetime.com',
    '1password.com', 'lastpass.com', 'dashlane.com', 'bitwarden.com'
  ];
  
  // Освіта
  const educationDomains = [
    'coursera.org', 'edx.org', 'udemy.com', 'khanacademy.org', 'udacity.com',
    'skillshare.com', 'pluralsight.com', 'lynda.com', 'linkedin-learning.com',
    'codecademy.com', 'freecodecamp.org', 'w3schools.com', 'mdn-web-docs.com',
    'stackoverflow.com', 'github.com', 'gitlab.com', 'bitbucket.org',
    'medium.com', 'dev.to', 'hashnode.dev', 'css-tricks.com', 'smashingmagazine.com',
    'sitepoint.com', 'tutsplus.com', 'envato.com', 'creativebloq.com',
    // Українські освітні платформи
    'prometheus.org.ua', 'ed-era.com', 'kursova.ua', 'osvita.ua',
    'vyshemu.com', 'mon.gov.ua', 'nau.ua', 'osvitaonline.com.ua',
    // Українські університети
    'knu.ua', 'nuwm.edu.ua', 'kpi.ua', 'univ.kiev.ua', 'lnu.edu.ua',
    'kneu.edu.ua', 'nuos.pro', 'kmu.edu.ua', 'sumdu.edu.ua',
    // Додаткові міжнародні освітні ресурси
    'brilliant.org', 'datacamp.com', 'treehouse.com',
    'teamtreehouse.com', 'sololearn.com', 'codewars.com', 'leetcode.com',
    'hackerrank.com', 'exercism.io', 'codepen.io', 'jsfiddle.net',
    'scrimba.com', 'egghead.io', 'frontendmasters.com', 'educative.io',
    'alison.com', 'futurelearn.com', 'openlearning.com', 'iversity.org'
  ];
  
  // Розваги
  const entertainmentDomains = [
    'netflix.com', 'hulu.com', 'disneyplus.com', 'amazon.com', 'primevideo.com',
    'youtube.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv', 'mixer.com',
    'spotify.com', 'apple.com', 'music.apple.com', 'soundcloud.com', 'bandcamp.com',
    'deezer.com', 'tidal.com', 'pandora.com', 'last.fm', 'rateyourmusic.com',
    'imdb.com', 'rottentomatoes.com', 'metacritic.com', 'letterboxd.com',
    'goodreads.com', 'barnesandnoble.com', 'bookdepository.com',
    // Українські стрімінгові сервіси
    'megogo.net', 'sweet.tv', 'oll.tv', 'tv.ua', '1plus1.ua',
    // Українські медіа-ресурси
    'music.ua', 'ua.radio', 'radio.com.ua',
    // Додаткові міжнародні розважальні сайти
    'hbo.com', 'hbomax.com', 'paramountplus.com', 'peacocktv.com',
    'crunchyroll.com', 'funimation.com', 'anime-planet.com',
    'myanimelist.net', 'trakt.tv', 'tvtime.com', 'justwatch.com',
    'commonsensemedia.org',
    'audible.com', 'scribd.com', 'libbyapp.com', 'overdrive.com',
    'archive.org', 'gutenberg.org', 'projectgutenberg.org',
    'chess.com', 'lichess.org', 'pokerstars.com', 'pokercode.com'
  ];
  
  // Покупки
  const shoppingDomains = [
    'amazon.com', 'ebay.com', 'etsy.com', 'shopify.com', 'woocommerce.com',
    'walmart.com', 'target.com', 'bestbuy.com', 'homedepot.com', 'lowes.com',
    'costco.com', 'samsclub.com', 'kroger.com', 'safeway.com', 'publix.com',
    'alibaba.com', 'aliexpress.com', 'wish.com', 'temu.com', 'shein.com',
    'zara.com', 'h&m.com', 'uniqlo.com', 'gap.com', 'oldnavy.com',
    'nike.com', 'adidas.com', 'underarmour.com', 'puma.com', 'reebok.com',
    'choicegr.com', 'avocado-lviv.choicegr.com',
    // Українські інтернет-магазини
    'rozetka.com.ua', 'foxtrot.com.ua', 'comfy.ua', 'allo.ua', 'epicentr.ua',
    'silpo.ua', 'novus.ua', 'atbmarket.com', 'varus.ua', 'auchan.ua',
    'prom.ua', 'bigl.ua', 'olx.ua', 'zakupka.com', 'hotline.ua',
    'modnakasta.ua', 'intertop.ua', 'wildberries.ua', 'makeup.ua',
    'makeup.com.ua', 'notino.ua', 'shafa.ua', 'kasta.ua',
    // Додаткові міжнародні інтернет-магазини
    'mercari.com', 'vinted.com', 'depop.com', 'poshmark.com',
    'grailed.com', 'stockx.com', 'goat.com', 'flightclub.com',
    'asos.com', 'boohoo.com', 'missguided.com', 'prettylittlething.com',
    'zalando.com', 'yoox.com', 'net-a-porter.com', 'farfetch.com',
    'mytheresa.com', 'ssense.com', 'matchesfashion.com', 'luisaviaroma.com',
    'wayfair.com', 'overstock.com', 'houzz.com', 'bedbathandbeyond.com',
    'macys.com', 'nordstrom.com', 'kohls.com', 'jcpenney.com',
    'sephora.com', 'ulta.com', 'glossier.com', 'fenty.com'
  ];
  
  // Технології
  const technologyDomains = [
    'apple.com', 'microsoft.com', 'amazon.com', 'meta.com',
    'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'github.com',
    'stackoverflow.com', 'reddit.com', 'hackernews.com', 'producthunt.com',
    'techcrunch.com', 'wired.com', 'theverge.com', 'ars-technica.com',
    'engadget.com', 'gizmodo.com', 'mashable.com', 'readwrite.com',
    'venturebeat.com', 'recode.net', 'techdirt.com', 'slashdot.org',
    'digg.com', 'stumbleupon.com', 'delicious.com', 'pinterest.com',
    // Українські IT-ресурси
    'dou.ua', 'dev.ua', 'itc.ua', 'ain.ua',
    'habr.com', 'm.dou.ua',
    // Додаткові міжнародні технологічні ресурси
    'android.com', 'android-developers.googleblog.com', 'developer.android.com',
    'developer.apple.com', 'developer.mozilla.org', 'web.dev',
    'css-tricks.com', 'javascript.info', 'javascript30.com',
    'egghead.io', 'frontendmasters.com', 'freecodecamp.org',
    'udacity.com', 'udemy.com', 'pluralsight.com',
    'git-scm.com', 'gitlab.com', 'bitbucket.org',
    'docker.com', 'kubernetes.io', 'terraform.io',
    'aws.amazon.com', 'azure.microsoft.com', 'cloud.google.com',
    'digitalocean.com', 'heroku.com', 'vercel.com',
    'netlify.com', 'github.io', 'pages.github.com',
    'codepen.io', 'jsfiddle.net', 'codesandbox.io',
    'replit.com', 'glitch.com', 'stackblitz.com'
  ];
  
  // Перевіряємо категорії послідовно - кожен домен належить тільки до однієї категорії
  // Порядок перевірки важливий: якщо домен є в кількох списках, повертається перша знайдена категорія
  // Це гарантує, що домени не можуть належати до кількох категорій одночасно
  if (domainInList(cleanDomain, socialDomains)) return 'social';
  if (domainInList(cleanDomain, newsDomains)) return 'news';
  if (domainInList(cleanDomain, workDomains)) return 'work';
  if (domainInList(cleanDomain, educationDomains)) return 'education';
  if (domainInList(cleanDomain, entertainmentDomains)) return 'entertainment';
  if (domainInList(cleanDomain, shoppingDomains)) return 'shopping';
  if (domainInList(cleanDomain, technologyDomains)) return 'technology';
  
  // Якщо домен не підпадає під жодну з визначених категорій, повертаємо 'other'
  // Категорія 'other' містить тільки те, що не підпадає під інші категорії
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
      'DEVICE_TYPES.TABLET': 'Планшет',
      'DEVICE_TYPES.UNKNOWN': 'Невідомий пристрій'
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
    case 'unknown':
      return getTranslation('DEVICE_TYPES.UNKNOWN');
    default:
      return deviceType || getTranslation('DEVICE_TYPES.UNKNOWN');
  }
}; 