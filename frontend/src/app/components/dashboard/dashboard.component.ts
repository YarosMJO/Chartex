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
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { ApiService, HistoryStats, Device } from '../../services/api.service';
import { HeatmapService, HeatmapSeries } from '../../services/heatmap.service';
import { SettingsService } from '../../services/settings.service';
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
    MatTooltipModule,
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

  // Перевірка налаштувань збору даних
  private checkDataCollectionSettings() {
    this.settingsService.getSettings().subscribe(settings => {
      // Графіки що залежать від збору тривалості відвідувань
      this.showDurationCharts = settings.dataCollection.collectVisitDuration;
      
      // Секція пристроїв та дропдаун фільтра
      this.showDeviceSection = settings.privacy.showOtherDevices;
      
      // Якщо збір статистики по пристроях вимкнено, скидаємо вибраний пристрій
      if (!this.showDeviceSection && this.selectedDevice !== 'all') {
        this.selectedDevice = 'all';
        this.loadUserStats();
      }
      
      this.cdr.markForCheck();
    });
  }

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
  
  // Event handlers for chart cleanup
  private scrollHandler?: (e: Event) => void;
  private touchHandler?: (e: Event) => void;
  private chartCleanup?: () => void;

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
  
  // Налаштування масштабу для bubble chart
  bubbleChartScaleMode: 'normal' | 'zoomed' = 'normal';

  // Відстеження ширини графіка для адаптивності
  private chartWidth: number = 0;
  private resizeHandler = () => this.updateChartWidth();
  private visibilityChangeHandler = () => {
    if (!document.hidden && this.currentUser) {
      this.refreshData();
    }
  };
  private dataClearedHandler = () => {
    if (this.currentUser) {
      this.refreshData();
    }
  };

  // Пошук
  searchQuery: string = '';
  searchResults: any[] = [];
  isSearching: boolean = false;
  hasResults: boolean = false;

  // Налаштування видимості графіків
  showDurationCharts: boolean = true;
  showDeviceSection: boolean = true;



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
    private settingsService: SettingsService,
    private ngZone: NgZone,
    private router: Router,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }


  ngOnInit() {
    // Ініціалізуємо мову з localStorage
    const savedLanguage = localStorage.getItem('chartex_language') || 'uk';
    this.translateService.use(savedLanguage);
    
    // Перевіряємо налаштування збору даних
    this.checkDataCollectionSettings();

    // Слухаємо зміни налаштувань
    this.settingsService.settings$.subscribe(settings => {
      this.showDurationCharts = settings.dataCollection.collectVisitDuration;
      this.showDeviceSection = settings.privacy.showOtherDevices;
      
      // Якщо збір статистики по пристроях вимкнено, скидаємо вибраний пристрій
      if (!this.showDeviceSection && this.selectedDevice !== 'all') {
        this.selectedDevice = 'all';
        this.loadUserStats();
      }
      
      this.cdr.markForCheck();
    });

    // Слухаємо зміни мови
    window.addEventListener('languageChanged', (event: any) => {
      if (event.detail && event.detail.language) {
        // Змінюємо мову тільки якщо вона дійсно змінилася
        if (this.translateService.currentLang !== event.detail.language) {
          this.translateService.use(event.detail.language);
          // Очищаємо кеш форматування при зміні мови
          this.formatCache.clear();
          this.cdr.markForCheck();
        }
      }
    });

    // Слухаємо зміни видимості сторінки для оновлення даних
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // Слухаємо події очищення даних
    window.addEventListener('dataCleared', this.dataClearedHandler);

    // Слухаємо подію фокусу на вікні (повернення на вкладку)
    window.addEventListener('focus', this.visibilityChangeHandler);

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
          const encryptionKey = await this.authService.getEncryptionKey();
          if (encryptionKey) {
            this.apiService.setEncryptionKey(encryptionKey);
          } else {
            this.error = 'Ключ шифрування не знайдено - деякі дані можуть відображатися як хеші';
          }
          this.cdr.markForCheck();
        } catch (error) {
          this.error = 'Помилка отримання ключа шифрування - деякі дані можуть відображатися як хеші';
          this.cdr.markForCheck();
        }
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
    
    // Cleanup chart event listeners
    if (this.chartCleanup) {
      this.chartCleanup();
    }
    
    // Очищаємо слухачі подій
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    window.removeEventListener('dataCleared', this.dataClearedHandler);
    window.removeEventListener('focus', this.visibilityChangeHandler);
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
    } catch (error) {
      this.error = 'Помилка завантаження даних: ' + (error instanceof Error ? error.message : String(error));
      this.cdr.markForCheck();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // Оновлення даних (примусове)
  async refreshData() {
    try {
      // Очищаємо кеш форматування
      this.formatCache.clear();
      
      // Скидаємо дані графіків
      this.activityChartData = [];
      this.topDomainsData = [];
      this.deviceStatsData = [];
      this.activityHeatmapData = [];
      this.timeOfDayWeekHeatmapData = [];
      this.categoryDistributionData = [];
      this.bubbleChartData = [];
      
      // Перезавантажуємо дані
      await Promise.all([
        this.loadUserStats(),
        this.loadDevices()
      ]);
      
      console.log('Дані оновлено після очищення');
    } catch (error) {
      console.error('Помилка оновлення даних:', error);
    }
  }

  // Завантаження статистики користувача
  async loadUserStats() {
    // Запобігаємо одночасним оновленням
    if (this.isUpdating) {
      return;
    }

    this.isUpdating = true;

    try {
      const params: { period: '7d' | '30d' | '90d' | '1y' | 'all'; deviceId?: string } = {
        period: this.selectedPeriod
      };
      if (this.selectedDevice !== 'all') {
        params.deviceId = this.selectedDevice;
      }

      // Додаємо timestamp для уникнення кешування
      const paramsWithTimestamp = {
        ...params,
        _t: Date.now(),
        forceRefresh: true // Примусове оновлення
      };
      
      const stats = await this.apiService.getUserStatsWithDecryptedData(paramsWithTimestamp);

      if (stats?.topDomains && stats.topDomains.length > 0) {
        
      }

      this.userStats = stats;
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

    if (!this.userStats) {
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
        this.activityChartData = [
          { x: 'youtube.com', y: 25 },
          { x: 'github.com', y: 18 },
          { x: 'stackoverflow.com', y: 12 },
          { x: 'google.com', y: 8 },
          { x: 'medium.com', y: 5 }
        ];
      }
      
      this.topDomainsData = filteredTopDomains
        .slice(0, 10)
        .map(domain => ({
          name: cleanDomainName(domain.decryptedData?.url || domain._id),
          title: domain.decryptedData?.title || cleanDomainName(domain.decryptedData?.url || domain._id),
          visits: domain.visits,
          duration: domain.totalDuration
        }));

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
      
      if (this.timeOfDayWeekHeatmapData?.length > 0) {
      }

      // Підготовка даних для кругової діаграми
      this.prepareCategoryDistributionData();

      // Підготовка даних для бульбашкової діаграми
      this.prepareBubbleChartData();

      // Оновлюємо ширину графіка після підготовки даних
      this.updateChartWidth();

      this.cdr.markForCheck();
    } catch (error) {
      console.error('Помилка підготовки даних для графіків:', error);
    }
  }

  // Підготовка даних для теплової карти активності за днями тижня
  private async prepareActivityHeatmapData(): Promise<HeatmapSeries[]> {

    if (!this.userStats?.topDomains) {
      return [];
    }

    try {
      const heatmapData = await this.heatmapService.prepareActivityHeatmapData(
        this.userStats,
        this.selectedPeriod,
        this.selectedDevice
      );

      return heatmapData;
    } catch (error) {
      console.error('Error preparing heatmap data:', error);
      // Fallback to empty data
      return [];
    }
  }

  // Підготовка даних для графіка активності з відфільтрованих даних
  private prepareActivityChartDataFromFiltered(filteredDomains: any[]): void {
    if (!filteredDomains || filteredDomains.length === 0) {
      this.activityChartData = [];
      return;
    }

    try {
      // Групуємо домени за очищеними назвами та сумуємо відвідування
      const domainMap = new Map<string, number>();
      
      filteredDomains.forEach(domain => {
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
      
      // Валідація фінальних даних
      const isValidData = this.activityChartData.every(item => 
        item && 
        typeof item.x === 'string' && 
        item.x.length > 0 &&
        typeof item.y === 'number' && 
        item.y >= 0
      );
      
      // Якщо немає даних з відвідуваннями або дані невалідні, створюємо порожній масив
      if (this.activityChartData.length === 0 || !isValidData) {
        this.activityChartData = [];
      }

    } catch (error) {
      this.activityChartData = [];
    }
  }

  // Підготовка даних для теплової карти добової активності за тижнями з відфільтрованих даних
  private async prepareTimeOfDayWeekHeatmapDataFromFiltered(filteredDomains: any[]): Promise<HeatmapSeries[]> {
    
    if (!filteredDomains || filteredDomains.length === 0) {
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

      return heatmapData;
    } catch (error) {
      return [];
    }
  }

  // Підготовка даних для теплової карти активності з відфільтрованих даних
  private async prepareActivityHeatmapDataFromFiltered(filteredDomains: any[]): Promise<HeatmapSeries[]> {
    if (!filteredDomains || filteredDomains.length === 0) {
      return [];
    }

    if (!this.userStats) {
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

    } catch (error) {
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

    } catch (error) {
      this.categoryDistributionData = [];
    }
  }

  // Підготовка даних для бульбашкової діаграми з відфільтрованих даних
  private prepareBubbleChartDataFromFiltered(sortedDomains: any[]): void {
    try {
      if (!sortedDomains || sortedDomains.length === 0) {
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

      // Check if we have any domains with meaningful data
      const domainsWithData = domainsToProcess.filter((d: any) => (d.visits || 0) > 0 || (d.totalDuration || 0) > 0);

      // Використовуємо всі домени, навіть без даних (як у верхньому графіку)
      const finalDomainsToProcess = domainsToProcess;

      // Calculate ranges for better scaling
      const maxVisits = Math.max(...finalDomainsToProcess.map((d: any) => d.visits || 0));
      const maxDuration = Math.max(...finalDomainsToProcess.map((d: any) => d.totalDuration || 0));


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

        // Y-координата: загальний час в хвилинах + offset
        const finalY = Math.max(totalTimeMinutes || 0.1, 0.1) + (offsetY || 0); // Мінімум 0.1 хв + offset

        // Z (розмір бульбашки) базується на відвідуваннях для різноманітності
        const normalizedZ = (maxVisits || 0) > 0 ? ((visitsCount || 0) / (maxVisits || 1)) : 0;
        const finalZ = Math.max(this.safeRound((normalizedZ || 0) * 30) + 15, 15); // Range: 15-45

        // Обмежуємо розмір бульбашки
        const clampedZ = Math.min(Math.max(finalZ || 15, 15), 45);

        // Використовуємо реальні значення
        const scaledX = finalX || 1; // X = реальна кількість відвідувань
        const scaledY = finalY || 0.1; // Y = реальні хвилини загального часу

        // Використовуємо збережені оригінальні дані з групування
        const originalUrl = domain.originalUrl;
        const originalId = domain.originalId;
        const inputForCleanName = originalUrl || originalId;
        const cleanNameResult = cleanDomainName(inputForCleanName);
        const siteName = (cleanNameResult && typeof cleanNameResult === 'string') ? cleanNameResult : domain.cleanName || 'Unknown';
        
        const result = {
          x: scaledX,
          y: scaledY,
          z: clampedZ,
          name: siteName,
          rawTotalMinutes: totalDurationMinutes || 0,
          rawVisits: visits || 0,
          rawAvgMinutes: (visitsCount || 0) > 0 ? this.safeRound((totalTimeMinutes || 0) / (visitsCount || 1) * 100) / 100 : 0
        };

        return result;
      });

    } catch (error) {
      this.bubbleChartData = [];
    }
  }

  // Підготовка даних для бульбашкової діаграми
  private prepareBubbleChartData(): void {
    try {
      if (!this.userStats || !this.userStats.topDomains || this.userStats.topDomains.length === 0) {
        this.bubbleChartData = [];
        return;
      }

      // Вилучаємо google.com
      const filteredTopDomains = this.userStats.topDomains.filter((d: any) => {
        const domain = cleanDomainName(d.decryptedData?.url || d._id);
        return domain !== 'google.com';
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
      
      // Використовуємо всі домени, навіть без даних (як у верхньому графіку)
      const finalDomainsToProcess = domainsToProcess;
      
      // Calculate ranges for better scaling
      const maxVisits = Math.max(...domainsToProcess.map((d: any) => d.visits || 0));
      
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

        // Y-координата: загальний час в хвилинах + offset
        const finalY = Math.max(totalTimeMinutes || 0.1, 0.1) + (offsetY || 0); // Мінімум 0.1 хв + offset

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
        const siteName = (cleanNameResult && typeof cleanNameResult === 'string') ? cleanNameResult : 'Unknown';
        
        if (!siteName || siteName === 'Unknown') {
          // Site name not available, using fallback
        }
        
        const result = {
          x: scaledX,
          y: scaledY,
          z: clampedZ,
          name: siteName,
          rawTotalMinutes: totalDurationMinutes || 0,
          rawVisits: visits || 0,
          rawAvgMinutes: (visitsCount || 0) > 0 ? this.safeRound((totalTimeMinutes || 0) / (visitsCount || 1) * 100) / 100 : 0
        };
        
        return result;
      });

    } catch (error) {
      this.bubbleChartData = [];
    }
  }



  // Зміна періоду
  async onPeriodChange(newPeriod: '7d' | '30d' | '90d' | '1y' | 'all') {
    // Перевіряємо, чи період дійсно змінився
    if (newPeriod === this.previousPeriod) {
      return; // Нічого не робимо, якщо період не змінився
    }
    
    // Оновлюємо selectedPeriod
    this.selectedPeriod = newPeriod;
    
    // Очищаємо попередній таймаут
    if (this.periodChangeTimeout) {
      clearTimeout(this.periodChangeTimeout);
    }

    // Встановлюємо новий таймаут
    this.periodChangeTimeout = setTimeout(async () => {
      // Оновлюємо попередній період
      this.previousPeriod = this.selectedPeriod;
      await this.loadUserStats();
      this.cdr.markForCheck();
    }, 300); // Затримка 300мс
  }

  // Зміна пристрою
  async onDeviceChange(newDevice: string) {
    // Перевіряємо, чи пристрій дійсно змінився
    if (newDevice === this.previousDevice) {
      return; // Нічого не робимо, якщо пристрій не змінився
    }
    
    // Оновлюємо selectedDevice
    this.selectedDevice = newDevice;
    
    // Очищаємо попередній таймаут
    if (this.deviceChangeTimeout) {
      clearTimeout(this.deviceChangeTimeout);
    }

    // Встановлюємо новий таймаут
    this.deviceChangeTimeout = setTimeout(async () => {
      // Оновлюємо попередній пристрій
      this.previousDevice = this.selectedDevice;
      await this.loadUserStats();
      this.cdr.markForCheck();
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
          type: 'x',
          autoScaleYaxis: true
        },
        pan: {
          enabled: true,
          type: 'x'
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        },
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
        maxVal = 3600; // Default 1 година
      }
    } else {
      maxVal = 3600; // Default 1 година
    }
    
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
        },
        pan: {
          enabled: true,
          type: 'xy'
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
          text: 'Загальний час (хв)'
        },
        min: 0,
        max: this.getYAxisMax(), // Динамічне максимальне значення для загального часу
        tickAmount: 6,
        labels: {
          style: {
            fontSize: '12px'
          },
          offsetX: -4,
          formatter: (val: number): string => {
            // Для загального часу показуємо години та хвилини
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
            
            // Y-ось показує середній час, тому використовуємо rawAvgMinutes
            const avgMinutes = point?.rawAvgMinutes ?? 0;
            
            if (avgMinutes === 0 || !Number.isFinite(avgMinutes)) return '';
            if ((avgMinutes || 0) >= 60) {
              const h = Math.floor((avgMinutes || 0) / 60);
              const m: number = this.safeRound((avgMinutes || 0) % 60);
              return `${h}г ${m}хв`;
            }
            return `${this.safeRound(avgMinutes || 0)}хв`;
          } catch (error) {
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
          
          // Отримуємо всі дані для повного tooltip
          const totalMinutes = Number(data?.rawTotalMinutes) || 0;
          const avgMinutes = Number(data?.rawAvgMinutes) || 0;
          const visits = Number(data?.rawVisits) || 0;
          
          return `
            <div class="bubble-tooltip">
              <div class="title">${siteName}</div>
              <div class="row"><span class="label">Візитів: </span><span class="value">${visits}</span></div>
              <div class="row"><span class="label">Загальний час: </span><span class="value">${formatDuration((totalMinutes || 0) * 60, this.translateService)}</span></div>
              <div class="row"><span class="label">Середній час: </span><span class="value">${formatDuration(this.safeRound((avgMinutes || 0) * 60), this.translateService)}</span></div>
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
        formatter: () => 'Загальний час'
      },
      colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      stroke: {
        width: 2,
        colors: ['#ffffff']
      },
      annotations: {
        lines: [{
          x: 0,
          y: 0,
          x2: this.getXAxisMax(),
          y2: this.getYAxisMax(),
          strokeColor: '#ff0000',
          strokeWidth: 2,
          strokeDashArray: 0,
          opacity: 0.8,
          label: {
            text: 'Діагональна лінія',
            textAnchor: 'middle',
            offsetX: 0,
            offsetY: -10,
            style: {
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#ff0000',
              fontSize: '12px',
              fontWeight: 'bold'
            }
          }
        }]
      }
    };

    return options;
  }

  // Перехід до налаштувань
  openSettings() {
    this.router.navigate(['/settings']);
  }

  // Перемикання масштабу bubble chart
  toggleBubbleChartScale() {
    this.bubbleChartScaleMode = this.bubbleChartScaleMode === 'normal' ? 'zoomed' : 'normal';
    this.cdr.markForCheck();
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
    // Очищаємо попередній таймаут
    if (this.advancedFiltersTimeout) {
      clearTimeout(this.advancedFiltersTimeout);
    }

    // Встановлюємо новий таймаут
    this.advancedFiltersTimeout = setTimeout(async () => {
      this.advancedFilters = filters;
      await this.applyAdvancedFilters();
      this.cdr.markForCheck();
    }, 150); // Затримка 150мс для фільтрів
  }

  async onClearAdvancedFilters() {
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

    // Застосовуємо фільтри (які тепер очищені) замість повернення до оригінальних даних
    await this.applyAdvancedFilters();
    this.cdr.markForCheck();
  }

  private async applyAdvancedFilters() {
    if (!this.userStats?.topDomains) {
      return;
    }

    // Фільтруємо дані на основі вибраних фільтрів
    let filteredDomains = [...this.userStats.topDomains];

    // Фільтр за категоріями
    if (this.advancedFilters.categories.length > 0) {
      filteredDomains = filteredDomains.filter(domain => {
        const url = domain.decryptedData?.url || domain._id;
        const category = categorizeWebsite(url);
        const isIncluded = this.advancedFilters.categories.includes(category);
        return isIncluded;
      });
    }

    // Фільтр за часом проведеним на сайті (конвертуємо з хвилин в секунди)
    if (this.advancedFilters.durationRange.min > 0 || this.advancedFilters.durationRange.max < (this.advancedFilters.durationType === 'average' ? 60 : 180)) {

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

        return isInRange;
      });
    }

    // Фільтр за датою
    if (this.advancedFilters.dateRange.start || this.advancedFilters.dateRange.end) {
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
          filteredDomains = [];
        } else if (daysDiff <= 0) {
          filteredDomains = [];
        } else {
          // Коефіцієнт для зменшення даних пропорційно до вибраного діапазону
          const dateFilterRatio = Math.min(daysDiff / totalDays, 1);

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
          filteredDomains = [];
        } else {
          const daysFromStart = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const totalDays = 30;
          const dateFilterRatio = Math.min(Math.max(daysFromStart / totalDays, 0), 1);

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
          filteredDomains = [];
        } else {
          const daysToEnd = Math.ceil((endDate.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
          const totalDays = 30;
          const dateFilterRatio = Math.min(Math.max(daysToEnd / totalDays, 0), 1);

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

    // Оновлюємо загальну статистику відповідно до фільтрів
    if (this.advancedFilters.categories.length > 0 ||
      this.advancedFilters.durationRange.min > 0 ||
      this.advancedFilters.durationRange.max < (this.advancedFilters.durationType === 'average' ? 60 : 180) ||
      this.advancedFilters.dateRange.start ||
      this.advancedFilters.dateRange.end) {

      // Розраховуємо нову статистику на основі відфільтрованих даних
      const totalVisits = filteredDomains.reduce((sum, domain) => sum + (domain.visits || 0), 0);
      const totalDuration = filteredDomains.reduce((sum, domain) => sum + (domain.totalDuration || 0), 0);
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

    } else {
      // Якщо фільтри не застосовані, повертаємо оригінальні дані
      if (this.userStats && this.userStats.topDomains) {
        filteredDomains = [...this.userStats.topDomains];
      }
    }

    // Оновлюємо дані для всіх графіків
    await this.updateAllChartData(filteredDomains);
    
    this.cdr.markForCheck();
  }

  private async updateAllChartData(filteredDomains: any[]) {
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
  }

  private updateChartDataWithFilteredDomains(filteredDomains: any[]) {
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
    this.prepareBubbleChartDataFromFiltered(sortedDomains);
    
    // Оновлюємо дані для статистики пристроїв
    this.deviceStatsData = this.devices
      .filter(device => (device.stats?.totalVisits || 0) > 0)
      .map(device => ({
        name: getDeviceTypeLabel(device.deviceType),
        visits: device.stats?.totalVisits || 0,
        duration: device.stats?.totalDuration || 0
      }));
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
    try {
      // Отримуємо ширину контейнера графіка
      const chartContainer = document.querySelector('.charts-section') as HTMLElement;
      if (chartContainer) {
        const newWidth = chartContainer.offsetWidth;
        if (newWidth !== this.chartWidth) {
          this.chartWidth = newWidth;
          this.cdr.markForCheck();
        }
      } else {
        // Якщо контейнер ще не доступний, використовуємо ширину вікна як приблизну оцінку
        this.chartWidth = window.innerWidth;
      }
    } catch (error) {
      console.error('Error updating chart width:', error);
      this.chartWidth = window.innerWidth;
    }
  }


  // Метод для отримання динамічного максимального значення X-осі
  private getXAxisMax(): number {
    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      const defaultMax = this.bubbleChartScaleMode === 'zoomed' ? 50 : 100;
      return defaultMax; // Значення за замовчуванням
    }
    
    const maxVisits = Math.max(...this.bubbleChartData.map(d => d.x));
    
    if (this.bubbleChartScaleMode === 'zoomed') {
      // Для збільшеного масштабу обмежуємо максимальне значення
      const result = Math.min(maxVisits * 1.5, 200);
      return result;
    } else {
      // Додаємо 20% відступу для кращого відображення
      const result = Math.max(maxVisits * 1.2, 50);
      return result;
    }
  }

  // Метод для отримання динамічного максимального значення Y-осі (загальний час)
  private getYAxisMax(): number {
    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      const defaultMax = this.bubbleChartScaleMode === 'zoomed' ? 30 : 60;
      return defaultMax; // Значення за замовчуванням у хвилинах
    }
    
    // Використовуємо rawTotalMinutes для загального часу
    const maxTotalTime = Math.max(...this.bubbleChartData.map(d => d.rawTotalMinutes || 0));
    
    if (this.bubbleChartScaleMode === 'zoomed') {
      // Для збільшеного масштабу обмежуємо максимальне значення
      const result = Math.min(maxTotalTime * 1.5, 120);
      return result;
    } else {
      // Додаємо 20% відступу для кращого відображення, мінімум 60 хвилин
      const result = Math.max(maxTotalTime * 1.2, 60);
      return result;
    }
  }
} 