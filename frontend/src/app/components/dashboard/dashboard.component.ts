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
import { formatDuration, formatNumber, getPeriodLabel, getDomainFromUrl, getDeviceTypeLabel, cleanDomainName } from '../../utils/utils';
import { StatsCardsComponent } from './stats-cards/stats-cards.component';
import { ChartsSectionComponent } from './charts-section/charts-section.component';
import { FiltersSectionComponent } from './filters-section/filters-section.component';
import { DevicesSectionComponent } from './devices-section/devices-section.component';

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
    DevicesSectionComponent
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

  // Дані для графіків
  activityChartData: { x: string; y: number }[] = [];
  topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];
  deviceStatsData: { name: string; visits: number; duration: number }[] = [];

  // Флаг для запобігання зайвим оновленням графіка
  private lastChartDataHash = '';
  
  // Кеш для методів форматування
  private formatCache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 100;

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
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
      this.prepareChartData();
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
  prepareChartData() {
    if (!this.userStats) return;
    
    // Створюємо хеш поточних даних для порівняння
    const currentDataHash = JSON.stringify({
      period: this.selectedPeriod,
      device: this.selectedDevice,
      stats: this.userStats.stats,
      topDomains: this.userStats.topDomains
    });
    
    // Перевіряємо чи дані дійсно змінилися
    if (currentDataHash === this.lastChartDataHash) {
      console.log('Дані для графіків не змінилися, пропускаємо оновлення');
      return;
    }
    
    console.log('Дані для графіків змінилися, оновлюємо...');
    this.lastChartDataHash = currentDataHash;
    
    // Підготовка даних для графіка активності
    this.activityChartData = this.userStats.topDomains.map(domain => ({
      x: domain.decryptedData?.url ? cleanDomainName(domain.decryptedData.url) : domain._id,
      y: domain.visits
    }));
    
    // Підготовка даних для топ доменів
    this.topDomainsData = this.userStats.topDomains.slice(0, 10).map(domain => {
      const name = domain.decryptedData?.url ? cleanDomainName(domain.decryptedData.url) : domain._id;
      const title = domain.decryptedData?.title || cleanDomainName(domain._id);
      
      return {
        name,
        title,
        visits: domain.visits,
        duration: domain.totalDuration
      };
    });
    
    // Підготовка даних для статистики пристроїв
    this.deviceStatsData = this.devices.map(device => ({
      name: device.deviceName,
      visits: device.stats?.totalVisits || 0,
      duration: device.stats?.totalDuration || 0
    }));
    
    console.log('Дані для графіків підготовлені:', {
      activityChartDataLength: this.activityChartData.length,
      topDomainsDataLength: this.topDomainsData.length,
      deviceStatsDataLength: this.deviceStatsData.length
    });
    
    // Скидаємо флаг після підготовки даних
    setTimeout(() => {
      this.cdr.markForCheck();
    }, 0);
    
    this.cdr.markForCheck();
  }

  // Зміна періоду
  async onPeriodChange() {
    console.log('onPeriodChange() викликано, поточний період:', this.selectedPeriod, 'попередній:', this.previousPeriod);
    
    // Очищаємо попередній таймаут
    if (this.periodChangeTimeout) {
      clearTimeout(this.periodChangeTimeout);
    }
    
    // Встановлюємо новий таймаут
    this.periodChangeTimeout = setTimeout(async () => {
      // Оновлюємо графік тільки якщо період дійсно змінився
      if (this.selectedPeriod !== this.previousPeriod) {
        console.log('Період змінився з', this.previousPeriod, 'на', this.selectedPeriod);
        this.previousPeriod = this.selectedPeriod;
        await this.loadUserStats();
        this.cdr.markForCheck();
      } else {
        console.log('Період не змінився, пропускаємо оновлення');
      }
    }, 300); // Затримка 300мс
  }

  // Зміна пристрою
  async onDeviceChange() {
    console.log('onDeviceChange() викликано, поточний пристрій:', this.selectedDevice, 'попередній:', this.previousDevice);
    
    // Очищаємо попередній таймаут
    if (this.deviceChangeTimeout) {
      clearTimeout(this.deviceChangeTimeout);
    }
    
    // Встановлюємо новий таймаут
    this.deviceChangeTimeout = setTimeout(async () => {
      // Оновлюємо графік тільки якщо пристрій дійсно змінився
      if (this.selectedDevice !== this.previousDevice) {
        console.log('Пристрій змінився з', this.previousDevice, 'на', this.selectedDevice);
        this.previousDevice = this.selectedDevice;
        await this.loadUserStats();
        this.cdr.markForCheck();
      } else {
        console.log('Пристрій не змінився, пропускаємо оновлення');
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
} 