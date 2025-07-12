import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { NgApexchartsModule } from 'ng-apexcharts';
import { AuthService } from '../../services/auth.service';
import { ApiService, HistoryStats, Device } from '../../services/api.service';
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
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
    MatMenuModule
  ]
})
export class DashboardComponent implements OnInit {
  currentUser: any | null = null;
  userStats: HistoryStats | null = null;
  devices: Device[] = [];
  selectedPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
  selectedDevice: string = 'all';
  loading = false;
  error: string | null = null;

  // Дані для графіків
  activityChartData: any[] = [];
  topDomainsData: any[] = [];
  deviceStatsData: any[] = [];

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
    private ngZone: NgZone // Для форсованого оновлення UI
  ) { }

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
              console.log('Ключ шифрування встановлено в API сервіс');
            } else {
              console.warn('Ключ шифрування не знайдено - дані будуть показані як хеші');
              this.error = 'Ключ шифрування не знайдено - дані будуть показані як хеші';
              this.loading = false;
              return;
            }
          });
        } catch (error) {
          this.ngZone.run(() => {
            console.error('Помилка отримання ключа шифрування:', error);
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

  async loadUserStats() {
    try {
      console.log('Завантаження статистики користувача...');
      const params: any = {
        period: this.selectedPeriod
      };
      if (this.selectedDevice !== 'all') {
        params.deviceId = this.selectedDevice;
      }
      console.log('Dashboard loadUserStats params:', params);
      const stats = await this.apiService.getUserStatsWithDecryptedData(params);
      this.ngZone.run(() => {
        this.userStats = stats;
        if (!this.userStats || !this.userStats.stats) {
          this.error = 'Дані статистики не отримано.';
          return;
        }
        console.log('Отримана статистика:', this.userStats);
        this.prepareChartData();
      });
    } catch (error) {
      this.ngZone.run(() => {
        console.error('Помилка завантаження статистики:', error);
        this.error = 'Помилка завантаження статистики: ' + (error instanceof Error ? error.message : String(error));
      });
    }
  }

  async loadDevices() {
    try {
      console.log('Завантаження пристроїв...');
      const devices = await this.apiService.getDevices();
      this.ngZone.run(() => {
        this.devices = devices;
        if (!this.devices) {
          this.error = 'Дані пристроїв не отримано.';
          return;
        }
        console.log('Отримані пристрої:', this.devices);
      });
    } catch (error) {
      this.ngZone.run(() => {
        console.error('Помилка завантаження пристроїв:', error);
        this.error = 'Помилка завантаження пристроїв: ' + (error instanceof Error ? error.message : String(error));
      });
    }
  }

  prepareChartData() {
    if (!this.userStats) return;

    // Функція для отримання домену з URL
    const getDomainFromUrl = (url: string): string => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch {
        return url;
      }
    };

    // Підготувати дані для графіка активності з дешифрованими URL
    this.activityChartData = this.userStats.topDomains.map(domain => ({
      x: domain.decryptedData?.url ? getDomainFromUrl(domain.decryptedData.url) : domain._id,
      y: domain.visits
    }));

    // Підготувати дані для топ доменів з дешифрованими URL
    this.topDomainsData = this.userStats.topDomains.slice(0, 10).map(domain => ({
      name: domain.decryptedData?.url || domain._id, // Повний URL
      title: domain.decryptedData?.title || getDomainFromUrl(domain._id), // Заголовок або домен
      visits: domain.visits,
      duration: domain.totalDuration
    }));

    // Підготувати дані для статистики пристроїв
    this.deviceStatsData = this.devices.map(device => ({
      name: device.deviceName,
      visits: device.stats?.totalVisits || 0,
      duration: device.stats?.totalDuration || 0
    }));
  }

  async onPeriodChange() {
    await this.loadUserStats();
  }

  async onDeviceChange() {
    await this.loadUserStats();
  }

  async loginWithGoogle() {
    try {
      console.log('Натиснуто кнопку Google Login');
      (window as any).chrome.runtime.sendMessage(
        { action: 'getGoogleIdToken' },
        (response: any) => {
          console.log('Відповідь від background:', response);
          if (response && response.idToken) {
            this.authService.loginWithGoogleCredential(response.idToken).subscribe({
              next: (res) => {
                console.log('Успішний вхід:', res);
              },
              error: (err) => {
                alert('Помилка входу через Google: ' + (err?.message || err));
              }
            });
          } else {
            alert('Не вдалося отримати токен Google');
          }
        }
      );
    } catch (error) {
      console.error('Помилка входу через Google:', error);
      alert('Помилка входу через Google: ' + error);
    }
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}с`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}хв`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}год ${minutes}хв`;
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  getPeriodLabel(period: string): string {
    const labels = {
      '7d': '7 днів',
      '30d': '30 днів',
      '90d': '90 днів',
      '1y': '1 рік',
      'all': 'Весь час'
    };
    return labels[period as keyof typeof labels] || period;
  }
} 