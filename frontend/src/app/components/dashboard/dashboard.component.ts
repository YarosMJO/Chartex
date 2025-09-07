import { Component, OnInit, NgZone, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { ApiService, HistoryStats, Device } from '../../services/api.service';
import { HeatmapService, HeatmapSeries } from '../../services/heatmap.service';
import { formatDuration, formatNumber, getPeriodLabel, getDomainFromUrl, getDeviceTypeLabel, cleanDomainName, categorizeWebsite } from '../../utils/utils';
import { StatsCardsComponent } from './stats-cards/stats-cards.component';
import { ChartsSectionComponent } from './charts-section/charts-section.component';
import { FiltersSectionComponent } from './filters-section/filters-section.component';
import { DevicesSectionComponent } from './devices-section/devices-section.component';
import { SearchSectionComponent } from './search-section/search-section.component';
import { AdvancedFiltersComponent, FilterOptions } from './advanced-filters/advanced-filters.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    NgApexchartsModule,
    MatMenuModule,
    TranslateModule,
    MatSnackBarModule,
    StatsCardsComponent,
    ChartsSectionComponent,
    FiltersSectionComponent,
    DevicesSectionComponent,
    SearchSectionComponent,
    AdvancedFiltersComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Безпечна функція для округлення
  private safeRound = (value: number): number => {
    if (typeof Math !== 'undefined' && typeof Math.round === 'function') {
      return Math.round(value);
    }
    // Fallback якщо Math недоступний
    return Math.floor(value + 0.5);
  };

  currentUser: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null = null;
  userStats: HistoryStats | null = null;
  devices: Device[] = [];
  selectedPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
  selectedDevice: string = 'all';
  loading = false;
  error: string | null = null;

  // Відстеження попередніх значень для уникнення зайвих оновлень
  private previousPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
  private previousDevice: string = 'all';

  // Флаг для запобігання зайвих оновлень
  private isUpdating = false;

  // Затримка для уникнення зайвих викликів
  private periodChangeTimeout: any = null;
  private deviceChangeTimeout: any = null;
  private advancedFiltersTimeout: any = null;

  // Дані для графіків
  activityChartData: { x: string; y: number }[] = [];
  topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];
  deviceStatsData: { name: string; visits: number; duration: number }[] = [];
  activityHeatmapData: HeatmapSeries[] = [];
  timeOfDayWeekHeatmapData: HeatmapSeries[] = [];
  categoryDistributionData: number[] = [];
  bubbleChartData: { 
    x: number; 
    y: number; 
    z: number; 
    name: string;
    rawTotalMinutes?: number;
    rawVisits?: number;
    rawAvgMinutes?: number;
  }[] = [];

  // Відстеження ширини графіка для адаптивності
  private chartWidth: number = 0;
  private resizeHandler = () => this.updateChartWidth();

  // Пошук
  searchQuery: string = '';
  searchResults: any[] = [];
  isSearching: boolean = false;
  hasResults: boolean = false;



  // Розширені фільтри
  advancedFilters: FilterOptions = {
    categories: [],
    durationRange: { min: 0, max: 180 },
    dateRange: { start: null, end: null },
    customPeriod: false,
    durationType: 'total'
  };
  isAdvancedFiltersExpanded: boolean = false;

  // Флаг для запобігання зайвим оновленням графіка
  private lastChartDataHash = '';

  // Кеш для методів форматування
  private formatCache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 100;

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
    private heatmapService: HeatmapService,
    private ngZone: NgZone,
    private router: Router,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Ініціалізуємо мову з localStorage
    const savedLanguage = localStorage.getItem('chartex_language') || 'uk';
    console.log('Dashboard ініціалізує мову:', savedLanguage);
    this.translateService.use(savedLanguage);

    // Слухаємо зміни мови
    window.addEventListener('languageChanged', (event: any) => {
      if (event.detail && event.detail.language) {
        console.log('Dashboard отримав подію зміни мови:', event.detail.language);
        // Змінюємо мову тільки якщо вона дійсно змінилася
        if (this.translateService.currentLang !== event.detail.language) {
          this.translateService.use(event.detail.language);
          console.log('Мова успішно змінена на:', event.detail.language);
          // Очищаємо кеш форматування при зміні мови
          this.formatCache.clear();
          this.cdr.markForCheck();
        } else {
          console.log('Мова вже встановлена на:', event.detail.language);
        }
      }
    });

    // Слухаємо зміни розміру вікна для адаптивності графіків
    window.addEventListener('resize', this.resizeHandler);

    // Ініціалізуємо ширину графіка
    setTimeout(() => {
      this.updateChartWidth();
    }, 100);

    this.authService.getUser().subscribe(async user => {
      this.currentUser = user;
      if (this.currentUser) {
        this.error = null;
        try {
          console.log('Спроба отримання ключа шифрування...');
          const encryptionKey = await this.authService.getEncryptionKey();
          if (encryptionKey) {
            this.apiService.setEncryptionKey(encryptionKey);
            console.log('Ключ шифрування успішно встановлено:', {
              hasKey: !!encryptionKey,
              keyLength: encryptionKey.length,
              keyPreview: encryptionKey.substring(0, 10) + '...'
            });
          } else {
            this.error = 'Ключ шифрування не знайдено - деякі дані можуть відображатися як хеші';
            console.warn('Ключ шифрування не знайдено, дані будуть показані як хеші');
          }
          this.cdr.markForCheck();
        } catch (error) {
          this.error = 'Помилка отримання ключа шифрування - деякі дані можуть відображатися як хеші';
          console.error('Помилка отримання ключа шифрування:', error);
          this.cdr.markForCheck();
        }
        console.log('🔍 BUBBLE DEBUG: User authenticated, initializing dashboard');
        this.initializeDashboard();
      } else {
        this.error = 'Користувач не авторизований';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });


  }

  ngOnDestroy() {
    if (this.periodChangeTimeout) {
      clearTimeout(this.periodChangeTimeout);
    }
    if (this.deviceChangeTimeout) {
      clearTimeout(this.deviceChangeTimeout);
    }
    if (this.advancedFiltersTimeout) {
      clearTimeout(this.advancedFiltersTimeout);
    }
    
    // Очищаємо слухачі подій
    window.removeEventListener('resize', this.resizeHandler);
    this.formatCache.clear();
  }

  // Ініціалізація дашборду: завантаження статистики та пристроїв
  async initializeDashboard() {
    try {
      this.loading = true;
      this.error = null;
      this.cdr.markForCheck();

      if (!this.currentUser) {
        this.error = 'Користувач не авторизований';
        this.cdr.markForCheck();
        return;
      }
      await Promise.all([
        this.loadUserStats(),
        this.loadDevices()
      ]);

      // Ініціалізуємо попередні значення після завантаження
      this.previousPeriod = this.selectedPeriod;
      this.previousDevice = this.selectedDevice;
      console.log('Ініціалізовано попередні значення:', {
        previousPeriod: this.previousPeriod,
        previousDevice: this.previousDevice
      });
      console.log('🔍 BUBBLE DEBUG: Dashboard initialized, bubbleChartData:', this.bubbleChartData);
    } catch (error) {
      this.error = 'Помилка завантаження даних: ' + (error instanceof Error ? error.message : String(error));
      this.cdr.markForCheck();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // Завантаження статистики користувача
  async loadUserStats() {
    // Запобігаємо одночасним оновленням
    if (this.isUpdating) {
      console.log('Оновлення вже виконується, пропускаємо...');
      return;
    }

    this.isUpdating = true;

    try {
      console.log('Початок завантаження статистики користувача...');
      const params: { period: '7d' | '30d' | '90d' | '1y' | 'all'; deviceId?: string } = {
        period: this.selectedPeriod
      };
      if (this.selectedDevice !== 'all') {
        params.deviceId = this.selectedDevice;
      }

      console.log('Параметри для статистики:', params);
      
      // Додаємо timestamp для уникнення кешування
      const paramsWithTimestamp = {
        ...params,
        _t: Date.now()
      };
      
      console.log('🔍 CACHE DEBUG: Loading fresh data, timestamp:', paramsWithTimestamp._t);
      console.log('🔍 CACHE DEBUG: Request params:', paramsWithTimestamp);
      
      const stats = await this.apiService.getUserStatsWithDecryptedData(paramsWithTimestamp);
      
      console.log('🔍 LOAD STATS DEBUG: Raw stats from API:', {
        hasStats: !!stats,
        period: stats?.period,
        totalVisits: stats?.stats?.totalVisits,
        totalDuration: stats?.stats?.totalDuration,
        totalDurationHours: stats?.stats?.totalDuration ? (this.safeRound(((stats.stats.totalDuration || 0) / 3600 * 100) || 0) / 100) || 0 : 0,
        topDomainsCount: stats?.topDomains?.length || 0,
        firstTopDomain: stats?.topDomains?.[0] ? {
          _id: stats.topDomains[0]._id,
          visits: stats.topDomains[0].visits,
          totalDuration: stats.topDomains[0].totalDuration,
          url: stats.topDomains[0].decryptedData?.url
        } : null
      });

      console.log('Статистика отримана:', {
        hasStats: !!stats,
        hasTopDomains: !!stats?.topDomains,
        topDomainsCount: stats?.topDomains?.length || 0,
        totalVisits: stats?.stats?.totalVisits || 0,
        uniqueDomains: stats?.stats?.uniqueDomains || 0
      });

      if (stats?.topDomains && stats.topDomains.length > 0) {
        console.log('🔍 ACTIVITY CHART DEBUG: First 3 domains from API:', stats.topDomains.slice(0, 3).map(d => ({
          id: d._id,
          visits: d.visits,
          totalDuration: d.totalDuration,
          totalDurationMinutes: this.safeRound((d.totalDuration || 0) / 60),
          totalDurationHours: this.safeRound((d.totalDuration || 0) / 3600),
          hasDecryptedData: !!d.decryptedData,
          url: d.decryptedData?.url || 'не дешифровано'
        })));
        
        console.log('🔍 DURATION DEBUG: All domains with duration:', stats.topDomains.map(d => ({
          url: d.decryptedData?.url || d._id,
          visits: d.visits,
          totalDuration: d.totalDuration,
          durationHours: (this.safeRound(((d.totalDuration || 0) / 3600 * 100) || 0) / 100) || 0
        })));
      }

      this.userStats = stats;
      console.log('🔍 BUBBLE DEBUG: userStats set in loadUserStats:', this.userStats);
      await this.prepareChartData();
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Помилка завантаження статистики:', error);
      this.error = 'Помилка завантаження статистики: ' + (error instanceof Error ? error.message : String(error));
      this.cdr.markForCheck();
    } finally {
      this.isUpdating = false;
    }
  }

  // Завантаження пристроїв користувача
  async loadDevices() {
    try {
      const devices = await this.apiService.getDevices();
      this.devices = devices;
      if (!this.devices) {
        this.error = 'Дані пристроїв не отримано.';
        this.cdr.markForCheck();
        return;
      }
      this.cdr.markForCheck();
    } catch (error) {
      this.error = 'Помилка завантаження пристроїв: ' + (error instanceof Error ? error.message : String(error));
      this.cdr.markForCheck();
    }
  }

  // Підготовка даних для графіків
  async prepareChartData() {
    console.log('🔍 HEATMAP DEBUG: Starting prepareChartData');
    console.log('🔍 CHART PREP DEBUG: userStats object:', {
      hasUserStats: !!this.userStats,
      period: this.userStats?.period,
      totalVisits: this.userStats?.stats?.totalVisits,
      totalDuration: this.userStats?.stats?.totalDuration,
      totalDurationHours: this.userStats?.stats?.totalDuration ? (this.safeRound(((this.userStats.stats.totalDuration || 0) / 3600 * 100) || 0) / 100) || 0 : 0,
      topDomainsCount: this.userStats?.topDomains?.length || 0
    });

    if (!this.userStats) {
      console.log('🔍 HEATMAP DEBUG: No userStats available');
      this.activityChartData = [];
      this.topDomainsData = [];
      this.deviceStatsData = [];
      this.activityHeatmapData = [];
      this.timeOfDayWeekHeatmapData = [];
      this.categoryDistributionData = [];
      this.bubbleChartData = [];
      return;
    }

    try {
      // Перевіряємо чи є топ-домени
      if (!this.userStats.topDomains || this.userStats.topDomains.length === 0) {
        console.log('🔍 ACTIVITY CHART DEBUG: No topDomains available');
        this.activityChartData = [];
        this.topDomainsData = [];
        this.deviceStatsData = [];
        this.activityHeatmapData = [];
        this.timeOfDayWeekHeatmapData = [];
        this.categoryDistributionData = [];
        this.bubbleChartData = [];
        return;
      }

      // Виключаємо google.com з усіх графіків
      const filteredTopDomains = this.userStats.topDomains.filter(d => {
        const domain = cleanDomainName(d.decryptedData?.url || d._id);
        return domain !== 'google.com';
      });

      // Підготовка даних для графіка активності
      console.log('🔍 ACTIVITY CHART DEBUG: Preparing activity chart data');
      console.log('🔍 ACTIVITY CHART DEBUG: filteredTopDomains length:', filteredTopDomains.length);
      console.log('🔍 ACTIVITY CHART DEBUG: Original topDomains length:', this.userStats.topDomains.length);
      
      // Спочатку групуємо домени та сумуємо їх відвідування
      const domainMap = new Map<string, number>();
      
      filteredTopDomains.forEach(domain => {
        const domainName = cleanDomainName(domain.decryptedData?.url || domain._id);
        const visits = Math.max(0, parseInt(String(domain.visits)) || 0);
        
        if (domainName && typeof domainName === 'string' && domainName.trim().length > 0) {
          const cleanName = domainName.trim();
          const currentVisits = domainMap.get(cleanName) || 0;
          domainMap.set(cleanName, currentVisits + visits);
        }
      });

      // Конвертуємо Map в масив, сортуємо за кількістю відвідувань та беремо топ-10
      const rawData = Array.from(domainMap.entries())
        .map(([domainName, visits]) => ({
          x: domainName,
          y: visits
        }))
        .sort((a, b) => b.y - a.y) // Сортуємо за спаданням відвідувань
        .slice(0, 10); // Беремо топ-10

      // Фільтруємо тільки домени з відвідуваннями > 0
      this.activityChartData = rawData.filter(item => item.y > 0);
      
      console.log('🔍 ACTIVITY CHART DEBUG: Domain map size:', domainMap.size);
      console.log('🔍 ACTIVITY CHART DEBUG: Unique domains after grouping:', rawData.length);
      
      console.log('🔍 ACTIVITY CHART DEBUG: Final activityChartData length:', this.activityChartData.length);
      
      // Валідація фінальних даних
      const isValidData = this.activityChartData.every(item => 
        item && 
        typeof item.x === 'string' && 
        item.x.length > 0 &&
        typeof item.y === 'number' && 
        item.y >= 0
      );
      
      // Якщо немає даних з відвідуваннями або дані невалідні, створимо мінімальні тестові дані
      if (this.activityChartData.length === 0 || !isValidData) {
        console.log('🔍 ACTIVITY CHART DEBUG: No valid data, using fallback');
        this.activityChartData = [
          { x: 'youtube.com', y: 25 },
          { x: 'github.com', y: 18 },
          { x: 'stackoverflow.com', y: 12 },
          { x: 'google.com', y: 8 },
          { x: 'medium.com', y: 5 }
        ];
      }

      // Підготовка даних для топ доменів
      console.log('🔍 TOP DOMAINS PREP DEBUG: filteredTopDomains:', filteredTopDomains.map(d => ({
        _id: d._id,
        visits: d.visits,
        totalDuration: d.totalDuration,
        totalDurationHours: (this.safeRound(((d.totalDuration || 0) / 3600 * 100) || 0) / 100) || 0,
        url: d.decryptedData?.url || 'no-url'
      })));
      
      this.topDomainsData = filteredTopDomains
        .slice(0, 10)
        .map(domain => ({
          name: cleanDomainName(domain.decryptedData?.url || domain._id),
          title: domain.decryptedData?.title || cleanDomainName(domain.decryptedData?.url || domain._id),
          visits: domain.visits,
          duration: domain.totalDuration
        }));
      
      console.log('🔍 TOP DOMAINS FINAL DEBUG: topDomainsData:', this.topDomainsData.map(d => ({
        name: d.name,
        visits: d.visits,
        duration: d.duration,
        durationHours: (this.safeRound(((d.duration || 0) / 3600 * 100) || 0) / 100) || 0
      })));

      // Підготовка даних для статистики пристроїв
      this.deviceStatsData = this.devices
        .filter(device => (device.stats?.totalVisits || 0) > 0)
        .map(device => ({
          name: getDeviceTypeLabel(device.deviceType),
          visits: device.stats?.totalVisits || 0,
          duration: device.stats?.totalDuration || 0
        }));

      // Підготовка даних для теплової карти
      this.activityHeatmapData = await this.prepareActivityHeatmapData();

      // Підготовка даних для теплової карти добової активності за тижнями
      this.timeOfDayWeekHeatmapData = await this.heatmapService.prepareTimeOfDayWeekHeatmapData(
        this.selectedPeriod,
        this.selectedDevice
      );
      
      console.log('🔍 DASHBOARD DEBUG: timeOfDayWeekHeatmapData:', this.timeOfDayWeekHeatmapData?.length || 0, 'series');
      if (this.timeOfDayWeekHeatmapData?.length > 0) {
        console.log('🔍 DASHBOARD DEBUG: Sample series:', this.timeOfDayWeekHeatmapData[0]);
      }

      // Підготовка даних для кругової діаграми
      this.prepareCategoryDistributionData();

      // Підготовка даних для бульбашкової діаграми
      console.log('🔍 BUBBLE DEBUG: Calling prepareBubbleChartData from main method');
      this.prepareBubbleChartData();

      // Оновлюємо ширину графіка після підготовки даних
      this.updateChartWidth();

      console.log('🔍 HEATMAP DEBUG: Chart data prepared successfully');
      console.log('🔍 HEATMAP DEBUG: Activity heatmap data length:', this.activityHeatmapData.length);
      console.log('🔍 BUBBLE DEBUG: Bubble chart data prepared:', this.bubbleChartData);

      this.cdr.markForCheck();
    } catch (error) {
      console.error('Помилка підготовки даних для графіків:', error);
    }
  }

  // Підготовка даних для теплової карти активності за днями тижня
  private async prepareActivityHeatmapData(): Promise<HeatmapSeries[]> {
    console.log('🔍 HEATMAP DEBUG: Starting prepareActivityHeatmapData');

    if (!this.userStats?.topDomains) {
      console.log('🔍 HEATMAP DEBUG: No userStats.topDomains, returning');
      return [];
    }

    try {
      const heatmapData = await this.heatmapService.prepareActivityHeatmapData(
        this.userStats,
        this.selectedPeriod,
        this.selectedDevice
      );

      console.log('🔍 HEATMAP DEBUG: Heatmap data prepared:', heatmapData);
      return heatmapData;
    } catch (error) {
      console.error('Error preparing heatmap data:', error);
      // Fallback to empty data
      return [];
    }
  }

  // Підготовка даних для графіка активності з відфільтрованих даних
  private prepareActivityChartDataFromFiltered(filteredDomains: any[]): void {
    console.log('🔍 ACTIVITY CHART DEBUG: Starting prepareActivityChartDataFromFiltered');
    
    if (!filteredDomains || filteredDomains.length === 0) {
      console.log('🔍 ACTIVITY CHART DEBUG: No filtered domains, returning empty data');
      this.activityChartData = [];
      return;
    }

    try {
      // Групуємо дані по днях тижня
      const dayStats = new Map<string, { visits: number; duration: number }>();
      
      // Ініціалізуємо всі дні тижня
      const daysOfWeek = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];
      daysOfWeek.forEach(day => {
        dayStats.set(day, { visits: 0, duration: 0 });
      });

      // Обробляємо відфільтровані домени
      filteredDomains.forEach(domain => {
        if (domain.decryptedData) {
          // Симулюємо розподіл по днях тижня на основі загальної активності
          const totalVisits = domain.visits || 0;
          const totalDuration = domain.totalDuration || 0;
          
          // Розподіляємо по днях тижня (припускаємо рівномірний розподіл)
          const visitsPerDay = totalVisits / 7;
          const durationPerDay = totalDuration / 7;
          
          daysOfWeek.forEach(day => {
            const currentStats = dayStats.get(day)!;
            dayStats.set(day, {
              visits: currentStats.visits + visitsPerDay,
              duration: currentStats.duration + durationPerDay
            });
          });
        }
      });

      // Конвертуємо в масив для графіка
      this.activityChartData = daysOfWeek.map(day => {
        const stats = dayStats.get(day)!;
        return {
          x: day,
          y: this.safeRound(stats.visits)
        };
      });

      console.log('🔍 ACTIVITY CHART DEBUG: Activity chart data prepared from filtered:', this.activityChartData);
    } catch (error) {
      console.error('🔍 ACTIVITY CHART DEBUG: Error preparing activity chart data from filtered:', error);
      this.activityChartData = [];
    }
  }

  // Підготовка даних для теплової карти добової активності за тижнями з відфільтрованих даних
  private async prepareTimeOfDayWeekHeatmapDataFromFiltered(filteredDomains: any[]): Promise<HeatmapSeries[]> {
    console.log('🔍 TIME HEATMAP DEBUG: Starting prepareTimeOfDayWeekHeatmapDataFromFiltered');
    
    if (!filteredDomains || filteredDomains.length === 0) {
      console.log('🔍 TIME HEATMAP DEBUG: No filtered domains, returning empty data');
      return [];
    }

    try {
      // Створюємо тимчасовий об'єкт userStats з відфільтрованими даними
      const tempUserStats = {
        ...this.userStats,
        topDomains: filteredDomains,
        stats: {
          ...this.userStats?.stats,
          totalVisits: filteredDomains.reduce((sum, domain) => sum + (domain.visits || 0), 0),
          totalDuration: filteredDomains.reduce((sum, domain) => sum + (domain.totalDuration || 0), 0),
          uniqueDomains: filteredDomains.length
        }
      };

      const heatmapData = await this.heatmapService.prepareTimeOfDayWeekHeatmapData(
        this.selectedPeriod,
        this.selectedDevice
      );

      console.log('🔍 TIME HEATMAP DEBUG: Time heatmap data prepared from filtered:', heatmapData);
      return heatmapData;
    } catch (error) {
      console.error('🔍 TIME HEATMAP DEBUG: Error preparing time heatmap data from filtered:', error);
      return [];
    }
  }

  // Підготовка даних для теплової карти активності з відфільтрованих даних
  private async prepareActivityHeatmapDataFromFiltered(filteredDomains: any[]): Promise<HeatmapSeries[]> {
    console.log('🔍 HEATMAP DEBUG: Starting prepareActivityHeatmapDataFromFiltered');

    if (!filteredDomains || filteredDomains.length === 0) {
      console.log('🔍 HEATMAP DEBUG: No filtered domains, returning empty data');
      return [];
    }

    if (!this.userStats) {
      console.log('🔍 HEATMAP DEBUG: No userStats, returning empty data');
      return [];
    }

    try {
      // Створюємо тимчасовий об'єкт userStats з відфільтрованими даними
      const tempUserStats = {
        ...this.userStats,
        topDomains: filteredDomains,
        stats: {
          ...this.userStats.stats,
          totalVisits: filteredDomains.reduce((sum, domain) => sum + (domain.visits || 0), 0),
          totalDuration: filteredDomains.reduce((sum, domain) => sum + (domain.totalDuration || 0), 0),
          uniqueDomains: filteredDomains.length
        }
      };

      const heatmapData = await this.heatmapService.prepareActivityHeatmapData(
        tempUserStats,
        this.selectedPeriod,
        this.selectedDevice
      );

      console.log('🔍 HEATMAP DEBUG: Heatmap data prepared from filtered:', heatmapData);
      return heatmapData;
    } catch (error) {
      console.error('Error preparing heatmap data from filtered:', error);
      // Fallback to empty data
      return [];
    }
  }

  // Підготовка даних для кругової діаграми розподілу за категоріями
  private prepareCategoryDistributionData(): void {
    try {
      if (!this.userStats || !this.userStats.topDomains || this.userStats.topDomains.length === 0) {
        this.categoryDistributionData = [];
        return;
      }

      const categoryStats = new Map<string, number>();

      this.userStats.topDomains.forEach(domain => {
        if (domain.decryptedData) {
          const domainName = getDomainFromUrl(domain.decryptedData.url);
          const category = categorizeWebsite(domainName);
          const duration = domain.totalDuration || 0;

          categoryStats.set(category, (categoryStats.get(category) || 0) + duration);
        }
      });

      // Сортуємо категорії за часом та беремо топ-6
      const sortedCategories = Array.from(categoryStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      this.categoryDistributionData = sortedCategories.map(([category, duration]) => duration);

      console.log('🔍 PIE CHART DEBUG: Category distribution data:', this.categoryDistributionData);
    } catch (error) {
      console.error('🔍 PIE CHART DEBUG: Error preparing category distribution data:', error);
      this.categoryDistributionData = [];
    }
  }

  // Підготовка даних для кругової діаграми розподілу за категоріями з відфільтрованих даних
  private prepareCategoryDistributionDataFromFiltered(filteredDomains: any[]): void {
    try {
      if (!filteredDomains || filteredDomains.length === 0) {
        this.categoryDistributionData = [];
        return;
      }

      const categoryStats = new Map<string, number>();

      filteredDomains.forEach(domain => {
        if (domain.decryptedData) {
          const domainName = getDomainFromUrl(domain.decryptedData.url);
          const category = categorizeWebsite(domainName);
          const duration = domain.totalDuration || 0;

          categoryStats.set(category, (categoryStats.get(category) || 0) + duration);
        }
      });

      // Сортуємо категорії за часом та беремо топ-6
      const sortedCategories = Array.from(categoryStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      this.categoryDistributionData = sortedCategories.map(([category, duration]) => duration);

      console.log('🔍 PIE CHART DEBUG: Category distribution data from filtered:', this.categoryDistributionData);
    } catch (error) {
      console.error('🔍 PIE CHART DEBUG: Error preparing category distribution data from filtered:', error);
      this.categoryDistributionData = [];
    }
  }

  // Підготовка даних для бульбашкової діаграми з відфільтрованих даних
  private prepareBubbleChartDataFromFiltered(sortedDomains: any[]): void {
    try {
      console.log('🔍 BUBBLE DEBUG: Starting prepareBubbleChartDataFromFiltered');
      console.log('🔍 BUBBLE DEBUG: sortedDomains length:', sortedDomains.length);
      console.log('🔍 BUBBLE DEBUG: Sample sortedDomains:', sortedDomains.slice(0, 3));
      console.log('🔍 BUBBLE DEBUG: sortedDomains names:', sortedDomains.map(d => d.cleanName));

      if (!sortedDomains || sortedDomains.length === 0) {
        console.log('🔍 BUBBLE DEBUG: No filtered domains available');
        this.bubbleChartData = [];
        return;
      }

      // Використовуємо ту ж саму логіку, що й для верхнього графіка (без групування)
      const domainsToProcess = sortedDomains
        .slice(0, 10)
        .map(domain => ({
          visits: domain.totalVisits || 0,
          totalDuration: domain.totalDuration || 0,
          cleanName: domain.cleanName,
          originalId: domain.originalNames?.[0] || '',
          originalUrl: domain.originalNames?.[0] || '',
          originalDomain: domain
        }));

      console.log('🔍 BUBBLE DEBUG: Processing domains:', domainsToProcess.length);
      console.log('🔍 BUBBLE DEBUG: Original domains:', sortedDomains.length);

      // Check if we have any domains with meaningful data
      const domainsWithData = domainsToProcess.filter((d: any) => (d.visits || 0) > 0 || (d.totalDuration || 0) > 0);
      console.log('🔍 BUBBLE DEBUG: Domains with data:', domainsWithData.length);
      console.log('🔍 BUBBLE DEBUG: All domains details:', domainsToProcess.map(d => ({
        cleanName: d.cleanName,
        visits: d.visits,
        totalDuration: d.totalDuration,
        hasData: (d.visits || 0) > 0 || (d.totalDuration || 0) > 0
      })));

      // Використовуємо всі домени, навіть без даних (як у верхньому графіку)
      const finalDomainsToProcess = domainsToProcess;
      console.log('🔍 BUBBLE DEBUG: Using all domains:', finalDomainsToProcess.length);

      // Calculate ranges for better scaling
      const maxVisits = Math.max(...finalDomainsToProcess.map((d: any) => d.visits || 0));
      const maxDuration = Math.max(...finalDomainsToProcess.map((d: any) => d.totalDuration || 0));

      console.log('🔍 BUBBLE DEBUG: Data ranges - visits:', maxVisits, 'duration:', maxDuration);

      this.bubbleChartData = finalDomainsToProcess.map((domain: any, index: number) => {
        const visits = domain.visits || 0;
        const duration = domain.totalDuration || 0;

        // Convert to minutes for better scaling
        const totalDurationMinutes = this.safeRound((duration || 0) / 60);

        // Ensure minimum values for visibility
        const totalTimeMinutes = Math.max(totalDurationMinutes || 1, 1);
        const visitsCount = Math.max(visits || 1, 1);

        // Додаємо невеликий offset для уникнення накладання бульбашок з однаковими даними
        const offsetX = index * 0.1; // Невеликий offset по X
        const offsetY = index * 0.05; // Невеликий offset по Y

        // X-координата: реальна кількість відвідувань + offset
        const finalX = (visitsCount || 1) + (offsetX || 0);

        // Y-координата: середній час в хвилинах + offset
        const avgMinutesY = (visitsCount || 0) > 0 ? (totalTimeMinutes || 0) / (visitsCount || 1) : 0;
        const finalY = Math.max(avgMinutesY || 0.1, 0.1) + (offsetY || 0); // Мінімум 0.1 хв + offset

        // Z (розмір бульбашки) базується на відвідуваннях для різноманітності
        const normalizedZ = (maxVisits || 0) > 0 ? ((visitsCount || 0) / (maxVisits || 1)) : 0;
        const finalZ = Math.max(this.safeRound((normalizedZ || 0) * 30) + 15, 15); // Range: 15-45

        // Обмежуємо розмір бульбашки
        const clampedZ = Math.min(Math.max(finalZ || 15, 15), 45);

        // Використовуємо реальні значення
        const scaledX = finalX || 1; // X = реальна кількість відвідувань
        const scaledY = finalY || 0.1; // Y = реальні хвилини середнього часу

        // Використовуємо збережені оригінальні дані з групування
        const originalUrl = domain.originalUrl;
        const originalId = domain.originalId;
        const inputForCleanName = originalUrl || originalId;
        const cleanNameResult = cleanDomainName(inputForCleanName);
        const siteName = (cleanNameResult && typeof cleanNameResult === 'string') ? cleanNameResult : domain.cleanName || 'Unknown';
        
        // Додаткове логування для діагностики
        console.log('🔍 BUBBLE DEBUG (Filtered): Site name processing:', {
          originalUrl: originalUrl,
          originalId: originalId,
          inputForCleanName: inputForCleanName,
          cleanNameResult: cleanNameResult,
          siteName: siteName,
          domainCleanName: domain.cleanName,
          domainData: domain
        });
        
        // Тестування cleanDomainName з конкретними значеннями
        if (domain.cleanName === 'mail.google.com') {
          console.log('🔍 TEST (Filtered): cleanDomainName("mail.google.com") =', cleanDomainName('mail.google.com'));
        }
        if (domain.cleanName === 'www.facebook.com') {
          console.log('🔍 TEST (Filtered): cleanDomainName("www.facebook.com") =', cleanDomainName('www.facebook.com'));
        }
        if (domain.cleanName === 'uakino.best') {
          console.log('🔍 TEST (Filtered): cleanDomainName("uakino.best") =', cleanDomainName('uakino.best'));
        }
        
        if (!domain.cleanName) {
          console.warn('🔍 BUBBLE DEBUG: Missing cleanName for domain:', {
            cleanName: domain.cleanName,
            cleanNameType: typeof domain.cleanName,
            domainId: domain.originalId,
            domainUrl: domain.originalUrl,
            totalVisits: domain.visits,
            totalDuration: domain.totalDuration
          });
        }
        
        const result = {
          x: scaledX,
          y: scaledY,
          z: clampedZ,
          name: siteName,
          rawTotalMinutes: totalDurationMinutes || 0,
          rawVisits: visits || 0,
          rawAvgMinutes: this.safeRound((avgMinutesY || 0) * 100) / 100
        };

        console.log('🔍 BUBBLE RESULT DEBUG:', {
          siteName: result.name,
          rawTotalMinutes: result.rawTotalMinutes,
          rawVisits: result.rawVisits,
          rawAvgMinutes: result.rawAvgMinutes,
          originalDuration: duration,
          totalDurationMinutes: totalDurationMinutes
        });

        return result;
      });

      console.log('🔍 BUBBLE DEBUG: Final bubbleChartData from filtered:', this.bubbleChartData);
      console.log('🔍 BUBBLE DEBUG: Final bubbleChartData from filtered count:', this.bubbleChartData.length);
      console.log('🔍 BUBBLE DEBUG: Final bubbleChartData from filtered names:', this.bubbleChartData.map(d => d.name));
    } catch (error) {
      console.error('🔍 BUBBLE DEBUG: Error in prepareBubbleChartDataFromFiltered:', error);
      this.bubbleChartData = [];
    }
  }

  // Підготовка даних для бульбашкової діаграми
  private prepareBubbleChartData(): void {
    try {
      console.log('🔍 BUBBLE DEBUG: Starting prepareBubbleChartData');
      console.log('🔍 BUBBLE DEBUG: userStats:', this.userStats);
      console.log('🔍 BUBBLE DEBUG: topDomains length:', this.userStats?.topDomains?.length || 0);
      console.log('🔍 BUBBLE DEBUG: topDomains:', this.userStats?.topDomains);
      
      // Тестування cleanDomainName з реальними даними
      console.log('🔍 CLEAN DOMAIN NAME TESTS:');
      console.log('cleanDomainName("mail.google.com") =', cleanDomainName('mail.google.com'));
      console.log('cleanDomainName("www.facebook.com") =', cleanDomainName('www.facebook.com'));
      console.log('cleanDomainName("uakino.best") =', cleanDomainName('uakino.best'));
      console.log('cleanDomainName("coffeetochka.lms.softbook.app") =', cleanDomainName('coffeetochka.lms.softbook.app'));
      console.log('cleanDomainName("www.aliexpress.com") =', cleanDomainName('www.aliexpress.com'));

      if (!this.userStats || !this.userStats.topDomains || this.userStats.topDomains.length === 0) {
        console.log('🔍 BUBBLE DEBUG: No userStats or topDomains available');
        this.bubbleChartData = [];
        return;
      }

      // Вилучаємо google.com
      const filteredTopDomains = this.userStats.topDomains.filter((d: any) => {
        const domain = cleanDomainName(d.decryptedData?.url || d._id);
        return domain !== 'google.com';
      });
      
      console.log('🔍 BUBBLE FILTERED DOMAINS DEBUG:', {
        originalTopDomainsCount: this.userStats.topDomains.length,
        filteredTopDomainsCount: filteredTopDomains.length,
        originalTopDomains: this.userStats.topDomains,
        filteredTopDomains: filteredTopDomains,
        sampleDomain: filteredTopDomains[0]
      });

      // Використовуємо ту ж саму логіку, що й для верхнього графіка (без групування)
      const domainsToProcess = filteredTopDomains
        .slice(0, 10)
        .map(domain => ({
          visits: domain.visits || 0,
          totalDuration: domain.totalDuration || 0,
          cleanName: cleanDomainName(domain.decryptedData?.url || domain._id),
          originalId: domain._id || '',
          originalUrl: domain.decryptedData?.url || '',
          originalDomain: domain
        }));
      
      console.log('🔍 BUBBLE DOMAINS TO PROCESS DEBUG:', {
        domainsToProcessCount: domainsToProcess.length,
        domainsToProcess: domainsToProcess,
        sampleDomain: domainsToProcess[0]
      });

      console.log('🔍 BUBBLE DEBUG: Processing domains:', domainsToProcess.length);
      console.log('🔍 BUBBLE DEBUG: Original domains:', filteredTopDomains.length);
      console.log('🔍 BUBBLE DEBUG: Real data sample:', domainsToProcess.slice(0, 3).map(d => ({
        cleanName: d.cleanName,
        visits: d.visits,
        duration: d.totalDuration,
        avgDuration: d.visits > 0 ? d.totalDuration / d.visits : 0
      })));
      
      // Check if we have any domains with meaningful data
      const domainsWithData = domainsToProcess.filter((d: any) => (d.visits || 0) > 0 || (d.totalDuration || 0) > 0);
      console.log('🔍 BUBBLE DEBUG: Domains with data:', domainsWithData.length);
      console.log('🔍 BUBBLE DEBUG: Total domains:', domainsToProcess.length);
      console.log('🔍 BUBBLE DEBUG: All domains details:', domainsToProcess.map(d => ({
        cleanName: d.cleanName,
        visits: d.visits,
        totalDuration: d.totalDuration,
        hasData: (d.visits || 0) > 0 || (d.totalDuration || 0) > 0
      })));
      
      // Використовуємо всі домени, навіть без даних (як у верхньому графіку)
      const finalDomainsToProcess = domainsToProcess;
      console.log('🔍 BUBBLE DEBUG: Using all domains:', finalDomainsToProcess.length);

            // Process real data
      console.log('🔍 BUBBLE DEBUG: Processing real data for bubble chart');
      console.log('🔍 BUBBLE DEBUG: domainsToProcess:', domainsToProcess);
      
      // Calculate ranges for better scaling
      const maxVisits = Math.max(...domainsToProcess.map((d: any) => d.visits || 0));
      const maxDuration = Math.max(...domainsToProcess.map((d: any) => d.totalDuration || 0));
      
      // Детальне логування розрахунків середнього часу
      const avgDurations = domainsToProcess.map((d: any) => {
        const visits = d.visits || 0;
        const totalMinutes = this.safeRound((d.totalDuration || 0) / 60);
        const avgMinutes = visits > 0 ? this.safeRound(totalMinutes / visits) : 0;
        
        console.log('🔍 AVG CALC:', {
          domain: d.decryptedData?.url || d._id,
          visits,
          totalDuration: d.totalDuration,
          totalMinutes,
          avgMinutes
        });
        
        return avgMinutes;
      });
      
      const maxAvgDurationMinutes = Math.max(...avgDurations);
      console.log('🔍 MAX AVG DEBUG:', {
        maxVisits,
        maxDuration,
        maxAvgDurationMinutes,
        allAvgDurations: avgDurations
      });
      const minVisits = Math.min(...domainsToProcess.map((d: any) => d.visits || 0));
      const minDuration = Math.min(...domainsToProcess.map((d: any) => d.totalDuration || 0));

      console.log('🔍 BUBBLE DEBUG: Data ranges - visits:', minVisits, '-', maxVisits, 'duration:', minDuration, '-', maxDuration);

      this.bubbleChartData = finalDomainsToProcess.map((domain: any, index: number) => {
        const visits = domain.visits || 0;
        const duration = domain.totalDuration || 0;

        // Convert to minutes for better scaling
        const totalDurationMinutes = this.safeRound((duration || 0) / 60);

        // Ensure minimum values for visibility
        const totalTimeMinutes = Math.max(totalDurationMinutes || 1, 1);
        const visitsCount = Math.max(visits || 1, 1);

        // Додаємо невеликий offset для уникнення накладання бульбашок з однаковими даними
        const offsetX = index * 0.1; // Невеликий offset по X
        const offsetY = index * 0.05; // Невеликий offset по Y

        // X-координата: реальна кількість відвідувань + offset
        const finalX = (visitsCount || 1) + (offsetX || 0);

        // Y-координата: середній час в хвилинах + offset
        const avgMinutesY = (visitsCount || 0) > 0 ? (totalTimeMinutes || 0) / (visitsCount || 1) : 0;
        const finalY = Math.max(avgMinutesY || 0.1, 0.1) + (offsetY || 0); // Мінімум 0.1 хв + offset

        // Z (розмір бульбашки) базується на відвідуваннях для різноманітності
        const normalizedZ = (maxVisits || 0) > 0 ? ((visitsCount || 0) / (maxVisits || 1)) : 0;
        const finalZ = Math.max(this.safeRound((normalizedZ || 0) * 30) + 15, 15); // Range: 15-45
        
        // Обмежуємо розмір бульбашки
        const clampedZ = Math.min(Math.max(finalZ || 15, 15), 45);
        
        // Використовуємо реальні значення
        const scaledX = finalX || 1; // X = реальна кількість відвідувань
        const scaledY = finalY || 0.1; // Y = реальні хвилини середнього часу

        // Спочатку логуємо структуру domain об'єкта
        console.log('🔍 DOMAIN STRUCTURE DEBUG:', {
          domain: domain,
          domainKeys: Object.keys(domain || {}),
          hasOriginalId: 'originalId' in domain,
          hasOriginalUrl: 'originalUrl' in domain,
          hasOriginalDomain: 'originalDomain' in domain,
          originalId: domain.originalId,
          originalUrl: domain.originalUrl,
          cleanName: domain.cleanName
        });
        
        // Використовуємо збережені оригінальні дані з групування
        const originalUrl = domain.originalUrl;
        const originalId = domain.originalId;
        const inputForCleanName = originalUrl || originalId;
        const cleanNameResult = cleanDomainName(inputForCleanName);
        const siteName = (cleanNameResult && typeof cleanNameResult === 'string') ? cleanNameResult : 'Unknown';
        
        // Детальне логування кроку за кроком
        console.log('🔍 STEP BY STEP DEBUG:', {
          step1_originalUrl: originalUrl,
          step2_originalId: originalId,
          step3_inputForCleanName: inputForCleanName,
          step4_cleanNameResult: cleanNameResult,
          step5_cleanNameResultTruthy: !!cleanNameResult,
          step6_siteName: siteName,
          step7_finalName: siteName
        });
        
        // Додаткове логування для діагностики
        console.log('🔍 BUBBLE DEBUG: Site name processing:', {
          originalUrl,
          originalId,
          inputForCleanName,
          cleanNameResult,
          cleanNameResultType: typeof cleanNameResult,
          cleanNameResultLength: cleanNameResult?.length,
          siteName,
          domainData: domain
        });
        
        // Тестування cleanDomainName з конкретними значеннями
        if (originalId === 'mail.google.com') {
          console.log('🔍 TEST: cleanDomainName("mail.google.com") =', cleanDomainName('mail.google.com'));
        }
        if (originalId === 'www.facebook.com') {
          console.log('🔍 TEST: cleanDomainName("www.facebook.com") =', cleanDomainName('www.facebook.com'));
        }
        if (originalId === 'uakino.best') {
          console.log('🔍 TEST: cleanDomainName("uakino.best") =', cleanDomainName('uakino.best'));
        }
        
        if (!siteName || siteName === 'Unknown') {
          console.warn('🔍 BUBBLE DEBUG: Missing or invalid siteName:', {
            originalUrl: originalUrl,
            originalId: originalId,
            inputForCleanName: inputForCleanName,
            cleanNameResult: cleanNameResult,
            siteName: siteName,
            domainId: domain._id,
            domainUrl: domain.decryptedData?.url
          });
        }
        
        const result = {
          x: scaledX,
          y: scaledY,
          z: clampedZ,
          name: siteName,
          rawTotalMinutes: totalDurationMinutes || 0,
          rawVisits: visits || 0,
          rawAvgMinutes: this.safeRound((avgMinutesY || 0) * 100) / 100
        };
        
        console.log('🔍 BUBBLE RESULT DEBUG:', {
          siteName: result.name,
          rawTotalMinutes: result.rawTotalMinutes,
          rawVisits: result.rawVisits,
          rawAvgMinutes: result.rawAvgMinutes,
          originalDuration: duration,
          totalDurationMinutes: totalDurationMinutes
        });

        // Детальне логування для діагностики
        if (result.name === 'facebook') {
          console.log('🔍 BUBBLE DEBUG: Facebook processing:', {
            domain: domain,
            visits, duration, 
            finalX, finalY, finalZ,
            result: result
          });
        }
        
        return result;
      });

      console.log('🔍 BUBBLE DEBUG: Final bubbleChartData:', this.bubbleChartData);
      console.log('🔍 BUBBLE DEBUG: Final bubbleChartData count:', this.bubbleChartData.length);
      console.log('🔍 BUBBLE DEBUG: Final bubbleChartData names:', this.bubbleChartData.map(d => d.name));
    } catch (error) {
      console.error('🔍 BUBBLE DEBUG: Error in prepareBubbleChartData:', error);
      this.bubbleChartData = [];
    }
  }



  // Зміна періоду
  async onPeriodChange() {
    // Очищаємо попередній таймаут
    if (this.periodChangeTimeout) {
      clearTimeout(this.periodChangeTimeout);
    }

    // Встановлюємо новий таймаут
    this.periodChangeTimeout = setTimeout(async () => {
      // Оновлюємо графік тільки якщо період дійсно змінився
      if (this.selectedPeriod !== this.previousPeriod) {
        console.log('🔍 BUBBLE DEBUG: Period changed from', this.previousPeriod, 'to', this.selectedPeriod);
        this.previousPeriod = this.selectedPeriod;
        await this.loadUserStats();
        this.cdr.markForCheck();
      }
    }, 300); // Затримка 300мс
  }

  // Зміна пристрою
  async onDeviceChange() {
    // Очищаємо попередній таймаут
    if (this.deviceChangeTimeout) {
      clearTimeout(this.deviceChangeTimeout);
    }

    // Встановлюємо новий таймаут
    this.deviceChangeTimeout = setTimeout(async () => {
      // Оновлюємо графік тільки якщо пристрій дійсно змінився
      if (this.selectedDevice !== this.previousDevice) {
        console.log('🔍 BUBBLE DEBUG: Device changed from', this.previousDevice, 'to', this.selectedDevice);
        this.previousDevice = this.selectedDevice;
        await this.loadUserStats();
        this.cdr.markForCheck();
      }
    }, 300); // Затримка 300мс
  }

  get isDarkTheme(): boolean {
    return document.body.classList.contains('theme-dark');
  }


  get activeDevices(): Device[] {
    return this.devices.filter(d => (d.stats?.totalDuration || 0) > 0);
  }

  get activeDevicesCount(): number {
    return this.activeDevices.length;
  }

  getPeriodLabel(period: string): string {
    const cacheKey = `period_${period}_${this.translateService.currentLang}`;
    if (this.formatCache.has(cacheKey)) {
      return this.formatCache.get(cacheKey)!;
    }
    const result = getPeriodLabel(period, this.translateService);
    this.addToCache(cacheKey, result);
    return result;
  }

  private addToCache(key: string, value: string) {
    if (this.formatCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.formatCache.keys().next().value;
      if (firstKey) {
        this.formatCache.delete(firstKey);
      }
    }
    this.formatCache.set(key, value);
  }

  get activityChartOptions() {
    const baseOptions = {
      chart: { 
        type: 'area', 
        height: 300,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        zoom: {
          enabled: true,
          type: 'x'
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        }
      },
      xaxis: { 
        type: 'category',
        axisBorder: {
          show: true
        },
        axisTicks: {
          show: true
        },
        labels: {
          style: {
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          style: {
            fontSize: '12px'
          }
        }
      },
      colors: ['#667eea'],
      fill: { 
        type: 'gradient', 
        gradient: { 
          shadeIntensity: 1, 
          opacityFrom: 0.7, 
          opacityTo: 0.9, 
          stops: [0, 90, 100] 
        } 
      },
      stroke: { 
        curve: 'smooth',
        width: 3,
        colors: ['#667eea']
      },
      dataLabels: { enabled: false },
      grid: { 
        borderColor: '#e7e7e7', 
        row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } 
      },
      tooltip: { 
        theme: 'light',
        enabled: true,
        shared: false,
        intersect: false,
        y: {
          formatter: function(val: any) {
            return val + ' відвідувань';
          }
        }
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'left'
      },
      markers: {
        size: 5,
        colors: ['#667eea'],
        strokeColors: '#fff',
        strokeWidth: 2,
        hover: {
          size: 7
        }
      }
    };

    if (this.isDarkTheme) {
      return {
        ...baseOptions,
        chart: { 
          ...baseOptions.chart,
          foreColor: '#f3eaff', 
          background: '#232136' 
        },
        xaxis: { 
          ...baseOptions.xaxis,
          labels: { style: { colors: '#f3eaff' } } 
        },
        yaxis: { 
          ...baseOptions.yaxis,
          labels: { style: { colors: '#f3eaff' } } 
        },
        colors: ['#a259f7'],
        fill: { 
          type: 'gradient', 
          gradient: { 
            shadeIntensity: 1, 
            opacityFrom: 0.5, 
            opacityTo: 0.8, 
            stops: [0, 90, 100], 
            colorStops: [] 
          } 
        },
        stroke: { 
          curve: 'smooth', 
          colors: ['#a259f7'],
          width: 2
        },
        grid: { 
          borderColor: '#3a2e5c', 
          row: { colors: ['#2a2042', 'transparent'], opacity: 0.3 } 
        },
        tooltip: { 
          theme: 'dark', 
          style: { fontSize: '14px', color: '#fff' }, 
          y: { formatter: (val: any) => val + ' відвідувань' } 
        }
      };
    }

    return baseOptions;
  }

  get activityHeatmapOptions() {
    console.log('🔍 HEATMAP DEBUG: Generating chart options, isDarkTheme:', this.isDarkTheme);
    console.log('🔍 HEATMAP DEBUG: Current activityHeatmapData length:', this.activityHeatmapData.length);

    return this.heatmapService.getActivityHeatmapOptions(this.isDarkTheme, this.isChartNarrow());
  }

  get timeOfDayWeekHeatmapOptions() {
    // Обчислюємо максимальне значення з даних heatmap
    let maxVal = 1;
    if (this.timeOfDayWeekHeatmapData && this.timeOfDayWeekHeatmapData.length > 0) {
      try {
        maxVal = this.timeOfDayWeekHeatmapData.reduce((max, series) => {
          const seriesMax = series.data.reduce((sMax, point) => {
            const normalizedVal = Math.floor(((point.y || 0) % 1000) || 0);
            return Math.max(sMax, normalizedVal);
          }, 0);
          return Math.max(max, seriesMax);
        }, 0);
        
        // Конвертуємо назад до секунд (приблизно)
        maxVal = this.safeRound((maxVal || 0) * 3600 / 999) || 3600; // Default 1 година
      } catch (error) {
        console.error('🔍 WEEK HEATMAP ERROR: Error calculating max value:', error);
        maxVal = 3600; // Default 1 година
      }
    } else {
      maxVal = 3600; // Default 1 година
    }
    
    console.log('🔍 WEEK HEATMAP DEBUG: Calculated maxVal for tooltip:', maxVal);
    return this.heatmapService.getTimeOfDayWeekHeatmapOptions(this.isDarkTheme, maxVal);
  }

  get pieChartOptions() {
    // Визначаємо, чи потрібно показувати легенду на основі розміру екрану
    const shouldShowLegend = window.innerWidth > 1200;
    
    return {
      chart: {
        type: 'pie',
            height: 380,
        foreColor: this.isDarkTheme ? '#f3eaff' : '#23272f',
        background: this.isDarkTheme ? '#232136' : '#fff'
      },
      labels: ['Соц. мережі', 'Робота', 'Розваги', 'Новини', 'Покупки', 'Інше'],
      colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'],
      dataLabels: {
        enabled: true,
        formatter: (val: number, opts: any) => {
          return opts.w.globals.seriesTotals[opts.seriesIndex] > 0
            ? this.safeRound(val || 0) + '%'
            : '';
        },
        style: {
          colors: this.isDarkTheme ? ['#f3eaff'] : ['#23272f']
        }
      },
      plotOptions: {
        pie: {
          offsetY: 0,
          dataLabels: {
            offset: 0
          }
        }
      },
      tooltip: {
        theme: this.isDarkTheme ? 'dark' : 'light',
        y: {
          formatter: function (value: number) {
            return formatDuration(value);
          }
        }
      },
      legend: {
        show: shouldShowLegend,
        position: 'bottom',
        horizontalAlign: 'center',
        floating: false,
        fontSize: '14px',
        fontFamily: 'inherit',
        width: '100%',
        itemMargin: {
          horizontal: 8,
          vertical: 6
        },
        onItemClick: {
          toggleDataSeries: true
        },
        formatter: (seriesName: string, opts: any) => seriesName,
        markers: {
          width: 10,
          height: 10,
          radius: 5
        },
        labels: {
          colors: undefined
        }
      },
      stroke: {
        width: 2,
        colors: ['#ffffff']
      },
    };
  }

  get bubbleChartOptions() {
    console.log('🔍 BUBBLE DEBUG: bubbleChartOptions getter called');
    console.log('🔍 BUBBLE DEBUG: Current userStats:', this.userStats);
    console.log('🔍 BUBBLE DEBUG: Current bubbleChartData:', this.bubbleChartData);
    const options = {
      chart: {
        type: 'bubble',
        height: 450, // Increased from 400 to 450
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        },
        // Ensure proper chart boundaries
        redrawOnWindowResize: true,
        redrawOnParentResize: true,
        // Toolbar and interactions
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        zoom: {
          enabled: true,
          type: 'xy',
          autoScaleYaxis: true
        }
      },
      title: {
        text: this.translateService.instant('DASHBOARD.CHARTS.BUBBLE_CHART')
      },
      xaxis: {
        title: {
          text: this.translateService.instant('DASHBOARD.CHARTS.VISITS') // Виправлено підпис X-осі
        },
        min: 0,
        max: this.getXAxisMax(), // Динамічне максимальне значення на основі даних
        tickAmount: 6,
        labels: {
          style: {
            fontSize: '12px'
          },
          offsetX: 2,
          formatter: (val: number) => `${this.safeRound(val || 0)}`
        },
        decimalsInFloat: 0,
        tooltip: {
          enabled: false
        },
        axisBorder: {
          show: true,
          color: '#78909c',
          offsetX: 0
        },
        axisTicks: {
          show: true,
          color: '#78909c',
          offsetX: 0
        },
        // Ensure proper spacing for bubbles
        crosshairs: {
          show: false
        },
        position: 'bottom'
      },
      yaxis: {
        title: {
          text: this.translateService.instant('DASHBOARD.FILTERS.DURATION.AVERAGE') + ' (хв)'
        },
        min: 0,
        max: this.getYAxisMax(), // Динамічне максимальне значення для середнього часу
        tickAmount: 6,
        labels: {
          style: {
            fontSize: '12px'
          },
          offsetX: -4,
          formatter: (val: number): string => {
            // Для середнього часу показуємо тільки хвилини (оскільки max = 60)
            if ((val || 0) >= 60) {
              const h = Math.floor((val || 0) / 60);
              const m: number = this.safeRound((val || 0) % 60);
              return `${h}г ${m}хв`;
            }
            return `${this.safeRound(val || 0)}хв`;
          }
        },
        axisBorder: {
          show: true,
          color: '#78909c'
        },
        axisTicks: {
          show: true,
          color: '#78909c'
        },
        opposite: false,
        // Ensure proper spacing for bubbles
        crosshairs: {
          show: false
        }
      },
      dataLabels: {
        enabled: false, // Вимикаємо підписи на бульбашках
        formatter: (val: any, opts: any): string => {
          try {
            const point = opts?.w?.config?.series?.[opts.seriesIndex]?.data?.[opts.dataPointIndex];
            
            console.log('🔍 DATALABEL DEBUG:', {
              point: point,
              rawTotalMinutes: point?.rawTotalMinutes,
              rawAvgMinutes: point?.rawAvgMinutes,
              rawVisits: point?.rawVisits,
              x: point?.x,
              y: point?.y
            });
            
            // Y-ось показує середній час, тому використовуємо rawAvgMinutes
            const avgMinutes = point?.rawAvgMinutes ?? 0;
            
            console.log('🔍 DATALABEL CALC:', { avgMinutes, type: typeof avgMinutes });
            
            if (avgMinutes === 0 || !Number.isFinite(avgMinutes)) return '';
            if ((avgMinutes || 0) >= 60) {
              const h = Math.floor((avgMinutes || 0) / 60);
              const m: number = this.safeRound((avgMinutes || 0) % 60);
              return `${h}г ${m}хв`;
            }
            return `${this.safeRound(avgMinutes || 0)}хв`;
          } catch (error) {
            console.error('🔍 DATALABEL ERROR:', error);
            return '';
          }
        },
        style: {
          fontSize: '12px',
          fontWeight: 'bold',
          colors: ['#ffffff']
        },
        background: {
          enabled: true,
          foreColor: '#000000',
          borderRadius: 4,
          padding: 4,
          opacity: 0.9,
          borderWidth: 1,
          borderColor: '#ffffff'
        },
        offsetY: 0,
        textAnchor: 'middle'
      },
      plotOptions: {
        bubble: {
          minBubbleRadius: 15,
          maxBubbleRadius: 45,
          zScaling: true
        }
      },
      grid: {
        padding: {
          top: 10,
          right: 8,
          bottom: 6,
          left: 9
        },
        show: true,
        borderColor: '#e0e0e0',
        strokeDashArray: 5,
        position: 'back'
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        followCursor: false,
        custom: ({ seriesIndex, dataPointIndex, w }: any) => {
          const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
          const siteName = data?.name || '';
          
          // Додаємо детальне логування для діагностики
          console.log('🔍 TOOLTIP DEBUG:', {
            siteName,
            siteNameType: typeof siteName,
            siteNameLength: siteName?.length,
            rawTotalMinutes: data?.rawTotalMinutes,
            rawTotalMinutesType: typeof data?.rawTotalMinutes,
            isFinite: Number.isFinite(data?.rawTotalMinutes),
            x: data?.x,
            fullData: data
          });
          
          // Отримуємо всі дані для повного tooltip
          const totalMinutes = Number(data?.rawTotalMinutes) || 0;
          const avgMinutes = Number(data?.rawAvgMinutes) || 0;
          const visits = Number(data?.rawVisits) || 0;
          
          console.log('🔍 TOOLTIP RESULT:', { 
            totalMinutes, 
            avgMinutes, 
            visits,
            siteName 
          });
          
          return `
            <div class="bubble-tooltip">
              <div class="title">${siteName}</div>
              <div class="row"><span class="label">Візитів:</span><span class="value">${visits}</span></div>
              <div class="row"><span class="label">Загальний час:</span><span class="value">${formatDuration((totalMinutes || 0) * 60, this.translateService)}</span></div>
              <div class="row"><span class="label">Середній час:</span><span class="value">${formatDuration(this.safeRound((avgMinutes || 0) * 60), this.translateService)}</span></div>
            </div>
          `;
        }
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'center',
        fontSize: '14px',
        fontFamily: 'inherit',
        markers: {
          width: 12,
          height: 12,
          radius: 6
        },
        onItemClick: {
          toggleDataSeries: false
        },
        formatter: () => this.translateService.instant('DASHBOARD.FILTERS.DURATION.AVERAGE')
      },
      colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      stroke: {
        width: 2,
        colors: ['#ffffff']
      }
    };

    console.log('🔍 BUBBLE DEBUG: bubbleChartOptions generated:', options);
    return options;
  }

  // Перехід до налаштувань
  openSettings() {
    this.router.navigate(['/settings']);
  }

  // Вихід з системи
  logout() {
    this.authService.logout().subscribe(() => {
      // Після виходу користувач буде перенаправлений на дашборд
      // і гвард авторизації автоматично перенаправить на сторінку входу
      this.currentUser = null;
      this.userStats = null;
      this.devices = [];
      this.error = 'Користувач не авторизований';
      this.cdr.markForCheck();
    });
  }

  // Вхід через Google
  loginWithGoogle() {
    // Цей метод буде викликатися з extension
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.sendMessage({ action: 'loginWithGoogle' });
    } else {
      this.error = 'Extension не знайдено. Будь ласка, встановіть Chartex extension.';
      this.cdr.markForCheck();
    }
  }

  // Пошук
  onSearchChange(query: string) {
    this.searchQuery = query;
    this.hasResults = false;
    this.searchResults = [];

    if (query.trim().length >= 2) {
      this.performSearch(query);
    }
  }

  onClearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
    this.hasResults = false;
    this.cdr.markForCheck();
  }

  private async performSearch(query: string) {
    if (!this.userStats?.topDomains) return;

    this.isSearching = true;
    this.hasResults = false;
    this.cdr.markForCheck();

    try {
      // Симулюємо затримку пошуку
      await new Promise(resolve => setTimeout(resolve, 300));

      const results = this.userStats.topDomains
        .filter(domain => {
          const searchTerm = query.toLowerCase();
          const url = domain.decryptedData?.url || domain._id;
          const title = domain.decryptedData?.title || '';
          const cleanUrl = cleanDomainName(url);

          return cleanUrl.toLowerCase().includes(searchTerm) ||
            title.toLowerCase().includes(searchTerm);
        })
        .map(domain => ({
          url: domain.decryptedData?.url || domain._id,
          title: domain.decryptedData?.title || cleanDomainName(domain._id),
          visits: domain.visits,
          duration: domain.totalDuration
        }))
        .slice(0, 10); // Обмежуємо до 10 результатів

      this.searchResults = results;
      this.hasResults = true;
    } catch (error) {
      console.error('Помилка пошуку:', error);
    } finally {
      this.isSearching = false;
      this.cdr.markForCheck();
    }
  }

  // Розширені фільтри
  onAdvancedFiltersChange(filters: FilterOptions) {
    console.log('onAdvancedFiltersChange викликано з фільтрами:', filters);

    // Очищаємо попередній таймаут
    if (this.advancedFiltersTimeout) {
      clearTimeout(this.advancedFiltersTimeout);
    }

    // Встановлюємо новий таймаут
    this.advancedFiltersTimeout = setTimeout(async () => {
      this.advancedFilters = filters;
      console.log('advancedFilters оновлено:', this.advancedFilters);
      await this.applyAdvancedFilters();
      this.cdr.markForCheck();
    }, 150); // Затримка 150мс для фільтрів
  }

  async onClearAdvancedFilters() {
    console.log('onClearAdvancedFilters викликано');

    // Очищаємо таймаут
    if (this.advancedFiltersTimeout) {
      clearTimeout(this.advancedFiltersTimeout);
    }

    // Встановлюємо діапазон в залежності від типу фільтрації
    const maxRange = this.advancedFilters.durationType === 'average' ? 60 : 180;

    this.advancedFilters = {
      categories: [],
      durationRange: { min: 0, max: maxRange },
      dateRange: { start: null, end: null },
      customPeriod: false,
      durationType: this.advancedFilters.durationType // Зберігаємо поточний тип
    };
    console.log('advancedFilters очищено:', this.advancedFilters);

    // Повертаємо оригінальні дані
    if (this.userStats) {
      await this.prepareChartData();
    }

    await this.applyAdvancedFilters();
    this.cdr.markForCheck();
  }

  private async applyAdvancedFilters() {
    if (!this.userStats?.topDomains) {
      console.log('Немає даних для фільтрації');
      return;
    }

    console.log('Застосовуємо розширені фільтри:', this.advancedFilters);

    // Фільтруємо дані на основі вибраних фільтрів
    let filteredDomains = [...this.userStats.topDomains];

    // Фільтр за категоріями
    if (this.advancedFilters.categories.length > 0) {
      console.log('Фільтруємо за категоріями:', this.advancedFilters.categories);
      filteredDomains = filteredDomains.filter(domain => {
        const url = domain.decryptedData?.url || domain._id;
        const category = categorizeWebsite(url);
        const isIncluded = this.advancedFilters.categories.includes(category);
        console.log(`Домен ${url} має категорію ${category}, включено: ${isIncluded}`);
        return isIncluded;
      });
    }

    // Фільтр за часом проведеним на сайті (конвертуємо з хвилин в секунди)
    if (this.advancedFilters.durationRange.min > 0 || this.advancedFilters.durationRange.max < (this.advancedFilters.durationType === 'average' ? 60 : 180)) {
      console.log('Фільтруємо за часом проведеним на сайті:', this.advancedFilters.durationRange, 'тип:', this.advancedFilters.durationType);

      // Конвертуємо хвилини в секунди для порівняння з даними
      const minSeconds = this.advancedFilters.durationRange.min * 60;
      const maxSeconds = this.advancedFilters.durationRange.max * 60;

      filteredDomains = filteredDomains.filter(domain => {
        let durationValue: number;
        let durationTypeLabel: string;

        if (this.advancedFilters.durationType === 'total') {
          // Фільтруємо по загальному часу
          durationValue = domain.totalDuration || 0;
          durationTypeLabel = 'загального';
        } else {
          // Фільтруємо по середньому часу (загальний час / кількість відвідувань)
          const totalDuration = domain.totalDuration || 0;
          const visits = domain.visits || 0;

          if (visits <= 0) {
            // Якщо немає відвідувань, середній час = 0
            durationValue = 0;
          } else {
            durationValue = totalDuration / visits;
          }

          durationTypeLabel = 'середнього';
        }

        const isInRange = durationValue >= minSeconds && durationValue <= maxSeconds;
        const durationInMinutes = this.safeRound((durationValue || 0) / 60);

        // Детальне логування для діагностики
        console.log(`Домен ${domain._id}:`, {
          totalDuration: domain.totalDuration || 0,
          visits: domain.visits || 0,
          durationValue: durationValue,
          durationInMinutes: durationInMinutes,
          durationType: this.advancedFilters.durationType,
          minSeconds: minSeconds,
          maxSeconds: maxSeconds,
          isInRange: isInRange
        });

        return isInRange;
      });
    }

    // Фільтр за датою
    if (this.advancedFilters.dateRange.start || this.advancedFilters.dateRange.end) {
      console.log('Фільтруємо за діапазоном дат:', this.advancedFilters.dateRange);

      // Симулюємо фільтрацію за датами
      // Оскільки у нас немає дат для кожного домену, ми будемо фільтрувати пропорційно
      const startDate = this.advancedFilters.dateRange.start;
      const endDate = this.advancedFilters.dateRange.end;

      if (startDate && endDate) {
        // Розраховуємо скільки днів охоплює діапазон
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1; // +1 для включення кінцевої дати
        const totalDays = 30; // Припускаємо що загальний період 30 днів

        // Перевіряємо чи діапазон має сенс
        const now = new Date();
        if (startDate > now) {
          console.log(`Початкова дата ${startDate.toLocaleDateString()} в майбутньому, показуємо 0 даних`);
          filteredDomains = [];
        } else if (daysDiff <= 0) {
          console.log(`Неправильний діапазон дат: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}, показуємо 0 даних`);
          filteredDomains = [];
        } else {
          // Коефіцієнт для зменшення даних пропорційно до вибраного діапазону
          const dateFilterRatio = Math.min(daysDiff / totalDays, 1);

          console.log(`Фільтруємо дані за діапазоном ${daysDiff} днів з ${totalDays} (коефіцієнт: ${dateFilterRatio})`);

          if (dateFilterRatio < 1) {
            filteredDomains = filteredDomains.map(domain => ({
              ...domain,
              visits: this.safeRound((domain.visits || 0) * (dateFilterRatio || 1)),
              totalDuration: this.safeRound((domain.totalDuration || 0) * (dateFilterRatio || 1))
            })).filter(domain => domain.visits > 0); // Прибираємо домени з 0 відвідувань
          }
          // Якщо dateFilterRatio >= 1, то показуємо всі дані без змін
        }
      } else if (startDate) {
        // Якщо вибрана тільки початкова дата, фільтруємо від цієї дати
        const now = new Date();

        // Якщо початкова дата в майбутньому, показуємо 0 даних
        if (startDate > now) {
          console.log(`Початкова дата ${startDate.toLocaleDateString()} в майбутньому, показуємо 0 даних`);
          filteredDomains = [];
        } else {
          const daysFromStart = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const totalDays = 30;
          const dateFilterRatio = Math.min(Math.max(daysFromStart / totalDays, 0), 1);

          console.log(`Фільтруємо дані від ${startDate.toLocaleDateString()} (коефіцієнт: ${dateFilterRatio})`);

          if (dateFilterRatio > 0) {
            filteredDomains = filteredDomains.map(domain => ({
              ...domain,
              visits: this.safeRound((domain.visits || 0) * (dateFilterRatio || 1)),
              totalDuration: this.safeRound((domain.totalDuration || 0) * (dateFilterRatio || 1))
            })).filter(domain => domain.visits > 0);
          }
        }
      } else if (endDate) {
        // Якщо вибрана тільки кінцева дата, фільтруємо до цієї дати
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Якщо кінцева дата раніше за 30 днів тому, показуємо 0 даних
        if (endDate < thirtyDaysAgo) {
          console.log(`Кінцева дата ${endDate.toLocaleDateString()} занадто давно, показуємо 0 даних`);
          filteredDomains = [];
        } else {
          const daysToEnd = Math.ceil((endDate.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
          const totalDays = 30;
          const dateFilterRatio = Math.min(Math.max(daysToEnd / totalDays, 0), 1);

          console.log(`Фільтруємо дані до ${endDate.toLocaleDateString()} (коефіцієнт: ${dateFilterRatio})`);

          if (dateFilterRatio > 0) {
            filteredDomains = filteredDomains.map(domain => ({
              ...domain,
              visits: this.safeRound((domain.visits || 0) * (dateFilterRatio || 1)),
              totalDuration: this.safeRound((domain.totalDuration || 0) * (dateFilterRatio || 1))
            })).filter(domain => domain.visits > 0);
          }
        }
      }
    }

    console.log(`Після фільтрації залишилося ${filteredDomains.length} доменів з ${this.userStats.topDomains.length}`);

    // Оновлюємо загальну статистику відповідно до фільтрів
    if (this.advancedFilters.categories.length > 0 ||
      this.advancedFilters.durationRange.min > 0 ||
      this.advancedFilters.durationRange.max < 180 ||
      this.advancedFilters.dateRange.start ||
      this.advancedFilters.dateRange.end) {

      // Розраховуємо нову статистику на основі відфільтрованих даних
      const totalVisits = filteredDomains.reduce((sum, domain) => sum + domain.visits, 0);
      const totalDuration = filteredDomains.reduce((sum, domain) => sum + domain.totalDuration, 0);
      const uniqueDomains = filteredDomains.length;
      const avgDuration = uniqueDomains > 0 ? totalDuration / uniqueDomains : 0;

      // Оновлюємо статистику
      if (this.userStats) {
        this.userStats.stats = {
          ...this.userStats.stats,
          totalVisits,
          uniqueDomains,
          totalDuration,
          avgDuration: this.safeRound((avgDuration || 0) * 100) / 100
        };
      }

      console.log('Оновлена статистика після фільтрації:', {
        totalVisits,
        uniqueDomains,
        totalDuration,
        avgDuration
      });
    } else {
      // Якщо фільтри не застосовані, повертаємо оригінальні дані
      if (this.userStats && this.userStats.topDomains) {
        filteredDomains = [...this.userStats.topDomains];
        console.log('Фільтри не застосовані, використовуємо оригінальні дані');
      }
    }

    // Оновлюємо дані для всіх графіків
    this.updateChartDataWithFilteredDomains(filteredDomains);
    
    // Оновлюємо дані для кругової діаграми на основі відфільтрованих даних
    this.prepareCategoryDistributionDataFromFiltered(filteredDomains);
    
    // Оновлюємо дані для теплової карти на основі відфільтрованих даних
    this.activityHeatmapData = await this.prepareActivityHeatmapDataFromFiltered(filteredDomains);
    
    // Оновлюємо дані для теплової карти добової активності за тижнями
    this.timeOfDayWeekHeatmapData = await this.prepareTimeOfDayWeekHeatmapDataFromFiltered(filteredDomains);
    
    // Оновлюємо дані для графіка активності (activity chart)
    this.prepareActivityChartDataFromFiltered(filteredDomains);
    
    this.cdr.markForCheck();
  }

  private updateChartDataWithFilteredDomains(filteredDomains: any[]) {
    console.log('Оновлюємо дані для графіків з', filteredDomains.length, 'доменами');

    // Агрегуємо домени за очищеними назвами
    const aggregatedDomains = new Map<string, {
      cleanName: string,
      originalNames: string[],
      titles: string[],
      totalVisits: number,
      totalDuration: number
    }>();

    filteredDomains
      .filter(domain => {
        const cleanName = cleanDomainName(domain.decryptedData?.url || domain._id);
        return cleanName !== 'google' && cleanName !== '';
      })
      .forEach(domain => {
        const originalName = domain.decryptedData?.url || domain._id;
        const cleanName = cleanDomainName(originalName);
        const title = domain.decryptedData?.title || cleanName;

        if (aggregatedDomains.has(cleanName)) {
          const existing = aggregatedDomains.get(cleanName)!;
          existing.totalVisits += domain.visits || 0;
          existing.totalDuration += domain.totalDuration || 0;
          existing.originalNames.push(originalName);
          if (title && title !== cleanName && !existing.titles.includes(title)) {
            existing.titles.push(title);
          }
        } else {
          aggregatedDomains.set(cleanName, {
            cleanName,
            originalNames: [originalName],
            titles: title && title !== cleanName ? [title] : [],
            totalVisits: domain.visits || 0,
            totalDuration: domain.totalDuration || 0
          });
        }
      });

    // Сортуємо за кількістю візитів
    const sortedDomains = Array.from(aggregatedDomains.values())
      .sort((a, b) => b.totalVisits - a.totalVisits);

    // Підготовка даних для графіка активності
    this.activityChartData = sortedDomains.map(domain => ({
      x: domain.cleanName,
      y: domain.totalVisits
    }));

    // Підготовка даних для топ доменів
    this.topDomainsData = sortedDomains.slice(0, 10).map(domain => {
      // Вибираємо найкращий title
      const title = domain.titles.length > 0 ? domain.titles[0] : domain.cleanName;
      
      return {
        name: domain.cleanName || '',
        title: title || '',
        visits: domain.totalVisits || 0,
        duration: domain.totalDuration || 0,
        averageDuration: (domain.totalVisits || 0) > 0 ? this.safeRound((domain.totalDuration || 0) / (domain.totalVisits || 1)) : 0,
        originalCount: (domain.originalNames || []).length
      };
    });

    // Підготовка даних для бульбашкової діаграми з відфільтрованих даних
    console.log('🔍 BUBBLE DEBUG: Calling prepareBubbleChartDataFromFiltered from updateChartDataWithFilteredDomains');
    this.prepareBubbleChartDataFromFiltered(sortedDomains);
    
    // Оновлюємо дані для статистики пристроїв
    this.deviceStatsData = this.devices
      .filter(device => (device.stats?.totalVisits || 0) > 0)
      .map(device => ({
        name: getDeviceTypeLabel(device.deviceType),
        visits: device.stats?.totalVisits || 0,
        duration: device.stats?.totalDuration || 0
      }));

    console.log('Дані для графіків оновлені:', {
      activityChartData: this.activityChartData.length,
      topDomainsData: this.topDomainsData.length,
      bubbleChartData: this.bubbleChartData.length,
      aggregatedCount: aggregatedDomains.size,
      originalCount: filteredDomains.length
    });

    // Логуємо агреговані домени для перевірки
    console.log('Агреговані домени:', Array.from(aggregatedDomains.entries()).slice(0, 5));
  }

  // Метод для формування заголовка графіка на основі вибраного діапазону дат
  getChartTitle(): string {
    const cacheKey = `chartTitle_${this.selectedPeriod}_${JSON.stringify(this.advancedFilters.dateRange)}_${this.translateService.currentLang}`;

    if (this.formatCache.has(cacheKey)) {
      return this.formatCache.get(cacheKey)!;
    }

    let title: string;

    if (this.advancedFilters.dateRange.start && this.advancedFilters.dateRange.end) {
      const startDate = this.advancedFilters.dateRange.start;
      const endDate = this.advancedFilters.dateRange.end;

      // Форматуємо дати
      const formatDate = (date: Date) => {
        return date.toLocaleDateString('uk-UA', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      const startFormatted = formatDate(startDate);
      const endFormatted = formatDate(endDate);

      // Якщо дати однакові, показуємо одну дату
      if (startDate.getTime() === endDate.getTime()) {
        title = `Активність за ${startFormatted}`;
      } else {
        title = `Активність за період ${startFormatted} - ${endFormatted}`;
      }
    } else if (this.advancedFilters.dateRange.start) {
      const startDate = this.advancedFilters.dateRange.start;
      const startFormatted = startDate.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      title = `Активність з ${startFormatted}`;
    } else if (this.advancedFilters.dateRange.end) {
      const endDate = this.advancedFilters.dateRange.end;
      const endFormatted = endDate.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      title = `Активність до ${endFormatted}`;
    } else {
      // Якщо діапазон дат не вибрано, використовуємо стандартний період
      title = `Активність за ${this.getPeriodLabel(this.selectedPeriod)}`;
    }

    this.addToCache(cacheKey, title);
    return title;
  }

  get availableCategories(): string[] {
    if (!this.userStats?.topDomains) return [];

    const categories = new Set<string>();
    this.userStats.topDomains.forEach(domain => {
      const url = domain.decryptedData?.url || domain._id;
      const category = categorizeWebsite(url);
      if (category) {
        categories.add(category);
      }
    });

    return Array.from(categories).sort();
  }

  /**
   * Визначає, чи є графік вузьким для адаптації підписів
   */
  private isChartNarrow(): boolean {
    return this.chartWidth < 768; // Вважаємо графік вузьким, якщо ширина менше 768px
  }

  /**
   * Оновлює ширину графіка при зміні розміру вікна
   */
  private updateChartWidth(): void {
    // Отримуємо ширину контейнера графіка
    const chartContainer = document.querySelector('.charts-section') as HTMLElement;
    if (chartContainer) {
      const newWidth = chartContainer.offsetWidth;
      if (newWidth !== this.chartWidth) {
        this.chartWidth = newWidth;
        console.log('🔍 HEATMAP DEBUG: Chart width updated:', this.chartWidth, 'isNarrow:', this.isChartNarrow());
        this.cdr.markForCheck();
      }
    } else {
      // Якщо контейнер ще не доступний, використовуємо ширину вікна як приблизну оцінку
      this.chartWidth = window.innerWidth;
      console.log('🔍 HEATMAP DEBUG: Chart container not found, using window width:', this.chartWidth);
    }
  }

  // Діагностика даних duration
  async analyzeDurationData() {
    try {
      this.loading = true;
      this.error = null;
      this.cdr.markForCheck();

      console.log('🔍 DURATION DEBUG: Starting duration analysis...');
      const result = await this.apiService.analyzeDurationData();
      
      console.log('🔍 DURATION DEBUG: Analysis result:', result);
      
      if (result.success && result.analysis) {
        const { stats, invalidRecords, suspiciousRecords, durationRanges } = result.analysis;
        
        console.log('🔍 DURATION DEBUG: Duration statistics:', {
          totalRecords: stats.totalRecords,
          totalDurationHours: (this.safeRound(((stats.totalDuration || 0) / 3600 * 100) || 0) / 100) || 0,
          minDuration: stats.minDuration || 0,
          maxDuration: stats.maxDuration || 0,
          maxDurationHours: (this.safeRound(((stats.maxDuration || 0) / 3600 * 100) || 0) / 100) || 0,
          avgDuration: this.safeRound((stats.avgDuration || 0) * 100) / 100,
          invalidRecordsCount: invalidRecords.length,
          suspiciousRecordsCount: suspiciousRecords.length
        });

        console.log('🔍 DURATION DEBUG: Duration ranges:', durationRanges);
        
        if (invalidRecords.length > 0) {
          console.log('🔍 DURATION DEBUG: Sample invalid records:', invalidRecords.slice(0, 5));
        }
        
        if (suspiciousRecords.length > 0) {
          console.log('🔍 DURATION DEBUG: Sample suspicious records:', suspiciousRecords.slice(0, 5));
        }

        alert(`Аналіз завершено!\n\nЗагалом записів: ${stats.totalRecords || 0}\nЗагальний час: ${(this.safeRound(((stats.totalDuration || 0) / 3600 * 100) || 0) / 100) || 0} годин\nМаксимальний duration: ${(this.safeRound(((stats.maxDuration || 0) / 3600 * 100) || 0) / 100) || 0} годин\nНеправильних записів (>1 год): ${invalidRecords.length || 0}\nПідозрілих записів (>27 год): ${suspiciousRecords.length || 0}\n\nДивіться консоль для детальної інформації.`);
      }
    } catch (error) {
      console.error('🔍 DURATION DEBUG: Error analyzing duration data:', error);
      this.error = 'Помилка аналізу даних: ' + (error instanceof Error ? error.message : String(error));
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // Метод для отримання динамічного максимального значення X-осі
  private getXAxisMax(): number {
    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      return 100; // Значення за замовчуванням
    }
    
    const maxVisits = Math.max(...this.bubbleChartData.map(d => d.x));
    // Додаємо 20% відступу для кращого відображення
    return Math.max(maxVisits * 1.2, 50);
  }

  // Метод для отримання динамічного максимального значення Y-осі
  private getYAxisMax(): number {
    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      return 10; // Значення за замовчуванням у хвилинах
    }
    
    const maxAvgTime = Math.max(...this.bubbleChartData.map(d => d.y));
    // Додаємо 20% відступу для кращого відображення, мінімум 10 хвилин
    return Math.max(maxAvgTime * 1.2, 10);
  }

  // Виправлення неправильних значень duration
  async fixDurationData() {
    if (!confirm('Ви впевнені, що хочете виправити неправильні значення duration? Ця операція не може бути скасована.')) {
      return;
    }

    try {
      this.loading = true;
      this.error = null;
      this.cdr.markForCheck();

      console.log('🔍 DURATION DEBUG: Starting duration fix...');
      const result = await this.apiService.fixDurationData();
      
      console.log('🔍 DURATION DEBUG: Fix result:', result);
      
      if (result.success) {
        console.log('🔍 DURATION DEBUG: Fixed duration data:', {
          totalFixed: result.fixedCount,
          millisecondsFixed: result.details.millisecondsFixed,
          cappedFixed: result.details.cappedFixed,
          negativeFixed: result.details.negativeFixed
        });

        alert(`Виправлення завершено!\n\nЗагалом виправлено: ${result.fixedCount} записів\n- Мілісекунди → секунди: ${result.details.millisecondsFixed}\n- Обмежено 1 годиною: ${result.details.cappedFixed}\n- Від'ємні → 0: ${result.details.negativeFixed}\n\nОновлюємо дані...`);
        
        // Оновлюємо дані після виправлення
        await this.loadUserStats();
      }
    } catch (error) {
      console.error('🔍 DURATION DEBUG: Error fixing duration data:', error);
      this.error = 'Помилка виправлення даних: ' + (error instanceof Error ? error.message : String(error));
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

} 