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