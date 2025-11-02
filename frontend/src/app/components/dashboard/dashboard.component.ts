import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ApiService, Device, HistoryStats } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { HeatmapSeries, HeatmapService } from '../../services/heatmap.service';
import { SettingsService } from '../../services/settings.service';
import { categorizeWebsite, cleanDomainName, getDeviceTypeLabel, getDomainFromUrl, getPeriodLabel } from '../../utils/utils';
import { AdvancedFiltersComponent, FilterOptions } from './advanced-filters/advanced-filters.component';
import { ChartsSectionComponent } from './charts-section/charts-section.component';
import { DevicesSectionComponent } from './devices-section/devices-section.component';
import { FiltersSectionComponent } from './filters-section/filters-section.component';
import { SearchSectionComponent } from './search-section/search-section.component';
import { StatsCardsComponent } from './stats-cards/stats-cards.component';

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

  // Методи санітизації даних
  private sanitizeString(value: any): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return '';
  }

  private sanitizeNumber(value: any): number {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return Math.max(0, value);
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }
    return 0;
  }

  // Перевірка налаштувань збору даних
  private checkDataCollectionSettings() {
    this.settingsService.getSettings().subscribe(settings => {
      // Графіки що залежать від збору тривалості відвідувань
      this.showDurationCharts = settings.dataCollection.collectVisitDuration;
      
      // Секція пристроїв та дропдаун фільтра завжди видима
      this.showDeviceSection = true;
      
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

  // Флаг для запобігання зайвих оновлень
  private isUpdating = false;

  // Затримка для уникнення зайвих викликів
  private periodChangeTimeout: any = null;
  private deviceChangeTimeout: any = null;
  private advancedFiltersTimeout: any = null;
  
  // Event handlers for chart cleanup
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
  
  // Відфільтровані домени для передачі до графіків
  filteredDomains: any[] = [];
  
  // Динамічні діапазони тривалості на основі реальних даних
  // Максимальний час обмежено до 3 годин (180 хвилин) для обох типів
  durationRange: { minTotal: number; maxTotal: number; minAverage: number; maxAverage: number } = {
    minTotal: 0,
    maxTotal: 180,
    minAverage: 0,
    maxAverage: 180
  };
  
  // Налаштування масштабу для bubble chart
  bubbleChartScaleMode: 'normal' | 'zoomed' = 'normal';

  private resizeHandler = () => { };
  private lastVisibilityState = true;
  private visibilityChangeHandler = () => {
    const isVisible = !document.hidden;
    // Оновлюємо дані тільки якщо видимість дійсно змінилася
    if (isVisible && !this.lastVisibilityState && this.currentUser) {
      this.refreshData();
    }
    this.lastVisibilityState = isVisible;
  };
  private dataClearedHandler = () => {
    if (this.currentUser) {
      this.refreshData();
    }
  };
  private focusHandler = () => {
    // Debounce focus events to avoid excessive refreshes
    clearTimeout(this.focusTimeout);
    this.focusTimeout = setTimeout(() => {
      if (this.currentUser && !document.hidden) {
        this.refreshData();
      }
    }, 1000); // 1 second delay
  };
  private focusTimeout: any;

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
      // Секція пристроїв завжди видима
      this.showDeviceSection = true;
      
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
    window.addEventListener('focus', this.focusHandler);

    // Слухаємо зміни розміру вікна для адаптивності графіків
    window.addEventListener('resize', this.resizeHandler);

    // Ініціалізуємо ширину графіка
    setTimeout(() => {
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
    window.removeEventListener('focus', this.focusHandler);
    clearTimeout(this.focusTimeout);
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
      
      // НЕ очищаємо дані графіків, щоб уникнути миготіння
      // Просто перезавантажуємо дані
      await Promise.all([
        this.loadUserStats(),
        this.loadDevices()
      ]);
    } catch (error) {
      // Silent fail
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
      
      // Встановлюємо відфільтровані домени за замовчуванням
      this.filteredDomains = filteredTopDomains;
      
      // Обчислюємо мінімальну та максимальну тривалість з даних
      this.calculateDurationRanges(filteredTopDomains);
      
      // Ініціалізуємо фільтри з динамічними діапазонами, якщо вони ще не встановлені
      if (this.advancedFilters.durationRange.min === 0 && this.advancedFilters.durationRange.max === 180) {
        const currentMinRange = this.advancedFilters.durationType === 'average' 
          ? this.durationRange.minAverage 
          : this.durationRange.minTotal;
        const currentMaxRange = this.advancedFilters.durationType === 'average' 
          ? this.durationRange.maxAverage 
          : this.durationRange.maxTotal;
        
        this.advancedFilters = {
          ...this.advancedFilters,
          durationRange: { min: currentMinRange, max: currentMaxRange }
        };
      }

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

      // Підготовка даних для теплової карти добової активності за тижнями
      
      if (this.timeOfDayWeekHeatmapData?.length > 0) {
      }

      // Підготовка даних для кругової діаграми

      // Підготовка даних для бульбашкової діаграми

      // Оновлюємо ширину графіка після підготовки даних

      this.cdr.markForCheck();
    } catch (error) {
      // Silent fail
    }
  }


  // Підготовка даних для графіка активності з відфільтрованих даних


  // Підготовка даних для теплової карти активності з відфільтрованих даних



  // Зміна періоду
  async onPeriodChange(newPeriod: '7d' | '30d' | '90d' | '1y' | 'all') {
    // Перевіряємо чи значення дійсно змінилося
    if (newPeriod === this.selectedPeriod) {
      return; // Не оновлюємо якщо значення не змінилося
    }

    // Оновлюємо selectedPeriod
    this.selectedPeriod = newPeriod;
    
    // Очищаємо попередній таймаут
    if (this.periodChangeTimeout) {
      clearTimeout(this.periodChangeTimeout);
    }

    // Встановлюємо новий таймаут
    this.periodChangeTimeout = setTimeout(async () => {
      await this.loadUserStats();
      this.cdr.markForCheck();
    }, 300); // Затримка 300мс
  }

  // Зміна пристрою
  async onDeviceChange(newDevice: string) {
    // Перевіряємо чи значення дійсно змінилося
    if (newDevice === this.selectedDevice) {
      return; // Не оновлюємо якщо значення не змінилося
    }

    // Оновлюємо selectedDevice
    this.selectedDevice = newDevice;
    
    // Очищаємо попередній таймаут
    if (this.deviceChangeTimeout) {
      clearTimeout(this.deviceChangeTimeout);
    }

    // Встановлюємо новий таймаут
    this.deviceChangeTimeout = setTimeout(async () => {
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
    // Перевіряємо чи запит дійсно змінився
    if (query === this.searchQuery) {
      return; // Не оновлюємо якщо запит не змінився
    }

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
    // Перевіряємо чи фільтри дійсно змінилися
    if (this.areFiltersEqual(this.advancedFilters, filters)) {
      return; // Не оновлюємо якщо фільтри не змінилися
    }

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


  // Порівняння фільтрів для визначення змін
  private areFiltersEqual(filters1: FilterOptions, filters2: FilterOptions): boolean {
    if (!filters1 || !filters2) return false;

    // Порівнюємо категорії
    if (filters1.categories.length !== filters2.categories.length) return false;
    if (!filters1.categories.every(cat => filters2.categories.includes(cat))) return false;

    // Порівнюємо діапазон часу
    if (filters1.durationRange.min !== filters2.durationRange.min) return false;
    if (filters1.durationRange.max !== filters2.durationRange.max) return false;

    // Порівнюємо діапазон дат
    if (filters1.dateRange.start?.getTime() !== filters2.dateRange.start?.getTime()) return false;
    if (filters1.dateRange.end?.getTime() !== filters2.dateRange.end?.getTime()) return false;

    // Порівнюємо інші властивості
    if (filters1.customPeriod !== filters2.customPeriod) return false;
    if (filters1.durationType !== filters2.durationType) return false;

    return true;
  }

  async onClearAdvancedFilters() {
    // Очищаємо таймаут
    if (this.advancedFiltersTimeout) {
      clearTimeout(this.advancedFiltersTimeout);
    }

    // Встановлюємо діапазон в залежності від типу фільтрації на основі реальних даних
    const minRange = this.advancedFilters.durationType === 'average' 
      ? this.durationRange.minAverage 
      : this.durationRange.minTotal;
    const maxRange = this.advancedFilters.durationType === 'average' 
      ? this.durationRange.maxAverage 
      : this.durationRange.maxTotal;

    this.advancedFilters = {
      categories: [],
      durationRange: { min: minRange, max: maxRange },
      dateRange: { start: null, end: null },
      customPeriod: false,
      durationType: this.advancedFilters.durationType // Зберігаємо поточний тип
    };

    // Застосовуємо фільтри (які тепер очищені) замість повернення до оригінальних даних
    await this.applyAdvancedFilters();
    this.cdr.markForCheck();
  }

  // Обчислення діапазонів тривалості на основі реальних даних
  private calculateDurationRanges(domains: any[]): void {
    if (!domains || domains.length === 0) {
      this.durationRange = {
        minTotal: 0,
        maxTotal: 180,
        minAverage: 0,
        maxAverage: 180
      };
      return;
    }

    const totalDurations: number[] = [];
    const averageDurations: number[] = [];

    domains.forEach(domain => {
      const totalDuration = domain.totalDuration || 0;
      const visits = domain.visits || 0;
      
      // Загальна тривалість (в хвилинах)
      const totalMinutes = totalDuration / 60;
      totalDurations.push(totalMinutes);
      
      // Середня тривалість (в хвилинах)
      if (visits > 0) {
        const avgMinutes = (totalDuration / visits) / 60;
        averageDurations.push(avgMinutes);
      } else {
        averageDurations.push(0);
      }
    });

    // Обчислюємо мін/макс для загальної тривалості
    const minTotal = Math.min(...totalDurations);
    const maxTotal = Math.max(...totalDurations);
    
    // Обчислюємо мін/макс для середньої тривалості
    const minAverage = Math.min(...averageDurations);
    const maxAverage = Math.max(...averageDurations);

    // Округлюємо значення, встановлюємо мінімум 0 та обмежуємо максимум до 3 годин (180 хвилин)
    const MAX_DURATION_MINUTES = 180; // 3 години
    
    this.durationRange = {
      minTotal: Math.max(0, Math.floor(minTotal)),
      maxTotal: Math.min(Math.ceil(maxTotal), MAX_DURATION_MINUTES),
      minAverage: Math.max(0, Math.floor(minAverage)),
      maxAverage: Math.min(Math.ceil(maxAverage), MAX_DURATION_MINUTES)
    };
    
    // Оновлюємо фільтри, якщо вони виходять за межі нового діапазону
    if (this.advancedFilters.durationType === 'total') {
      if (this.advancedFilters.durationRange.min < this.durationRange.minTotal) {
        this.advancedFilters.durationRange.min = this.durationRange.minTotal;
      }
      if (this.advancedFilters.durationRange.max > this.durationRange.maxTotal) {
        this.advancedFilters.durationRange.max = this.durationRange.maxTotal;
      }
    } else {
      if (this.advancedFilters.durationRange.min < this.durationRange.minAverage) {
        this.advancedFilters.durationRange.min = this.durationRange.minAverage;
      }
      if (this.advancedFilters.durationRange.max > this.durationRange.maxAverage) {
        this.advancedFilters.durationRange.max = this.durationRange.maxAverage;
      }
    }
  }

  private async applyAdvancedFilters() {
    if (!this.userStats?.topDomains) {
      return;
    }

    // Обчислюємо поточні діапазони тривалості
    const durationMaxRange = this.advancedFilters.durationType === 'average' 
      ? this.durationRange.maxAverage 
      : this.durationRange.maxTotal;
    const durationMinRange = this.advancedFilters.durationType === 'average' 
      ? this.durationRange.minAverage 
      : this.durationRange.minTotal;

    // Фільтруємо дані на основі вибраних фільтрів
    let filteredDomains = [...this.userStats.topDomains];

    // Фільтр за категоріями
    if (this.advancedFilters.categories.length > 0) {
      filteredDomains = filteredDomains.filter(domain => {
        const url = domain.decryptedData?.url || domain._id;
        const domainName = getDomainFromUrl(url);
        const category = categorizeWebsite(domainName);
        const isIncluded = this.advancedFilters.categories.includes(category);
        return isIncluded;
      });
    }

    // Фільтр за часом проведеним на сайті (конвертуємо з хвилин в секунди)
    // Перевіряємо чи діапазон не є повним (тобто є якийсь фільтр застосований)
    const isFullRange = this.advancedFilters.durationRange.min === durationMinRange && 
                        this.advancedFilters.durationRange.max === durationMaxRange;
    
    if (!isFullRange) {
      // Конвертуємо хвилини в секунди для порівняння з даними
      const minSeconds = this.advancedFilters.durationRange.min * 60;
      const maxSeconds = this.advancedFilters.durationRange.max * 60;

      filteredDomains = filteredDomains.filter(domain => {
        let durationValue: number;

        if (this.advancedFilters.durationType === 'total') {
          // Фільтруємо по загальному часу
          durationValue = domain.totalDuration || 0;
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
        }

        // Перевіряємо чи значення в межах діапазону (в секундах)
        const isInRange = durationValue >= minSeconds && durationValue <= maxSeconds;
        
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
      this.advancedFilters.durationRange.min > durationMinRange ||
      this.advancedFilters.durationRange.max < durationMaxRange ||
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

    // Зберігаємо відфільтровані домени для передачі до графіків
    this.filteredDomains = filteredDomains;
    
      // Оновлюємо дані для всіх графіків
    await this.updateAllChartData(filteredDomains);
    
    // Оновлюємо діапазони тривалості на основі відфільтрованих даних
    this.calculateDurationRanges(filteredDomains);
    
    this.cdr.markForCheck();
  }

  private async updateAllChartData(filteredDomains: any[]) {
    // Оновлюємо дані для всіх графіків
    this.updateChartDataWithFilteredDomains(filteredDomains);
    
    // Оновлюємо дані для кругової діаграми на основі відфільтрованих даних
    
    // Оновлюємо дані для теплової карти на основі відфільтрованих даних
    
    // Оновлюємо дані для теплової карти добової активності за тижнями
    
    // Оновлюємо дані для графіка активності (activity chart)
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
      const domainName = getDomainFromUrl(url);
      const category = categorizeWebsite(domainName);
      if (category) {
        categories.add(category);
      }
    });

    return Array.from(categories).sort();
  }
} 