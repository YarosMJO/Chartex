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
            } else {
              this.error = 'Ключ шифрування не знайдено - дані будуть показані як хеші';
              this.loading = false;
              return;
            }
          });
        } catch (error) {
          this.ngZone.run(() => {
            this.error = 'Помилка отримання ключа шифрування';
            this.loading = false;
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