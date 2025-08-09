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
  bubbleChartData: { x: number; y: number; z: number; name: string }[] = [];

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
      const stats = await this.apiService.getUserStatsWithDecryptedData(params);

      console.log('Статистика отримана:', {
        hasStats: !!stats,
        hasTopDomains: !!stats.topDomains,
        topDomainsCount: stats.topDomains?.length || 0
      });

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

    if (!this.userStats) {
      console.log('🔍 HEATMAP DEBUG: No userStats available');
      return;
    }

    try {
      // Виключаємо google.com з усіх графіків
      const filteredTopDomains = this.userStats.topDomains.filter(d => {
        const domain = cleanDomainName(d.decryptedData?.url || d._id);
        return domain !== 'google.com';
      });

      // Підготовка даних для графіка активності
      this.activityChartData = filteredTopDomains
        .slice(0, 10)
        .map(domain => ({
          x: cleanDomainName(domain.decryptedData?.url || domain._id),
          y: domain.visits
        }));

      // Підготовка даних для топ доменів
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

      // Підготовка даних для кругової діаграми
      this.prepareCategoryDistributionData();

      // Підготовка даних для бульбашкової діаграми
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

  // Підготовка даних для бульбашкової діаграми
  private prepareBubbleChartData(): void {
    try {
      console.log('🔍 BUBBLE DEBUG: Starting prepareBubbleChartData');
      console.log('🔍 BUBBLE DEBUG: userStats:', this.userStats);
      console.log('🔍 BUBBLE DEBUG: topDomains:', this.userStats?.topDomains);

      if (!this.userStats || !this.userStats.topDomains || this.userStats.topDomains.length === 0) {
        console.log('🔍 BUBBLE DEBUG: No userStats or topDomains available, using test data');
        // Test data with proportional bubble sizes based on visits
        this.bubbleChartData = [
          { x: 800, y: 20, z: 35, name: 'Test Site 1' },
          { x: 600, y: 80, z: 40, name: 'Test Site 2' },
          { x: 450, y: 45, z: 25, name: 'Test Site 3' },
          { x: 900, y: 120, z: 45, name: 'Test Site 4' },
          { x: 750, y: 95, z: 30, name: 'Test Site 5' }
        ];
        console.log('🔍 BUBBLE DEBUG: Test data set:', this.bubbleChartData);
        return;
      }

      // Вилучаємо google.com
      const filteredTopDomains = this.userStats.topDomains.filter((d: any) => {
        const domain = cleanDomainName(d.decryptedData?.url || d._id);
        return domain !== 'google.com';
      });

      const topDomains = filteredTopDomains.slice(0, 10);
      console.log('🔍 BUBBLE DEBUG: Processing topDomains:', topDomains);
      console.log('🔍 BUBBLE DEBUG: Real data sample:', topDomains.slice(0, 3).map(d => ({
        url: d.decryptedData?.url || d._id,
        visits: d.visits,
        duration: d.totalDuration,
        avgDuration: d.visits > 0 ? d.totalDuration / d.visits : 0
      })));
      
      // Check if we have any domains with meaningful data
      const domainsWithData = topDomains.filter((d: any) => (d.visits || 0) > 0 || (d.totalDuration || 0) > 0);
      console.log('🔍 BUBBLE DEBUG: Domains with data:', domainsWithData.length);
      console.log('🔍 BUBBLE DEBUG: Total domains:', topDomains.length);
      
      // Use domains with data, or fallback to test data if no meaningful data
      const domainsToProcess = domainsWithData.length > 0 ? domainsWithData : topDomains;
      console.log('🔍 BUBBLE DEBUG: Using domains:', domainsToProcess.length);
      
      // If we have no meaningful data, use test data
      if (domainsWithData.length === 0) {
        console.log('🔍 BUBBLE DEBUG: No meaningful data found, using test data');
        this.bubbleChartData = [
          { x: 800, y: 20, z: 35, name: 'Test Site 1' },
          { x: 600, y: 80, z: 40, name: 'Test Site 2' },
          { x: 450, y: 45, z: 25, name: 'Test Site 3' },
          { x: 900, y: 120, z: 45, name: 'Test Site 4' },
          { x: 750, y: 95, z: 30, name: 'Test Site 5' }
        ];
        return;
      }

            // Process real data
      console.log('🔍 BUBBLE DEBUG: Processing real data for bubble chart');
      console.log('🔍 BUBBLE DEBUG: domainsToProcess:', domainsToProcess);
      
      // Calculate ranges for better scaling
      const maxVisits = Math.max(...domainsToProcess.map((d: any) => d.visits || 0));
      const maxDuration = Math.max(...domainsToProcess.map((d: any) => d.totalDuration || 0));
      // Max average duration per visit in minutes (used for bubble size)
      const maxAvgDurationMinutes = Math.max(
        ...domainsToProcess.map((d: any) => {
          const visits = d.visits || 0;
          const totalMinutes = Math.round((d.totalDuration || 0) / 60);
          return visits > 0 ? Math.round(totalMinutes / visits) : 0;
        })
      );
      const minVisits = Math.min(...domainsToProcess.map((d: any) => d.visits || 0));
      const minDuration = Math.min(...domainsToProcess.map((d: any) => d.totalDuration || 0));

      console.log('🔍 BUBBLE DEBUG: Data ranges - visits:', minVisits, '-', maxVisits, 'duration:', minDuration, '-', maxDuration);

      this.bubbleChartData = domainsToProcess.map((domain: any) => {
        const visits = domain.visits || 0;
        const duration = domain.totalDuration || 0;

        // Convert to minutes for better scaling
        const totalDurationMinutes = Math.round(duration / 60);

        // Ensure minimum values for visibility
        const totalTimeMinutes = Math.max(totalDurationMinutes, 1);
        const visitsCount = Math.max(visits, 1);

        // Normalize values to ensure they fit within reasonable chart bounds
        // Scale X (time) to range 50-800 minutes (increased minimum for better spacing)
        const normalizedTime = maxDuration > 0 ? (totalDurationMinutes / maxDuration) : 0;
        const finalX = Math.max(Math.round(normalizedTime * 750) + 50, 50);

        // Scale Y (visits) to range 10-200 visits (increased minimum for better spacing)
        const normalizedVisits = maxVisits > 0 ? (visitsCount / maxVisits) : 0;
        const finalY = Math.max(Math.round(normalizedVisits * 190) + 10, 10);

        // Scale Z (bubble size) based on average time per visit (minutes)
        const avgMinutes = visitsCount > 0 ? Math.round(totalTimeMinutes / visitsCount) : 0;
        const normalizedZ = maxAvgDurationMinutes > 0 ? (avgMinutes / maxAvgDurationMinutes) : 0;
        const finalZ = Math.max(Math.round(normalizedZ * 30) + 15, 15); // Range: 15-45
        
        // Ensure the bubble size is proportional but not too large
        // The z value should be between 15-45 to match our chart options
        const clampedZ = Math.min(Math.max(finalZ, 15), 45);
        
        // Scale down X and Y to ensure bubbles have enough space
        // Use smaller ranges to prevent bubbles from being cut off
        const scaledX = Math.min(finalX, 800); // Cap at 800 to leave margin
        const scaledY = Math.min(finalY, 200); // Cap at 200 to leave margin

        const result = {
          x: scaledX,
          y: scaledY,
          z: clampedZ,
          name: cleanDomainName(domain.decryptedData?.url || domain._id)
        };

        console.log('🔍 BUBBLE DEBUG: Domain data:', domain);
        console.log('🔍 BUBBLE DEBUG: Raw values - visits:', visits, 'duration:', duration);
        console.log('🔍 BUBBLE DEBUG: Final values - finalX:', finalX, 'finalY:', finalY, 'finalZ:', finalZ);
        console.log('🔍 BUBBLE DEBUG: Processed result:', result);
        
        return result;
      });

      console.log('🔍 BUBBLE DEBUG: Final bubbleChartData:', this.bubbleChartData);
    } catch (error) {
      console.error('🔍 BUBBLE DEBUG: Error in prepareBubbleChartData:', error);
      // Fallback to test data on error
      this.bubbleChartData = [
        { x: 800, y: 20, z: 35, name: 'Test Site 1' },
        { x: 600, y: 80, z: 40, name: 'Test Site 2' },
        { x: 450, y: 45, z: 25, name: 'Test Site 3' },
        { x: 900, y: 120, z: 45, name: 'Test Site 4' },
        { x: 750, y: 95, z: 30, name: 'Test Site 5' }
      ];
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
        formatter: function (val: number, opts: any) {
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
        show: true,
        position: 'top',
        horizontalAlign: 'center',
        fontSize: '14px',
        fontFamily: 'inherit',
        markers: {
          width: 12,
          height: 12,
          radius: 6
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
          text: this.translateService.instant('DASHBOARD.CHARTS.X_AXIS_TOTAL_TIME') + ' ' + this.translateService.instant('DASHBOARD.CHARTS.X_AXIS_UNITS')
        },
        min: 0,
        max: 1000, // Increased to provide more padding for bubbles
        tickAmount: 6,
        labels: {
          style: {
            fontSize: '12px'
          }
        },
        tooltip: {
          enabled: false
        },
        axisBorder: {
          show: true,
          color: '#78909c'
        },
        axisTicks: {
          show: true,
          color: '#78909c'
        },
        // Ensure proper spacing for bubbles
        crosshairs: {
          show: false
        }
      },
      yaxis: {
        title: {
          text: this.translateService.instant('DASHBOARD.CHARTS.Y_AXIS_VISITS_COUNT') + ' ' + this.translateService.instant('DASHBOARD.CHARTS.Y_AXIS_UNITS')
        },
        min: 0,
        max: 250, // Increased to provide more padding for bubbles
        tickAmount: 6,
        labels: {
          style: {
            fontSize: '12px'
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
        // Ensure proper spacing for bubbles
        crosshairs: {
          show: false
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function (val: any, opts: any) {
          try {
            const point = opts?.w?.config?.series?.[opts.seriesIndex]?.data?.[opts.dataPointIndex];
            return point?.z ?? '';
          } catch {
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
          right: 16,
          bottom: 26,
          left: 26
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
          const totalMinutes = data?.x ?? 0;
          const visits = data?.y ?? 0;
          const avgMinutes = visits > 0 ? Math.round(totalMinutes / visits) : 0;
          return `
            <div class="bubble-tooltip">
              <div class="title">${siteName}</div>
              <div class="row"><span class="label">${this.translateService.instant('DASHBOARD.CHARTS.TOTAL_TIME')}</span><span class="value">${totalMinutes} ${this.translateService.instant('DASHBOARD.CHARTS.MINUTES')}</span></div>
              <div class="row"><span class="label">${this.translateService.instant('DASHBOARD.FILTERS.DURATION.AVERAGE')}</span><span class="value">${avgMinutes} ${this.translateService.instant('DASHBOARD.CHARTS.MINUTES')}</span></div>
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
    this.activityChartData = filteredDomains
      .filter(domain => cleanDomainName(domain.decryptedData?.url || domain._id) !== 'google.com')
      .map(domain => ({
        x: domain.decryptedData?.url ? cleanDomainName(domain.decryptedData.url) : domain._id,
        y: domain.visits
      }));

    // Підготовка даних для топ доменів
    this.topDomainsData = filteredDomains
      .filter(domain => cleanDomainName(domain.decryptedData?.url || domain._id) !== 'google.com')
      .slice(0, 10).map(domain => {
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