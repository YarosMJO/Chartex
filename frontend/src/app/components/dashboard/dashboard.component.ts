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
  categoryDistributionData: number[] = [];

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
  ) {}

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
    this.formatCache.clear();
    
    // Очищаємо слухачі подій
    window.removeEventListener('resize', this.resizeHandler);
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
      const stats = await this.apiService.getUserStatsWithDecryptedData(params);
      
      console.log('Статистика отримана:', {
        hasStats: !!stats,
        hasTopDomains: !!stats.topDomains,
        topDomainsCount: stats.topDomains?.length || 0
      });
      
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
    console.log('🔍 HEATMAP DEBUG: Starting prepareChartData');
    
    if (!this.userStats) {
      console.log('🔍 HEATMAP DEBUG: No userStats available');
      return;
    }

    try {
      // Підготовка даних для графіка активності
      this.activityChartData = this.userStats.topDomains
        .slice(0, 10)
        .map(domain => ({
          x: cleanDomainName(domain.decryptedData?.url || domain._id),
          y: domain.visits
        }));

      // Підготовка даних для топ доменів
      this.topDomainsData = this.userStats.topDomains
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

      // Підготовка даних для кругової діаграми
      this.prepareCategoryDistributionData();

      // Оновлюємо ширину графіка після підготовки даних
      this.updateChartWidth();

      console.log('🔍 HEATMAP DEBUG: Chart data prepared successfully');
      console.log('🔍 HEATMAP DEBUG: Activity heatmap data length:', this.activityHeatmapData.length);
      
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
    if (this.isDarkTheme) {
      return {
        chart: { type: 'area', height: 300, foreColor: '#f3eaff', background: '#232136' },
        xaxis: { type: 'category', labels: { style: { colors: '#f3eaff' } } },
        yaxis: { labels: { style: { colors: '#f3eaff' } } },
        colors: ['#a259f7'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.8, stops: [0, 90, 100], colorStops: [] } },
        stroke: { curve: 'smooth', colors: ['#a259f7'] },
        dataLabels: { enabled: false },
        grid: { borderColor: '#3a2e5c', row: { colors: ['#2a2042', 'transparent'], opacity: 0.3 } },
        tooltip: { theme: 'dark', style: { fontSize: '14px', color: '#fff' }, y: { formatter: (val: any) => val } },
      };
    } else {
      return {
        chart: { type: 'area', height: 300 },
        xaxis: { type: 'category' },
        colors: ['#667eea'],
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.9, stops: [0, 90, 100] } },
        stroke: { curve: 'smooth' },
        dataLabels: { enabled: false },
        grid: { borderColor: '#e7e7e7', row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } },
        tooltip: { theme: 'light' },
      };
    }
  }

  get activityHeatmapOptions() {
    console.log('🔍 HEATMAP DEBUG: Generating chart options, isDarkTheme:', this.isDarkTheme);
    console.log('🔍 HEATMAP DEBUG: Current activityHeatmapData length:', this.activityHeatmapData.length);
    
    return this.heatmapService.getActivityHeatmapOptions(this.isDarkTheme, this.isChartNarrow());
  }

  get pieChartOptions() {
    return {
      chart: {
        type: 'pie',
        height: 250,
        foreColor: this.isDarkTheme ? '#f3eaff' : '#23272f',
        background: this.isDarkTheme ? '#232136' : '#fff'
      },
      labels: ['Соціальні мережі', 'Робота', 'Розваги', 'Новини', 'Покупки', 'Інше'],
      colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'],
      dataLabels: {
        enabled: true,
        formatter: function(val: number, opts: any) {
          return opts.w.globals.seriesTotals[opts.seriesIndex] > 0 
            ? Math.round(val) + '%' 
            : '';
        },
        style: {
          colors: this.isDarkTheme ? ['#f3eaff'] : ['#23272f']
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '60%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '14px',
                fontFamily: 'inherit',
                color: this.isDarkTheme ? '#f3eaff' : '#23272f'
              },
              value: {
                show: true,
                fontSize: '16px',
                fontFamily: 'inherit',
                fontWeight: 600,
                color: this.isDarkTheme ? '#f3eaff' : '#23272f'
              }
            }
          }
        }
      },
      tooltip: {
        theme: this.isDarkTheme ? 'dark' : 'light',
        y: {
          formatter: function(value: number) {
            return formatDuration(value);
          }
        }
      },
      legend: {
        position: 'bottom',
        labels: {
          colors: this.isDarkTheme ? '#f3eaff' : '#23272f'
        }
      }
    };
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
      this.applyAdvancedFilters();
      await this.prepareChartData(); // Додаємо виклик для оновлення заголовка
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
    
    this.applyAdvancedFilters();
    await this.prepareChartData(); // Додаємо виклик для оновлення заголовка
  }

  private applyAdvancedFilters() {
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
        const durationInMinutes = Math.round(durationValue / 60);
        
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
              visits: Math.round(domain.visits * dateFilterRatio),
              totalDuration: Math.round(domain.totalDuration * dateFilterRatio)
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
              visits: Math.round(domain.visits * dateFilterRatio),
              totalDuration: Math.round(domain.totalDuration * dateFilterRatio)
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
              visits: Math.round(domain.visits * dateFilterRatio),
              totalDuration: Math.round(domain.totalDuration * dateFilterRatio)
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
          avgDuration: Math.round(avgDuration * 100) / 100
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

    // Оновлюємо дані для графіків
    this.updateChartDataWithFilteredDomains(filteredDomains);
    this.cdr.markForCheck();
  }

  private updateChartDataWithFilteredDomains(filteredDomains: any[]) {
    console.log('Оновлюємо дані для графіків з', filteredDomains.length, 'доменами');
    
    // Підготовка даних для графіка активності
    this.activityChartData = filteredDomains.map(domain => ({
      x: domain.decryptedData?.url ? cleanDomainName(domain.decryptedData.url) : domain._id,
      y: domain.visits
    }));
    
    // Підготовка даних для топ доменів
    this.topDomainsData = filteredDomains.slice(0, 10).map(domain => {
      const name = domain.decryptedData?.url ? cleanDomainName(domain.decryptedData.url) : domain._id;
      const title = domain.decryptedData?.title || cleanDomainName(domain._id);
      
      return {
        name,
        title,
        visits: domain.visits,
        duration: domain.totalDuration
      };
    });
    
    console.log('Дані для графіків оновлені:', {
      activityChartData: this.activityChartData.length,
      topDomainsData: this.topDomainsData.length
    });
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
} 