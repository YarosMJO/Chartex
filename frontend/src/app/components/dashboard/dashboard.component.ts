import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
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
import { HeatmapSeries } from '../../services/heatmap.service';
import { SettingsService } from '../../services/settings.service';
import { categorizeWebsite, cleanDomainName, getDeviceTypeLabel, getDomainFromUrl, getPeriodLabel } from '../../utils/utils';
import { AdvancedFiltersComponent, FilterOptions } from './advanced-filters/advanced-filters.component';
import { ChartsSectionComponent } from './charts-section/charts-section.component';
import { DevicesSectionComponent } from './devices-section/devices-section.component';
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

      // Секція пристроїв видима тільки якщо увімкнено збір інформації про пристрої
      this.showDeviceSection = settings.dataCollection.enabled && settings.dataCollection.collectDeviceInfo;

      // Заголовки сторінок видимі якщо увімкнено збір заголовків
      this.showPageTitles = settings.dataCollection.collectPageTitles;

      // Історія збирається якщо увімкнено
      this.collectHistory = settings.dataCollection.collectHistory;

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
  categoryLabels: string[] = [];
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
  showPageTitles: boolean = true; // Для контролю видимості заголовків сторінок у топ-сайтах
  collectHistory: boolean = true; // Для контролю збору історії

  // Розширені фільтри
  advancedFilters: FilterOptions = {
    categories: [],
    durationRange: { min: 0, max: 180 },
    dateRange: { start: null, end: null },
    customPeriod: false,
    durationType: 'total'
  };
  isAdvancedFiltersExpanded: boolean = false;

  // Кеш для методів форматування
  private formatCache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 100;

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
    private settingsService: SettingsService,
    private router: Router,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Ініціалізуємо мову з localStorage
    const savedLanguage = localStorage.getItem('chartex_language') || 'ua';
    this.translateService.use(savedLanguage);

    // Перевіряємо налаштування збору даних
    this.checkDataCollectionSettings();

    // Слухаємо зміни налаштувань
    this.settingsService.settings$.subscribe(settings => {
      this.showDurationCharts = settings.dataCollection.collectVisitDuration;
      // Секція пристроїв видима тільки якщо увімкнено збір інформації про пристрої
      this.showDeviceSection = settings.dataCollection.enabled && settings.dataCollection.collectDeviceInfo;
      // Заголовки сторінок видимі якщо увімкнено збір заголовків
      this.showPageTitles = settings.dataCollection.collectPageTitles;
      // Історія збирається якщо увімкнено
      this.collectHistory = settings.dataCollection.collectHistory;

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

    // Слухаємо повідомлення від extension background script
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.onMessage.addListener((message: any) => {
        if (message.action === 'dataSyncComplete' && this.currentUser) {
          // Оновлюємо дані після завершення синхронізації
          this.refreshData();
        }
      });
    }

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
      // Гарантуємо, що налаштування завантажені перед рендерингом
      this.checkDataCollectionSettings();
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
      console.log('Loaded devices:', devices); // Debug
      this.devices = devices || [];
      if (!this.devices || this.devices.length === 0) {
        console.log('No devices found or empty array');
      }
      // Оновлюємо налаштування видимості при завантаженні пристроїв
      this.checkDataCollectionSettings();
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading devices:', error); // Debug
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
      this.categoryLabels = [];
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
        this.categoryLabels = [];
        this.bubbleChartData = [];
        return;
      }

      // Виключаємо google.com з усіх графіків
      const filteredTopDomains = this.userStats.topDomains.filter(d => {
        const domain = cleanDomainName(d.decryptedData?.url || d._id);
        return domain !== 'google.com';
      });

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

      // Initialize chart data - will be populated by updateChartDataWithFilteredDomains when filters apply
      this.activityChartData = [];
      this.topDomainsData = [];

      // Підготовка даних для статистики пристроїв
      this.deviceStatsData = this.devices
        .filter(device => (device.stats?.totalVisits || 0) > 0)
        .map(device => ({
          name: getDeviceTypeLabel(device.deviceType),
          visits: device.stats?.totalVisits || 0,
          duration: device.stats?.totalDuration || 0
        }));

      // Встановлюємо відфільтровані домени та запускаємо їх обробку
      this.filteredDomains = filteredTopDomains;
      this.updateChartDataWithFilteredDomains(filteredTopDomains);

      this.cdr.markForCheck();
    } catch (error) {
      // Silent fail
    }
  }

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
      // Закрити сторінку після logout
      this.closePage();
    });
  }

  // Закрити поточну сторінку (для extension)
  private closePage() {
    // Затримка для показу повідомлення про успішний вихід
    setTimeout(() => {
      // Для extension options pages window.close() має працювати
      if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
        // Спочатку спробуємо window.close()
        window.close();
        // Якщо window.close() не спрацює, надсилаємо повідомлення до background script як fallback
        try {
          (window as any).chrome.runtime.sendMessage({ action: 'closeTab' });
        } catch (error) {
          // Якщо помилка, ігноруємо
        }
      } else {
        window.close();
      }
    }, 500); // Затримка для показу повідомлення
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
    this.isSearching = true;
    this.hasResults = false;
    this.cdr.markForCheck();

    try {
      // Call API to get history items for searching across all sites with decrypted data
      const response = await this.apiService.getHistoryWithDecryptedData({
        search: query,
        limit: 1000,
        offset: 0,
        sortBy: 'visitTime',
        sortOrder: 'desc'
      });

      if (response?.items && Array.isArray(response.items)) {
        const searchTerm = query.toLowerCase();

        const results = response.items
          .filter(item => {
            try {
              const url = item.decryptedData?.url || item._id || '';
              const title = item.decryptedData?.title || '';
              const cleanUrl = cleanDomainName(url);

              return cleanUrl.toLowerCase().includes(searchTerm) ||
                title.toLowerCase().includes(searchTerm);
            } catch (error) {
              return false;
            }
          })
          .map(item => ({
            url: item.decryptedData?.url || item._id || '',
            title: item.decryptedData?.title || cleanDomainName(item._id || ''),
            visits: item.visitCount || 1,
            duration: item.duration || 0,
            visitTime: item.visitTime
          }))
          .slice(0, 10);

        this.searchResults = results;
        this.hasResults = results.length > 0;
      }
    } catch (error) {
      console.error('Помилка пошуку:', error);
      this.hasResults = false;
      this.searchResults = [];
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

  // Простий порівняльник масивів рядків (без врахування порядку)
  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    const a = Array.isArray(arr1) ? [...new Set(arr1 || [])] : [];
    const b = Array.isArray(arr2) ? [...new Set(arr2 || [])] : [];
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every(item => setB.has(item));
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
    if (!this.userStats?.topDomains) return;

    const durationMaxRange = this.advancedFilters.durationType === 'average'
      ? this.durationRange.maxAverage
      : this.durationRange.maxTotal;
    const durationMinRange = this.advancedFilters.durationType === 'average'
      ? this.durationRange.minAverage
      : this.durationRange.minTotal;

    let filteredDomains = this.excludeSearchEngines(this.userStats.topDomains);
    filteredDomains = this.applyDateFilters(filteredDomains);
    filteredDomains = this.applyCategoryFilters(filteredDomains);
    filteredDomains = this.applyDurationFilters(filteredDomains, durationMinRange, durationMaxRange);

    this.updateStatsForFilters(filteredDomains, durationMinRange, durationMaxRange);

    this.filteredDomains = filteredDomains;
    this.updateChartDataWithFilteredDomains(filteredDomains);

    // Don't call calculateDurationRanges here as it may cause cascading updates
    // Only update if user explicitly changed filters
    this.cdr.markForCheck();
  }

  private excludeSearchEngines(domains: any[]): any[] {
    return domains.filter(d => {
      const clean = cleanDomainName(d.decryptedData?.url || d._id);
      if (clean === 'google.com' || clean === 'google') return false;
      const category = categorizeWebsite(getDomainFromUrl(d.decryptedData?.url || d._id));
      return category !== 'search_engine';
    });
  }

  private applyDateFilters(domains: any[]): any[] {
    const { start, end } = this.advancedFilters.dateRange;
    if (!start && !end) return domains;

    const ratio = this.calculateDateFilterRatio(start, end);
    if (ratio >= 1) return domains;

    return domains.map(d => ({
      ...d,
      visits: this.safeRound((d.visits || 0) * ratio),
      totalDuration: this.safeRound((d.totalDuration || 0) * ratio)
    })).filter(d => d.visits > 0);
  }

  private calculateDateFilterRatio(start: Date | null, end: Date | null): number {
    const now = new Date();
    const totalDays = 30;

    if (start && end) {
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return start > now ? 0 : Math.min(Math.max(daysDiff / totalDays, 0), 1);
    } else if (start) {
      const daysFromStart = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return start > now ? 0 : Math.min(Math.max(daysFromStart / totalDays, 0), 1);
    } else if (end) {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const daysToEnd = Math.ceil((end.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
      return end < thirtyDaysAgo ? 0 : Math.min(Math.max(daysToEnd / totalDays, 0), 1);
    }
    return 1;
  }

  private applyCategoryFilters(domains: any[]): any[] {
    if (!this.advancedFilters.categories.length) return domains;

    const selected = [...new Set(this.advancedFilters.categories)];

    // Filter domains to only those in selected categories
    return domains.filter(d => {
      const category = categorizeWebsite(getDomainFromUrl(d.decryptedData?.url || d._id));
      return selected.includes(category);
    });
  }

  private applyDurationFilters(domains: any[], minRange: number, maxRange: number): any[] {
    const { min, max } = this.advancedFilters.durationRange;

    // Check if user actually changed the duration range or if it's still at default
    const userChangedDuration = min > minRange || max < maxRange;
    if (!userChangedDuration) return domains;

    const minSecs = min * 60;
    const maxSecs = max * 60;

    return domains.filter(d => {
      const val = this.advancedFilters.durationType === 'total'
        ? d.totalDuration || 0
        : (d.visits || 0) > 0 ? (d.totalDuration || 0) / (d.visits || 1) : 0;
      return val >= minSecs && val <= maxSecs;
    });
  }

  private updateStatsForFilters(domains: any[], minRange: number, maxRange: number): void {
    const hasFilters = this.advancedFilters.categories.length > 0 ||
      this.advancedFilters.durationRange.min > minRange ||
      this.advancedFilters.durationRange.max < maxRange ||
      this.advancedFilters.dateRange.start ||
      this.advancedFilters.dateRange.end;

    if (!hasFilters || !this.userStats) return;

    const totalVisits = domains.reduce((s, d) => s + (d.visits || 0), 0);
    const totalDuration = domains.reduce((s, d) => s + (d.totalDuration || 0), 0);
    const avgDuration = domains.length > 0 ? totalDuration / domains.length : 0;

    this.userStats.stats = {
      ...this.userStats.stats,
      totalVisits,
      uniqueDomains: domains.length,
      totalDuration,
      avgDuration: this.safeRound(avgDuration * 100) / 100
    };
  }

  private updateChartDataWithFilteredDomains(filteredDomains: any[]) {
    const aggregated = this.aggregateByDomainName(filteredDomains);
    const sorted = Array.from(aggregated.values()).sort((a, b) => b.totalVisits - a.totalVisits);

    this.activityChartData = sorted.map(d => ({ x: d.cleanName, y: d.totalVisits }));
    this.topDomainsData = sorted.slice(0, 10).map(d => ({
      name: d.cleanName || '',
      title: d.titles[0] || d.cleanName,
      visits: d.totalVisits,
      duration: d.totalDuration,
      averageDuration: d.totalVisits > 0 ? this.safeRound(d.totalDuration / d.totalVisits) : 0,
      originalCount: d.originalNames.length
    }));

    const categoryResult = this.aggregateByCategory(filteredDomains);
    this.categoryDistributionData = categoryResult.values;
    this.categoryLabels = categoryResult.categories;

    this.deviceStatsData = this.devices
      .filter(d => (d.stats?.totalVisits || 0) > 0)
      .map(d => ({
        name: getDeviceTypeLabel(d.deviceType),
        visits: d.stats?.totalVisits || 0,
        duration: d.stats?.totalDuration || 0
      }));
  }

  private aggregateByDomainName(domains: any[]): Map<string, any> {
    const result = new Map<string, any>();
    domains
      .filter(d => {
        const clean = cleanDomainName(d.decryptedData?.url || d._id);
        return clean !== 'google' && clean !== '';
      })
      .forEach(d => {
        const url = d.decryptedData?.url || d._id;
        const cleanName = cleanDomainName(url);
        const title = d.decryptedData?.title || cleanName;

        if (result.has(cleanName)) {
          const existing = result.get(cleanName)!;
          existing.totalVisits += d.visits || 0;
          existing.totalDuration += d.totalDuration || 0;
          existing.originalNames.push(url);
          if (title && title !== cleanName && !existing.titles.includes(title)) {
            existing.titles.push(title);
          }
        } else {
          result.set(cleanName, {
            cleanName,
            originalNames: [url],
            titles: title && title !== cleanName ? [title] : [],
            totalVisits: d.visits || 0,
            totalDuration: d.totalDuration || 0
          });
        }
      });
    return result;
  }

  private aggregateByCategory(domains: any[]): { categories: string[]; values: number[] } {
    try {
      const categoryMap = new Map<string, number>();
      domains.forEach(d => {
        const category = categorizeWebsite(getDomainFromUrl(d.decryptedData?.url || d._id));
        if (category !== 'search_engine') {
          categoryMap.set(category, (categoryMap.get(category) || 0) + (d.totalDuration || 0));
        }
      });
      const sorted = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
      const categories = sorted.map(([cat]) => cat);
      const values = sorted.map(([, dur]) => dur);
      return { categories, values };
    } catch (e) {
      return { categories: [], values: [] };
    }
  }

  // Метод для формування заголовка графіка на основі вибраного діапазону дат
  getChartTitle(): string {
    const cacheKey = `chartTitle_${this.selectedPeriod}_${JSON.stringify(this.advancedFilters.dateRange)}_${this.translateService.currentLang}`;

    if (this.formatCache.has(cacheKey)) {
      return this.formatCache.get(cacheKey)!;
    }

    let title: string;

    // Визначаємо локаль на основі поточної мови
    const locale = this.translateService.currentLang === 'en' ? 'en-US' : 'uk-UA';

    if (this.advancedFilters.dateRange.start && this.advancedFilters.dateRange.end) {
      const startDate = this.advancedFilters.dateRange.start;
      const endDate = this.advancedFilters.dateRange.end;

      // Форматуємо дати
      const formatDate = (date: Date) => {
        return date.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      const startFormatted = formatDate(startDate);
      const endFormatted = formatDate(endDate);

      // Якщо дати однакові, показуємо одну дату
      if (startDate.getTime() === endDate.getTime()) {
        title = this.translateService.instant('DASHBOARD.CHARTS.ACTIVITY_FOR_DATE', { date: startFormatted });
      } else {
        title = this.translateService.instant('DASHBOARD.CHARTS.ACTIVITY_FOR_PERIOD', { start: startFormatted, end: endFormatted });
      }
    } else if (this.advancedFilters.dateRange.start) {
      const startDate = this.advancedFilters.dateRange.start;
      const startFormatted = startDate.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      title = this.translateService.instant('DASHBOARD.CHARTS.ACTIVITY_FROM', { date: startFormatted });
    } else if (this.advancedFilters.dateRange.end) {
      const endDate = this.advancedFilters.dateRange.end;
      const endFormatted = endDate.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      title = this.translateService.instant('DASHBOARD.CHARTS.ACTIVITY_TO', { date: endFormatted });
    } else {
      // Якщо діапазон дат не вибрано, використовуємо стандартний період
      title = this.translateService.instant('DASHBOARD.CHARTS.ACTIVITY_TITLE', { period: this.getPeriodLabel(this.selectedPeriod) });
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