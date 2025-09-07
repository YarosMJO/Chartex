import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { formatDuration } from '../utils/utils';

export interface HeatmapSeries {
  name: string;
  data: { x: string; y: number }[];
}

export interface HeatmapOptions {
  chart: any;
  xaxis: any;
  yaxis: any;
  colors: string[];
  dataLabels: any;
  grid: any;
  tooltip: any;
  plotOptions: any;
  legend: any;
}

@Injectable({
  providedIn: 'root'
})
export class HeatmapService {
  private dayNames = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];

  constructor(private apiService: ApiService) {}

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.replace('#', '').match(/.{1,2}/g);
    if (!match || match.length < 3) return null;
    const [r, g, b] = match.map(v => parseInt(v.length === 1 ? v + v : v, 16));
    return { r, g, b } as any;
  }

  private rgba(hex: string, alpha: number): string {
    const rgb = this.hexToRgb(hex) || { r: 0, g: 0, b: 0 };
    const a = Math.min(Math.max(alpha, 0), 1);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }

  /**
   * Підготовка даних для теплової карти активності
   */
  async prepareActivityHeatmapData(
    userStats: any,
    selectedPeriod: string,
    selectedDevice: string
  ): Promise<HeatmapSeries[]> {
    console.log('🔍 HEATMAP DEBUG: Starting prepareActivityHeatmapData');
    
    if (!userStats?.topDomains) {
      console.log('🔍 HEATMAP DEBUG: No userStats.topDomains, returning');
      return [];
    }
    
    // Створюємо матрицю для зберігання активності за днями
    const activityMatrix: { [day: number]: number } = {};
    
    // Ініціалізуємо матрицю
    for (let day = 0; day < 7; day++) {
      activityMatrix[day] = 0;
    }
    
    try {
      // Отримуємо реальні дані з історії для аналізу активності
      console.log('🔍 HEATMAP DEBUG: Loading history for heatmap...');
      let historyItems = await this.loadHistoryForHeatmap(selectedPeriod, selectedDevice);
      // Виключаємо google.com з теплової карти
      historyItems = (historyItems || []).filter(item => {
        const host = (item?.domain || item?.url || '').toString();
        return !host.includes('google.com');
      });
      console.log('🔍 HEATMAP DEBUG: History items received:', historyItems?.length || 0);
      
      if (historyItems && historyItems.length > 0) {
        console.log('🔍 HEATMAP DEBUG: Processing real history data...');
        console.log('🔍 HEATMAP DEBUG: Sample history item:', historyItems[0]);
        
        // Використовуємо реальні дані з dayOfWeek та duration
        historyItems.forEach((item, index) => {
          const day = item.dayOfWeek || 0;
          const duration = item.duration || 0; // Використовуємо тривалість замість кількості відвідувань
          
          console.log(`🔍 HEATMAP DEBUG: Item ${index}: dayOfWeek=${day}, duration=${duration}`);
          
          if (day >= 0 && day < 7) {
            // Перевіряємо, чи duration є валідним числом
            const validDuration = isNaN(duration) ? 0 : Math.max(0, duration);
            activityMatrix[day] += validDuration; // Накопичуємо тривалість
          }
        });
        
        console.log('🔍 HEATMAP DEBUG: Activity matrix after processing:', activityMatrix);
                        } else {
                    console.log('🔍 HEATMAP DEBUG: No history items, using fallback model...');
                    // Fallback до приблизної моделі, якщо немає реальних даних
                    userStats?.topDomains?.forEach((domain: any) => {
          if (domain.visits > 0) {
            const totalDuration = domain.totalDuration || 0; // Використовуємо totalDuration з topDomains
            // Перевіряємо, чи totalDuration є валідним числом
            const validTotalDuration = isNaN(totalDuration) ? 0 : Math.max(0, totalDuration);
            const durationPerDay = Math.ceil(validTotalDuration / 7);
            
            console.log(`🔍 HEATMAP DEBUG: Domain ${domain._id}: totalDuration=${totalDuration}, durationPerDay=${durationPerDay}`);
            
            for (let day = 0; day < 7; day++) {
              // Симулюємо розподіл активності для тривалості
              let activityMultiplier = 1;
              if (day === 0 || day === 6) { // Вихідні
                activityMultiplier = 0.7;
              } else { // Робочі дні
                activityMultiplier = 1.2;
              }
              const simulatedDuration = Math.floor(durationPerDay * activityMultiplier);
              // Перевіряємо, чи simulatedDuration є валідним числом
              const validDuration = isNaN(simulatedDuration) ? 0 : Math.max(0, simulatedDuration);
              activityMatrix[day] += validDuration;
            }
          }
        });
        
        console.log('🔍 HEATMAP DEBUG: Activity matrix after fallback processing:', activityMatrix);
      }
      
      // Конвертуємо матрицю в формат для ApexCharts heatmap
      const heatmapData: { x: string; y: number }[] = [];
      
      for (let day = 0; day < 7; day++) {
        const value = activityMatrix[day] || 0;
        // Перевіряємо, чи value є валідним числом
        const validValue = isNaN(value) ? 0 : Math.max(0, value);
        console.log(`🔍 HEATMAP DEBUG: Day ${day} (${this.dayNames[day]}): value=${value}, validValue=${validValue}`);
        
        // Використовуємо правильний формат даних для ApexCharts heatmap
        heatmapData.push({
          x: this.dayNames[day],
          y: validValue
        });
      }
      
      console.log('🔍 HEATMAP DEBUG: Final heatmapData:', heatmapData);
      console.log('🔍 HEATMAP DEBUG: Data length:', heatmapData.length);
      console.log('🔍 HEATMAP DEBUG: Sample data point:', heatmapData[0]);
      
      // Додаткова перевірка для ApexCharts
      if (heatmapData.length > 0) {
        console.log('🔍 HEATMAP DEBUG: First data point structure:', {
          x: heatmapData[0].x,
          y: heatmapData[0].y,
          type: typeof heatmapData[0].y
        });
        
        // Перевіряємо всі точки даних
        heatmapData.forEach((point, index) => {
          console.log(`🔍 HEATMAP DEBUG: Data point ${index}:`, {
            x: point.x,
            y: point.y,
            valueType: typeof point.y,
            isNaN: isNaN(point.y)
          });
        });
      }
      
      // Тестовий дані для перевірки (тільки якщо немає реальних даних)
      if (heatmapData.length === 0) {
        console.log('🔍 HEATMAP DEBUG: No data generated, creating test data...');
        return [
          {
            name: 'Тривалість',
            data: [
              { x: 'Неділя', y: 1000 },
              { x: 'Понеділок', y: 2000 },
              { x: 'Вівторок', y: 1500 },
              { x: 'Середа', y: 3000 },
              { x: 'Четвер', y: 2500 },
              { x: 'П\'ятниця', y: 1800 },
              { x: 'Субота', y: 1200 }
            ]
          }
        ];
      }
      
      // Повертаємо дані в правильному форматі для ApexCharts heatmap
      console.log('🔍 HEATMAP DEBUG: Returning heatmap data in correct format...');
      return [
        {
          name: 'Тривалість',
          data: heatmapData
        }
      ];
    } catch (error) {
      console.error('Error preparing heatmap data:', error);
      // Fallback to empty data
      return [];
    }
  }

  /**
   * Генерує тестові дані для теплової карти добової активності
   * Використовується для демонстрації або коли реальні дані відсутні
   */
  private generateTestHeatmapData(
    weeks: string[], 
    hourLabels: string[], 
    hoursToRemove: Set<string>,
    weekPrefix: string
  ): Record<string, Record<string, number>> {
    const valueByHourWeek: Record<string, Record<string, number>> = {};
    hourLabels.forEach(h => (valueByHourWeek[h] = {}));

    // Тестовий профіль активності за годинами (середня тривалість сесії)
    const getTestValueForHour = (h: number): number => {
      if (h < 6) return 0;            // Ніч
      if (h < 9) return 300;          // Ранок ~5 хв
      if (h < 13) return 900;         // До обіду ~15 хв
      if (h < 18) return 1200;        // Після обіду ~20 хв
      if (h < 23) return 600;         // Вечір ~10 хв
      return 180;                     // Пізній вечір ~3 хв
    };

    // Допоміжні функції для детермінованої варіації
    const stringHash = (s: string): number => {
      let h = 2166136261 >>> 0; // FNV-1a базовий старт
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };
    const seededRand01 = (seed: number): number => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Генеруємо тестові дані для кожного тижня
    weeks.forEach(weekLabel => {
      // Детермінований коефіцієнт для унікальності тижня (0.85..1.35)
      const wSeed = stringHash(weekLabel);
      const weekFactor = 0.85 + seededRand01(wSeed) * 0.5;
      
      // Підставляємо тестові значення для кожної години з невеликим годинним шумом (0.9..1.2)
      hourLabels.forEach(hLabel => {
        if (hoursToRemove.has(hLabel)) return; // Не заповнюємо ті години, які треба прибрати
        const hourNum = parseInt(hLabel.slice(0, 2), 10);
        const base = getTestValueForHour(hourNum);
        const hSeed = stringHash(weekLabel + '|' + hLabel);
        const hourFactor = 0.9 + seededRand01(hSeed) * 0.3;
        const val = Math.round(base * weekFactor * hourFactor);
        valueByHourWeek[hLabel][weekLabel] = val;
      });
    });

    return valueByHourWeek;
  }

  /**
   * Готує теплову карту добової активності протягом тижнів
   * Y: години доби, X: тижні (W1..Wn), значення: сумарна тривалість (секунди)
   */
  async prepareTimeOfDayWeekHeatmapData(
    selectedPeriod: string,
    selectedDevice: string
  ): Promise<HeatmapSeries[]> {
    // Квартал відображаємо як 3 місяці по 4 тижні = 12 тижнів
    const QUARTER_WEEKS = 12;
    const now = new Date();
    const fromDate = new Date(now.getTime() - QUARTER_WEEKS * 7 * 24 * 60 * 60 * 1000);

    // Завантажуємо історію за квартал незалежно від вибраного періоду
    let historyItems = await this.loadHistoryForHeatmap('90d', selectedDevice);
    // Фільтрація дублюється з підготовки активності — виключаємо google.com, якщо є домен/URL
    historyItems = (historyItems || []).filter(item => {
      const host = (item?.domain || item?.url || '').toString();
      return !host.includes('google.com');
    });

    // Визначаємо години, які показуємо (повний добовий діапазон 00..23)
    const hours: number[] = Array.from({ length: 24 }, (_, i) => i);
    const hourLabels: string[] = hours.map(h => `${h.toString().padStart(2, '0')}:00`);

    // Допоміжні структури
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const valueByHourWeek: Record<string, Record<string, number>> = {};
    hourLabels.forEach(h => (valueByHourWeek[h] = {}));

    let maxWeekIndex = 1;
    const lang = (localStorage.getItem('chartex_language') || 'uk').toLowerCase();
    const weekPrefix = lang.startsWith('uk') ? 'Тижд.' : 'W';
    const getItemDate = (it: any): Date | null => {
      const ts = (it?.timestamp ?? it?.time ?? it?.date ?? it?.startTime ?? it?.endTime ?? it?.visitedAt ?? it?.lastVisitTime ?? it?.visitTime ?? it?.createdAt ?? it?.updatedAt);
      if (!ts) return null;
      let ms: number | null = null;
      if (typeof ts === 'number') {
        ms = ts < 1e12 ? ts * 1000 : ts; // seconds → ms
      } else if (typeof ts === 'string') {
        const num = Number(ts);
        if (!isNaN(num)) {
          ms = num < 1e12 ? num * 1000 : num;
        } else {
          const parsed = Date.parse(ts);
          ms = isNaN(parsed) ? null : parsed;
        }
      } else if (ts instanceof Date) {
        ms = ts.getTime();
      }
      if (ms === null) return null;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    };

    // Формуємо осі X — 12 тижнів (3 місяці × 4 тижні)
    const weeks: string[] = Array.from({ length: QUARTER_WEEKS }, (_, i) => `${weekPrefix}${i + 1}`);

    // Структура для відстеження кількості сесій по годинах
    const sessionCountByHourWeek: Record<string, Record<string, number>> = {};
    hourLabels.forEach(h => (sessionCountByHourWeek[h] = {}));

    for (const it of historyItems) {
      const d = getItemDate(it);
      // Якщо дати немає — відносимо до W1, годину пробуємо взяти з поля hour/hourOfDay
      const hourRaw: any = (it?.hour ?? it?.hourOfDay);
      const hourFromItem = typeof hourRaw === 'number' ? hourRaw : (typeof hourRaw === 'string' ? parseInt(hourRaw, 10) : null);
      const hour = d ? d.getHours() : (Number.isFinite(hourFromItem) ? (hourFromItem as number) : null);
      if (hour === null || hour < 0 || hour > 23) continue;
      const hourLabel = `${(hour as number).toString().padStart(2, '0')}:00`;
      const baseMs = fromDate.getTime();
      let weekIndex = d ? (Math.floor((d.getTime() - baseMs) / MS_PER_WEEK) + 1) : 1;
      // Обмежуємо індекс у межах кварталу
      weekIndex = Math.max(1, Math.min(weekIndex, QUARTER_WEEKS));
      maxWeekIndex = Math.max(maxWeekIndex, weekIndex);
      const weekLabel = `${weekPrefix}${weekIndex}`;
      const duration = isNaN(it?.duration) ? 0 : Math.max(0, it.duration);
      
      // Накопичуємо тривалість і кількість сесій
      valueByHourWeek[hourLabel][weekLabel] = (valueByHourWeek[hourLabel][weekLabel] || 0) + duration;
      sessionCountByHourWeek[hourLabel][weekLabel] = (sessionCountByHourWeek[hourLabel][weekLabel] || 0) + 1;
    }

    // Обчислюємо середню тривалість сесії для кожної комірки
    console.log('🔍 WEEK HEATMAP DEBUG: Calculating average session duration...');
    console.log('🔍 WEEK HEATMAP DEBUG: weeks array length:', weeks.length);
    console.log('🔍 WEEK HEATMAP DEBUG: hourLabels array length:', hourLabels.length);
    
    hourLabels.forEach(hLabel => {
      weeks.forEach(wLabel => {
        const totalDuration = valueByHourWeek[hLabel][wLabel] || 0;
        const sessionCount = sessionCountByHourWeek[hLabel][wLabel] || 0;
        if (sessionCount > 0) {
          // Використовуємо середню тривалість сесії замість загальної суми
          const avgDuration = Math.round(totalDuration / sessionCount);
          valueByHourWeek[hLabel][wLabel] = avgDuration;
          if (totalDuration > 0) {
            console.log(`🔍 WEEK HEATMAP DEBUG: ${hLabel} ${wLabel}: ${sessionCount} sessions, total=${formatDuration(totalDuration)}, avg=${formatDuration(avgDuration)}`);
          }
        } else {
          valueByHourWeek[hLabel][wLabel] = 0;
        }
      });
    });

    // Визначаємо години без даних для видалення
    const hoursToRemove = new Set<string>();
    
    // Перевіряємо кожну годину - якщо в ній немає даних у жодному тижні, додаємо до списку видалення
    hourLabels.forEach(hLabel => {
      let hasDataInThisHour = false;
      weeks.forEach(w => {
        if ((valueByHourWeek[hLabel][w] || 0) > 0) {
          hasDataInThisHour = true;
        }
      });
      if (!hasDataInThisHour) {
        hoursToRemove.add(hLabel);
        console.log('🔍 WEEK HEATMAP DEBUG: Removing hour with no data:', hLabel);
      }
    });

    console.log('🔍 WEEK HEATMAP DEBUG: Hours to remove:', Array.from(hoursToRemove));
    console.log('🔍 WEEK HEATMAP DEBUG: Hours to keep:', hourLabels.filter(h => !hoursToRemove.has(h)));

    // Якщо немає реальних даних, використовуємо тестові значення
    let hasRealData = false;
    hourLabels.forEach(hLabel => {
      if (hoursToRemove.has(hLabel)) return; // Пропускаємо години без даних
      weeks.forEach(w => {
        if ((valueByHourWeek[hLabel][w] || 0) > 0) {
          hasRealData = true;
        }
      });
    });

    console.log('🔍 WEEK HEATMAP DEBUG: Has real data:', hasRealData);

    // Якщо немає реальних даних, генеруємо тестові
    if (!hasRealData) {
      console.log('🔍 WEEK HEATMAP DEBUG: No real data found, generating test data...');
      const testData = this.generateTestHeatmapData(weeks, hourLabels, hoursToRemove, weekPrefix);
      
      // Копіюємо тестові дані
      hourLabels.forEach(hLabel => {
        weeks.forEach(w => {
          valueByHourWeek[hLabel][w] = testData[hLabel][w] || 0;
        });
      });
    }

    // Обчислимо глобальний максимум
    let globalMaxValue = 0;
    hourLabels.forEach(hLabel => {
      if (hoursToRemove.has(hLabel)) return;
      weeks.forEach(w => {
        globalMaxValue = Math.max(globalMaxValue, valueByHourWeek[hLabel][w] || 0);
      });
    });
    
    console.log('🔍 WEEK HEATMAP DEBUG: Global max value:', globalMaxValue);
    
    if (globalMaxValue <= 0) {
      globalMaxValue = 3600; // 1 година за замовчуванням
      console.log('🔍 WEEK HEATMAP DEBUG: No data found, setting default globalMaxValue:', globalMaxValue);
    }



    // Палітра відтінків для 3 місяців кварталу - використовуємо максимально контрастні кольори
    const monthBaseColors = ['#93c5fd', '#14532d', '#991b1b'];

    // Базовий колір за місячним кошиком (кожні 4 тижні — новий місяць)
    const getMonthBaseColorByIndex = (zeroBasedWeekIndex: number): string => {
      const bucket = Math.min(Math.floor(zeroBasedWeekIndex / 4), 2);
      return monthBaseColors[bucket];
    };

    // Перетворення у формат HeatmapSeries ApexCharts (інвертуємо, щоб 00:00 був вгорі)
    let series: HeatmapSeries[] = [...hourLabels]
      .filter(h => !hoursToRemove.has(h))
      .reverse()
      .map(hourLabel => ({
        name: hourLabel,
        data: weeks.map((w, i) => {
          const val = valueByHourWeek[hourLabel][w] || 0;
          // Кодуємо колір прямо у значенні: перші 4 тижні = 0-999, наступні 4 = 1000-1999, останні 4 = 2000-2999
          const monthBucket = Math.min(Math.floor(i / 4), 2); // 0, 1, або 2
          // Нормалізуємо значення для максимального контрасту
          // Мінімальні значення стають майже прозорими, максимальні - майже чорними
          const normalizedRatio = val / globalMaxValue;
          let enhancedRatio;
          if (normalizedRatio === 0) {
            enhancedRatio = 0.02; // Мінімальні значення майже невидимі
          } else if (normalizedRatio < 0.2) {
            enhancedRatio = 0.02 + normalizedRatio * 0.3; // 0.02-0.08 для малих значень
          } else if (normalizedRatio < 0.6) {
            enhancedRatio = 0.08 + (normalizedRatio - 0.2) * 1.5; // 0.08-0.68 для середніх
          } else {
            enhancedRatio = 0.68 + (normalizedRatio - 0.6) * 0.8; // 0.68-1.0 для максимальних
          }
          
          // Обмежуємо до діапазону 0-999 (0 для нульових значень, 1-999 для інших)
          const normalizedVal = val === 0 ? 0 : Math.max(1, Math.round(enhancedRatio * 998) + 1);
          const encodedVal = monthBucket * 1000 + normalizedVal;
          return { x: w, y: encodedVal } as any;
        })
      }));

    console.log('🔍 WEEK HEATMAP DEBUG: Generated series count:', series.length);
    if (series.length > 0) {
      console.log('🔍 WEEK HEATMAP DEBUG: Sample series:', series[0].name, 'with', series[0].data.length, 'data points');
      console.log('🔍 WEEK HEATMAP DEBUG: Sample data points:', series[0].data.slice(0, 3));
      console.log('🔍 WEEK HEATMAP DEBUG: Week categories for tooltip:', weeks);
      console.log('🔍 WEEK HEATMAP DEBUG: Hour labels for tooltip:', hourLabels.slice(0, 5));
    }

    // Fallback якщо дані порожні
    if (series.length === 0 || series.every(s => s.data.length === 0)) {
      console.log('🔍 WEEK HEATMAP DEBUG: No valid series generated, creating fallback data');
      series = [
        {
          name: '12:00',
          data: weeks.map((w, i) => ({
            x: w,
            y: Math.floor(i / 4) * 1000 + 500 // Середні значення для демонстрації
          }))
        }
      ];
    }

    // Діагностика: перевіримо, що кольори потрапляють у точки
    try {
      const sampleRow = series[0];
      const sampleCell: any = sampleRow?.data?.[0] || null;
      // eslint-disable-next-line no-console
      console.log('🔍 WEEK HEATMAP COLOR DEBUG:', {
        seriesCount: series.length,
        weeksCount: weeks.length,
        sampleCell,
      });
    } catch {}

    return series;
  }

  /**
   * Готує теплову карту добової активності з тестовими даними
   * Використовується для демонстрації функціоналу
   */
  async prepareTimeOfDayWeekHeatmapDataWithTest(
    selectedPeriod: string,
    selectedDevice: string
  ): Promise<HeatmapSeries[]> {
    // Квартал відображаємо як 3 місяці по 4 тижні = 12 тижнів
    const QUARTER_WEEKS = 12;

    // Визначаємо години (повний добовий діапазон 00..23)
    const hours: number[] = Array.from({ length: 24 }, (_, i) => i);
    const hourLabels: string[] = hours.map(h => `${h.toString().padStart(2, '0')}:00`);

    const lang = (localStorage.getItem('chartex_language') || 'uk').toLowerCase();
    const weekPrefix = lang.startsWith('uk') ? 'Тижд.' : 'W';

    // Формуємо осі X — 12 тижнів (3 місяці × 4 тижні)
    const weeks: string[] = Array.from({ length: QUARTER_WEEKS }, (_, i) => `${weekPrefix}${i + 1}`);

    // Для тестових даних не видаляємо години (показуємо повний день)
    const hoursToRemove = new Set<string>();

    // Генеруємо тестові дані
    const valueByHourWeek = this.generateTestHeatmapData(weeks, hourLabels, hoursToRemove, weekPrefix);

    // Обчислимо глобальний максимум для тестових даних
    let globalMaxValue = 0;
    hourLabels.forEach(hLabel => {
      if (hoursToRemove.has(hLabel)) return;
      weeks.forEach(w => {
        globalMaxValue = Math.max(globalMaxValue, valueByHourWeek[hLabel][w] || 0);
      });
    });
    if (globalMaxValue <= 0) globalMaxValue = 1;

    // Палітра відтінків для 3 місяців кварталу
    const monthBaseColors = ['#1e3a8a', '#14532d', '#991b1b'];

    // Перетворення у формат HeatmapSeries ApexCharts (інвертуємо, щоб 00:00 був вгорі)
    const series: HeatmapSeries[] = [...hourLabels]
      .filter(h => !hoursToRemove.has(h))
      .reverse()
      .map(hourLabel => ({
        name: hourLabel,
        data: weeks.map((w, i) => {
          const val = valueByHourWeek[hourLabel][w] || 0;
          // Кодуємо колір прямо у значенні: перші 4 тижні = 0-999, наступні 4 = 1000-1999, останні 4 = 2000-2999
          const monthBucket = Math.min(Math.floor(i / 4), 2); // 0, 1, або 2
          // Нормалізуємо значення для максимального контрасту
          const normalizedRatio = val / globalMaxValue;
          let enhancedRatio;
          if (normalizedRatio === 0) {
            enhancedRatio = 0.02; // Мінімальні значення майже невидимі
          } else if (normalizedRatio < 0.2) {
            enhancedRatio = 0.02 + normalizedRatio * 0.3; // 0.02-0.08 для малих значень
          } else if (normalizedRatio < 0.6) {
            enhancedRatio = 0.08 + (normalizedRatio - 0.2) * 1.5; // 0.08-0.68 для середніх
          } else {
            enhancedRatio = 0.68 + (normalizedRatio - 0.6) * 0.8; // 0.68-1.0 для максимальних
          }
          
          // Обмежуємо до діапазону 0-999 (0 для нульових значень, 1-999 для інших)
          const normalizedVal = val === 0 ? 0 : Math.max(1, Math.round(enhancedRatio * 998) + 1);
          const encodedVal = monthBucket * 1000 + normalizedVal;
          return { x: w, y: encodedVal } as any;
        })
      }));

    return series;
  }

  /** Опції для теплової карти добової активності за тижнями */
  getTimeOfDayWeekHeatmapOptions(isDarkTheme: boolean, globalMaxValue = 1): HeatmapOptions {
    // Генеруємо категорії для X-осі (тижні)
    const lang = (localStorage.getItem('chartex_language') || 'uk').toLowerCase();
    const weekPrefix = lang.startsWith('uk') ? 'Тижд.' : 'W';
    const weekCategories = Array.from({ length: 12 }, (_, i) => `${weekPrefix}${i + 1}`);
    
    console.log('🔍 TOOLTIP SETUP DEBUG: Creating options with globalMaxValue:', globalMaxValue);
    
    // Функція для форматування часу
    const formatTime = (seconds: number): string => {
      if (seconds === 0) return '0с';
      if (seconds < 60) return `${seconds}с`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}хв`;
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}год ${minutes}хв` : `${hours}год`;
    };
    
    if (isDarkTheme) {
      return {
        chart: { type: 'heatmap', height: 340, foreColor: '#f3eaff', background: '#232136', toolbar: { show: true } },
        xaxis: { 
          type: 'category', 
          categories: weekCategories,
          labels: { style: { colors: '#f3eaff' } } 
        },
        yaxis: { labels: { style: { colors: '#f3eaff' } }, title: { text: '' } },
        colors: ['#93c5fd', '#14532d', '#991b1b'],
        dataLabels: { enabled: false },
        grid: { borderColor: '#3a2e5c', padding: { top: 8, right: 8, bottom: 8, left: 8 } },
        tooltip: { 
          enabled: true, 
          theme: 'dark',
          custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
            try {
              // Отримуємо дані безпосередньо з конфігурації
              const lang = (localStorage.getItem('chartex_language') || 'uk').toLowerCase();
              const weekPrefix = lang.startsWith('uk') ? 'Тижд.' : 'W';
              
              const hourName = w?.globals?.seriesNames?.[seriesIndex] || `${String(23 - seriesIndex).padStart(2, '0')}:00`;
              const weekName = w?.config?.xaxis?.categories?.[dataPointIndex] || `${weekPrefix}${dataPointIndex + 1}`;
              const encodedValue = series?.[seriesIndex]?.[dataPointIndex] || 0;
              
              console.log('🔍 TOOLTIP DEBUG:', { 
                hourName, 
                weekName, 
                encodedValue, 
                seriesIndex, 
                dataPointIndex,
                categories: w?.config?.xaxis?.categories,
                seriesNames: w?.globals?.seriesNames
              });
              
              // Декодуємо оригінальне значення з закодованого
              const normalizedVal = Math.floor(encodedValue % 1000);
              
              // Якщо normalizedVal = 0, то це нульове значення
              let originalVal;
              if (normalizedVal === 0) {
                originalVal = 0;
              } else {
                const tooltipRatio = normalizedVal / 999;
                
                // Зворотне перетворення для отримання оригінального значення
                let originalRatio;
                if (tooltipRatio <= 0.02) {
                  originalRatio = 0;
                } else if (tooltipRatio < 0.08) {
                  originalRatio = (tooltipRatio - 0.02) / 0.3;
                } else if (tooltipRatio < 0.68) {
                  originalRatio = 0.2 + (tooltipRatio - 0.08) / 1.5;
                } else {
                  originalRatio = 0.6 + (tooltipRatio - 0.68) / 0.8;
                }
                originalVal = Math.round(originalRatio * globalMaxValue);
              }
              
              console.log('🔍 TOOLTIP DECODE DEBUG:', { 
                encodedValue, 
                normalizedVal, 
                originalVal, 
                globalMaxValue,
                formattedTime: formatTime(originalVal),
                isZeroValue: normalizedVal === 0
              });
              
              return `<div class="apexcharts-tooltip-text" style="padding: 8px; background: #1a1a1a; color: white; border-radius: 4px;">
                <div style="font-weight: bold; color: #f3eaff;">${hourName}</div>
                <div style="color: #b6a6d9;">${weekName}</div>
                <div style="color: #a259f7; font-weight: bold;">${formatTime(originalVal)}</div>
              </div>`;
            } catch (error) {
              console.error('🔍 TOOLTIP ERROR:', error);
              return `<div class="apexcharts-tooltip-text">Error loading tooltip</div>`;
            }
          }
        },
        plotOptions: { 
          heatmap: { 
            radius: 2, 
            enableShades: true, 
            shadeIntensity: 1.0, 
            useFillColorAsStroke: false, 
            distributed: false,
            colorScale: {
              ranges: [
                { from: 0, to: 999, color: '#93c5fd', name: 'Місяць 1' },
                { from: 1000, to: 1999, color: '#14532d', name: 'Місяць 2' },
                { from: 2000, to: 2999, color: '#991b1b', name: 'Місяць 3' }
              ]
            }
          } 
        },
        legend: { show: false }
      } as any;
    }
    return {
      chart: { type: 'heatmap', height: 340, toolbar: { show: true } },
      xaxis: { 
        type: 'category',
        categories: weekCategories 
      },
      yaxis: { labels: { show: true }, title: { text: '' } },
      colors: ['#1e3a8a', '#14532d', '#991b1b'],
      dataLabels: { enabled: false },
      grid: { borderColor: '#e0e0e0', padding: { top: 8, right: 8, bottom: 8, left: 8 } },
      tooltip: { 
        enabled: true, 
        theme: 'light',
        custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
          try {
            // Отримуємо дані безпосередньо з конфігурації
            const lang = (localStorage.getItem('chartex_language') || 'uk').toLowerCase();
            const weekPrefix = lang.startsWith('uk') ? 'Тижд.' : 'W';
            
            const hourName = w?.globals?.seriesNames?.[seriesIndex] || `${String(23 - seriesIndex).padStart(2, '0')}:00`;
            const weekName = w?.config?.xaxis?.categories?.[dataPointIndex] || `${weekPrefix}${dataPointIndex + 1}`;
            const encodedValue = series?.[seriesIndex]?.[dataPointIndex] || 0;
            
            // Декодуємо оригінальне значення з закодованого
            const normalizedVal = Math.floor(encodedValue % 1000);
            
            // Якщо normalizedVal = 0, то це нульове значення
            let originalVal;
            if (normalizedVal === 0) {
              originalVal = 0;
            } else {
              const tooltipRatio = normalizedVal / 999;
              
              // Зворотне перетворення для отримання оригінального значення
              let originalRatio;
              if (tooltipRatio <= 0.02) {
                originalRatio = 0;
              } else if (tooltipRatio < 0.08) {
                originalRatio = (tooltipRatio - 0.02) / 0.3;
              } else if (tooltipRatio < 0.68) {
                originalRatio = 0.2 + (tooltipRatio - 0.08) / 1.5;
              } else {
                originalRatio = 0.6 + (tooltipRatio - 0.68) / 0.8;
              }
              originalVal = Math.round(originalRatio * globalMaxValue);
            }
            
            console.log('🔍 TOOLTIP DECODE DEBUG (Light):', { 
              encodedValue, 
              normalizedVal, 
              originalVal, 
              globalMaxValue,
              formattedTime: formatTime(originalVal),
              isZeroValue: normalizedVal === 0
            });
            
            return `<div class="apexcharts-tooltip-text" style="padding: 8px; background: white; color: black; border-radius: 4px; border: 1px solid #e0e0e0;">
              <div style="font-weight: bold; color: #333;">${hourName}</div>
              <div style="color: #666;">${weekName}</div>
              <div style="color: #1976d2; font-weight: bold;">${formatTime(originalVal)}</div>
            </div>`;
          } catch (error) {
            console.error('🔍 TOOLTIP ERROR:', error);
            return `<div class="apexcharts-tooltip-text">Error loading tooltip</div>`;
          }
        }
      },
      plotOptions: { 
        heatmap: { 
          radius: 2, 
          enableShades: true, 
          shadeIntensity: 1.0, 
          useFillColorAsStroke: false, 
          distributed: false,
          colorScale: {
            ranges: [
              { from: 0, to: 999, color: '#93c5fd', name: 'Місяць 1' },
              { from: 1000, to: 1999, color: '#14532d', name: 'Місяць 2' },
              { from: 2000, to: 2999, color: '#991b1b', name: 'Місяць 3' }
            ]
          }
        } 
      },
      legend: { show: false }
    } as any;
  }

  /**
   * Завантаження історії для теплової карти
   */
  private async loadHistoryForHeatmap(selectedPeriod: string, selectedDevice: string): Promise<any[]> {
    console.log('🔍 HEATMAP DEBUG: Starting loadHistoryForHeatmap');
    console.log('🔍 HEATMAP DEBUG: selectedPeriod:', selectedPeriod);
    console.log('🔍 HEATMAP DEBUG: selectedDevice:', selectedDevice);
    
    try {
      // Розраховуємо дати для періоду
      const now = new Date();
      let fromDate: Date;
      
      switch (selectedPeriod) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0); // Всі дані
      }
      
      const params: { deviceId?: string; from?: string; to?: string; limit?: number } = {
        from: fromDate.toISOString(),
        to: now.toISOString(),
        limit: 1000
      };
      
      if (selectedDevice !== 'all') {
        params.deviceId = selectedDevice;
      }
      
      console.log('🔍 HEATMAP DEBUG: API params:', params);
      
      const historyResponse = await this.apiService.getHistoryWithDecryptedData(params);
      
      console.log('🔍 HEATMAP DEBUG: History response:', {
        hasResponse: !!historyResponse,
        itemsCount: historyResponse?.items?.length || 0,
        pagination: historyResponse?.pagination
      });
      
      if (historyResponse?.items && historyResponse.items.length > 0) {
        console.log('🔍 HEATMAP DEBUG: Sample history item:', historyResponse.items[0]);
      }
      
      return historyResponse.items || [];
    } catch (error) {
      console.error('Помилка завантаження історії для теплової карти:', error);
      return [];
    }
  }

  /**
   * Генерація опцій для теплової карти
   */
  getActivityHeatmapOptions(isDarkTheme: boolean, isNarrowChart: boolean = false): HeatmapOptions {
    console.log('🔍 HEATMAP DEBUG: Generating chart options, isDarkTheme:', isDarkTheme, 'isNarrowChart:', isNarrowChart);
    
    if (isDarkTheme) {
      return {
        chart: { 
          type: 'heatmap', 
          height: 300, 
          foreColor: '#f3eaff', 
          background: '#232136',
          toolbar: { show: true }
        },
        xaxis: { 
          type: 'category',
          labels: { style: { colors: '#f3eaff' } }
        },
        yaxis: { 
          labels: { show: false, style: { colors: '#f3eaff' } }, // Приховуємо підписи Y-осі для однорядкової теплової карти
          title: { text: '', style: { color: '#f3eaff' } } // Прибираємо заголовок Y-осі
        },
        colors: ['#2a2042', '#6c4bb6', '#a259f7', '#d4a5ff'],
        dataLabels: { 
          enabled: true,
          style: { 
            colors: ['#f3eaff'], 
            fontSize: isNarrowChart ? '8px' : '10px' 
          },
          formatter: (val: any) => formatDuration(val),
          rotate: isNarrowChart ? -90 : 0,
          rotateAlways: isNarrowChart,
          offsetX: isNarrowChart ? 8 : 0,
          offsetY: isNarrowChart ? 0 : 0,
          position: 'center'
        },
        grid: { 
          borderColor: '#3a2e5c',
          padding: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        tooltip: { 
          enabled: false
        },
        plotOptions: {
          heatmap: {
            radius: 4,
            enableShades: true,
            shadeIntensity: 0.5,
            distributed: false,
            useFillColorAsStroke: false,
            colorScale: {
              ranges: [
                { from: 0, to: 1000, color: '#2a2042', name: 'Низька' },
                { from: 1000, to: 3000, color: '#6c4bb6', name: 'Середня' },
                { from: 3000, to: 6000, color: '#a259f7', name: 'Висока' },
                { from: 6000, to: 10000, color: '#d4a5ff', name: 'Дуже висока' }
              ]
            }
          }
        },
        legend: {
          show: false
        }
      };
    } else {
      return {
        chart: { 
          type: 'heatmap', 
          height: 300,
          toolbar: { show: true }
        },
        xaxis: { 
          type: 'category'
        },
        yaxis: { 
          labels: { show: false }, // Приховуємо підписи Y-осі для однорядкової теплової карти
          title: { text: '' } // Прибираємо заголовок Y-осі
        },
        colors: ['#f8f9fa', '#e3f2fd', '#2196f3', '#1976d2'],
        dataLabels: { 
          enabled: true,
          style: { 
            colors: ['#333'], 
            fontSize: isNarrowChart ? '8px' : '10px' 
          },
          formatter: (val: any) => formatDuration(val),
          rotate: isNarrowChart ? -90 : 0,
          rotateAlways: isNarrowChart,
          offsetX: isNarrowChart ? 8 : 0,
          offsetY: isNarrowChart ? 0 : 0,
          position: 'center'
        },
        grid: { 
          borderColor: '#e0e0e0',
          padding: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        tooltip: { 
          enabled: false
        },
        plotOptions: {
          heatmap: {
            radius: 4,
            enableShades: true,
            shadeIntensity: 0.5,
            distributed: false,
            useFillColorAsStroke: false,
            colorScale: {
              ranges: [
                { from: 0, to: 1000, color: '#f8f9fa', name: 'Низька' },
                { from: 1000, to: 3000, color: '#e3f2fd', name: 'Середня' },
                { from: 3000, to: 6000, color: '#2196f3', name: 'Висока' },
                { from: 6000, to: 10000, color: '#1976d2', name: 'Дуже висока' }
              ]
            }
          }
        },
        legend: {
          show: false
        }
      };
    }
  }
} 