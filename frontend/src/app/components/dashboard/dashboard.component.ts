import { Component, OnInit, NgZone } from '@angular/core';
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
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { ApiService, HistoryStats, Device } from '../../services/api.service';
import { formatDuration, formatNumber, getPeriodLabel, getDomainFromUrl } from '../../utils/utils';

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
  ]
})
export class DashboardComponent implements OnInit {
  currentUser: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null = null;
  userStats: HistoryStats | null = null;
  devices: Device[] = [];
  selectedPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
  selectedDevice: string = 'all';
  loading = false;
  error: string | null = null;

  // Дані для графіків
  activityChartData: { x: string; y: number }[] = [];
  topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];
  deviceStatsData: { name: string; visits: number; duration: number }[] = [];

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.getUser().subscribe(async user => {
      this.currentUser = user;
      if (this.currentUser) {
        this.error = null;
        try {
          const encryptionKey = await this.authService.getEncryptionKey();
          this.ngZone.run(() => {
            if (encryptionKey) {
              this.apiService.setEncryptionKey(encryptionKey);
              console.log('Ключ шифрування успішно встановлено');
            } else {
              this.error = 'Ключ шифрування не знайдено - деякі дані можуть відображатися як хеші';
              console.warn('Ключ шифрування не знайдено, дані будуть показані як хеші');
            }
          });
        } catch (error) {
          this.ngZone.run(() => {
            this.error = 'Помилка отримання ключа шифрування - деякі дані можуть відображатися як хеші';
            console.error('Помилка отримання ключа шифрування:', error);
          });
        }
        this.initializeDashboard();
      } else {
        this.ngZone.run(() => {
          this.error = 'Користувач не авторизований';
          this.loading = false;
        });
      }
    });
  }

  // Ініціалізація дашборду: завантаження статистики та пристроїв
  async initializeDashboard() {
    try {
      this.ngZone.run(() => {
        this.loading = true;
        this.error = null;
      });
      if (!this.currentUser) {
        this.ngZone.run(() => {
          this.error = 'Користувач не авторизований';
        });
        return;
      }
      await Promise.all([
        this.loadUserStats(),
        this.loadDevices()
      ]);
    } catch (error) {
      this.ngZone.run(() => {
        this.error = 'Помилка завантаження даних: ' + (error instanceof Error ? error.message : String(error));
      });
    } finally {
      this.ngZone.run(() => {
        this.loading = false;
      });
    }
  }

  // Завантаження статистики користувача
  async loadUserStats() {
    try {
      const params: { period: '7d' | '30d' | '90d' | '1y' | 'all'; deviceId?: string } = {
        period: this.selectedPeriod
      };
      if (this.selectedDevice !== 'all') {
        params.deviceId = this.selectedDevice;
      }
      const stats = await this.apiService.getUserStatsWithDecryptedData(params);
      this.ngZone.run(() => {
        this.userStats = stats;
        if (!this.userStats || !this.userStats.stats) {
          this.error = 'Дані статистики не отримано.';
          return;
        }
        this.prepareChartData();
      });
    } catch (error) {
      this.ngZone.run(() => {
        this.error = 'Помилка завантаження статистики: ' + (error instanceof Error ? error.message : String(error));
      });
    }
  }

  // Завантаження пристроїв користувача
  async loadDevices() {
    try {
      const devices = await this.apiService.getDevices();
      this.ngZone.run(() => {
        this.devices = devices;
        if (!this.devices) {
          this.error = 'Дані пристроїв не отримано.';
          return;
        }
      });
    } catch (error) {
      this.ngZone.run(() => {
        this.error = 'Помилка завантаження пристроїв: ' + (error instanceof Error ? error.message : String(error));
      });
    }
  }

  // Підготовка даних для графіків
  prepareChartData() {
    if (!this.userStats) return;
    
    // Дані для графіка активності
    this.activityChartData = this.userStats.topDomains.map(domain => ({
      x: domain.decryptedData?.url ? getDomainFromUrl(domain.decryptedData.url) : domain._id,
      y: domain.visits
    }));
    
    // Дані для топ доменів
    this.topDomainsData = this.userStats.topDomains.slice(0, 10).map(domain => ({
      name: domain.decryptedData?.url || domain._id,
      title: domain.decryptedData?.title || getDomainFromUrl(domain._id),
      visits: domain.visits,
      duration: domain.totalDuration
    }));
    
    // Дані для статистики пристроїв
    this.deviceStatsData = this.devices.map(device => ({
      name: device.deviceName,
      visits: device.stats?.totalVisits || 0,
      duration: device.stats?.totalDuration || 0
    }));
  }

  // Зміна періоду
  async onPeriodChange() {
    await this.loadUserStats();
  }

  // Зміна пристрою
  async onDeviceChange() {
    await this.loadUserStats();
  }

  formatDuration = formatDuration;
  formatNumber = formatNumber;
  getPeriodLabel = getPeriodLabel;

  get isDarkTheme(): boolean {
    return document.body.classList.contains('theme-dark');
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
    });
  }

  // Вхід через Google
  loginWithGoogle() {
    // Цей метод буде викликатися з extension
    if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
      (window as any).chrome.runtime.sendMessage({ action: 'loginWithGoogle' });
    } else {
      this.error = 'Extension не знайдено. Будь ласка, встановіть Chartex extension.';
    }
  }
} 