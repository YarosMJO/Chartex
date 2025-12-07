import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

// Інтерфейс для дешифрованих приватних даних
export interface DecryptedData {
  url: string;
  title: string;
  faviconUrl?: string;
  referrer?: string;
  notes?: string;
  tags?: string[];
}

export interface HistoryItem {
  _id?: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  encryptedData: string;
  domainHash: string;
  visitCount: number;
  typedCount: number;
  duration: number;
  transitionType: string;
  deviceType: string;
  browser: string;
  language: string;
  screenResolution: string;
  os: string;
  visitTime: Date;
  createdAt: Date;
  updatedAt: Date;
  isBookmarked: boolean;
  isIncognito: boolean;
  tabId?: number;
  windowId?: number;
  countryCode?: string;
  timeOfDay: number;
  dayOfWeek: number;
  month: number;
  year: number;
}

export interface Device {
  _id?: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  userAgent: string;
  screenResolution: string;
  language: string;
  timezone: string;
  totalVisits: number;
  lastVisit?: Date;
  firstVisit: Date;
  isActive: boolean;
  lastSync: Date;
  encryptedLocation?: string;
  os: string;
  version: string;
  extensions: string[];
  stats?: {
    totalVisits: number;
    totalDuration: number;
    lastVisit?: Date;
  };
}

export interface HistoryStats {
  period: string;
  stats: {
    totalVisits: number;
    uniqueDomains: number;
    totalDuration: number;
    avgDuration: number;
  };
  topDomains: Array<{
    _id: string;
    visits: number;
    totalDuration: number;
    encryptedData?: string; // Зашифровані дані для дешифрування
    decryptedData?: DecryptedData; // Дешифровані дані
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private API_BASE_URL: string = environment.apiUrl; // Будемо оновлювати динамічно
  private encryptionKey: string | null = null; // Ключ шифрування

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Отримати ключ шифрування з localStorage
    this.encryptionKey = localStorage.getItem('chartex_encryption_key');
    
    // Встановлюємо API за замовчуванням (тепер завжди 5000)
    this.API_BASE_URL = 'http://localhost:5000/api';
    console.log('Angular API Service: Ініціалізовано з API (5000)');
    
    // Асинхронно перевіряємо доступність та оновлюємо якщо потрібно
    this.detectAvailableAPI();
  }

  // Динамічне визначення доступного API (тепер завжди 5000)
  private async detectAvailableAPI() {
    const apiUrl = 'http://localhost:5000/api';
    
    // Пробуємо кілька разів з різними інтервалами
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`Angular API Service: Спроба ${attempt}/3 перевірки API (5000)`);
      
      try {
        const response = await fetch(apiUrl.replace('/api', '/api/health'), {
          method: 'GET',
          mode: 'cors',
          signal: AbortSignal.timeout(2000) // 2 секунди timeout
        });
        
        if (response.ok) {
          this.API_BASE_URL = apiUrl;
          console.log('Angular API Service: ✅ API (5000) доступний');
          return;
        }
      } catch (error) {
        console.log(`Angular API Service: API (5000) недоступний (спроба ${attempt}):`, error instanceof Error ? error.message : String(error));
      }
      
      // Затримка між спробами
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    // Якщо API недоступний після всіх спроб
    console.log('Angular API Service: ⚠️ API недоступний, використовуємо:', this.API_BASE_URL);
  }

  // Метод для встановлення ключа шифрування
  setEncryptionKey(key: string) {
    this.encryptionKey = key;
    localStorage.setItem('chartex_encryption_key', key);
  }

  // Метод для отримання поточного API URL (для діагностики)
  getCurrentAPIUrl(): string {
    return this.API_BASE_URL;
  }

  // Метод для примусового оновлення API URL
  async refreshAPIUrl(): Promise<string> {
    console.log('Angular API Service: Примусове оновлення API URL...');
    await this.detectAvailableAPI();
    return this.API_BASE_URL;
  }

  // Метод для дешифрування даних
  private decryptData(encryptedData: string): DecryptedData | undefined {
    if (!this.encryptionKey) {
      return undefined;
    }

    try {
      // Використовуємо той самий алгоритм, що й в extension
      const decrypted = this.base64ToUtf8(encryptedData);
      const parts = decrypted.split('|');
      
      if (parts[1] === this.encryptionKey) {
        const decryptedData = JSON.parse(parts[0]);
        return decryptedData;
      }
      
      // Якщо ключ не співпадає, повертаємо undefined без попередження
      // (це нормально для старих даних або даних з іншого ключа)
      return undefined;
    } catch (error) {
      // Повертаємо undefined замість викидання помилки
      return undefined;
    }
  }
  
  // Безпечне декодування Base64 в Unicode (аналогічно extension)
  private base64ToUtf8(base64: string): string {
    try {
      // Для браузера використовуємо TextDecoder
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      return decoder.decode(bytes);
    } catch (error) {
      // Fallback для старих браузерів
      return decodeURIComponent(escape(atob(base64)));
    }
  }

  // Метод для отримання історії з дешифрованими даними
  async getHistoryWithDecryptedData(params: {
    deviceId?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResponse<HistoryItem & { decryptedData?: DecryptedData }>> {
    const response = await this.getHistory(params);
    
    // Дешифрувати дані для кожного запису
    const itemsWithDecryptedData = (response?.items || []).map(item => ({
      ...item,
      decryptedData: this.decryptData(item.encryptedData)
    }));

    return {
      ...response,
      items: itemsWithDecryptedData
    };
  }

  // Оновлений метод для отримання статистики з дешифрованими даними
  async getUserStatsWithDecryptedData(params: {
    period?: '7d' | '30d' | '90d' | '1y' | 'all';
    deviceId?: string;
    forceRefresh?: boolean;
    _t?: number;
  } = {}): Promise<HistoryStats> {
    try {
      // Розраховуємо дати для періоду
      const now = new Date();
      let fromDate: Date;
      
      switch (params.period) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0); // Всі дані
      }
      
      // Завжди використовуємо фільтри за датою для правильної статистики
      const requestParams: any = {
        from: fromDate.toISOString(),
        to: now.toISOString(),
        limit: 1000
      };
      
      if (params.deviceId && params.deviceId !== 'all') {
        requestParams.deviceId = params.deviceId;
      }
      
      // Додаємо параметри для примусового оновлення
      if (params.forceRefresh) {
        requestParams.forceRefresh = true;
        requestParams._t = params._t || Date.now();
      }
      
      let historyResponse = await this.getHistoryWithDecryptedData(requestParams);
      
      if (!historyResponse.items || historyResponse.items.length === 0) {
        // Fallback до старого методу
        try {
          const fallbackParams = {
            ...params,
            from: fromDate.toISOString(),
            to: now.toISOString()
          };
          const fallbackStats = await this.getUserStats(fallbackParams);
          return fallbackStats;
        } catch (fallbackError) {
          // Повертаємо порожню статистику як останній fallback
          return {
            period: params.period || '30d',
            stats: {
              totalVisits: 0,
              uniqueDomains: 0,
              totalDuration: 0,
              avgDuration: 0
            },
            topDomains: []
          };
        }
      }
      
      // Агрегуємо дані з історії
      const domainStats = new Map<string, {
        visits: number;
        totalDuration: number;
        decryptedData?: DecryptedData;
      }>();
      
      let totalVisits = 0;
      let totalDuration = 0;
      
      
      historyResponse.items.forEach((item, index) => {
        const visitCount = item.visitCount || 1;
        const duration = item.duration || 0;
        
        
        totalVisits += visitCount;
        totalDuration += duration;
        
        
        if (item.decryptedData?.url) {
          const domain = this.getDomainFromUrl(item.decryptedData.url);
          const existing = domainStats.get(domain);
          
          if (existing) {
            existing.visits += visitCount;
            existing.totalDuration += duration;
          } else {
            domainStats.set(domain, {
              visits: visitCount,
              totalDuration: duration,
              decryptedData: item.decryptedData
            });
          }
        }
      });
      
      // Конвертуємо в масив і сортуємо за кількістю відвідувань
      const topDomains = Array.from(domainStats.entries())
        .map(([domain, stats]) => ({
          _id: domain,
          visits: stats.visits,
          totalDuration: stats.totalDuration,
          decryptedData: stats.decryptedData
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10); // Топ 10 доменів
      
      
      const uniqueDomains = domainStats.size;
      const avgDuration = uniqueDomains > 0 ? totalDuration / uniqueDomains : 0;
      
      
      
      return {
        period: params.period || '30d',
        stats: {
          totalVisits,
          uniqueDomains,
          totalDuration,
          avgDuration
        },
        topDomains
      };
    } catch (error) {
      // Fallback до звичайної статистики
      try {
        // Розраховуємо дати для періоду
        const now = new Date();
        let fromDate: Date;
        
        switch (params.period) {
          case '7d':
            fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case '1y':
            fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            fromDate = new Date(0); // Всі дані
        }
        
        const fallbackParams = {
          ...params,
          from: fromDate.toISOString(),
          to: now.toISOString()
        };
        const fallbackStats = await this.getUserStats(fallbackParams);
        return fallbackStats;
      } catch (fallbackError) {
        // Повертаємо порожню статистику як останній fallback
        return {
          period: params.period || '30d',
          stats: {
            totalVisits: 0,
            uniqueDomains: 0,
            totalDuration: 0,
            avgDuration: 0
          },
          topDomains: []
        };
      }
    }
  }
  
  // Допоміжний метод для отримання домену з URL
  private getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

    private async getHeaders() {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json'
    };
    
    // Додаємо токен авторизації, якщо він є
    try {
      const token = await this.authService.getCurrentUserToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      // Токен не знайдено, продовжуємо без авторизації
    }
    
    return headers;
  }

  // Історія
  async getHistory(params: {
    deviceId?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<PaginatedResponse<HistoryItem>> {
    const headers = await this.getHeaders();
    const httpParams = new URLSearchParams();
    
    // Додаємо параметри вручну для правильної обробки
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams.append(key, value.toString());
      }
    });
    
    const url = `${this.API_BASE_URL}/history?${httpParams.toString()}`;
    
    const response = await this.http.get<PaginatedResponse<HistoryItem>>(
      url,
      { headers }
    ).toPromise();
    
    return response as PaginatedResponse<HistoryItem>;
  }

  async getHistoryStats(params: {
    deviceId?: string;
    from?: string;
    to?: string;
    groupBy?: 'day' | 'hour' | 'domain';
  } = {}): Promise<any[]> {
    const headers = await this.getHeaders();
    const httpParams = new URLSearchParams();
    
    // Додаємо параметри вручну для правильної обробки
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams.append(key, value.toString());
      }
    });
    
    return this.http.get<any[]>(
      `${this.API_BASE_URL}/history/stats?${httpParams.toString()}`,
      { headers }
    ).toPromise() as Promise<any[]>;
  }

  async addHistoryItem(item: Omit<HistoryItem, 'userId' | '_id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; id: string }> {
    const headers = await this.getHeaders();
    
    return this.http.post<{ success: boolean; id: string }>(
      `${this.API_BASE_URL}/history/add`,
      item,
      { headers }
    ).toPromise() as Promise<{ success: boolean; id: string }>;
  }

  async addHistoryBatch(items: Omit<HistoryItem, 'userId' | '_id' | 'createdAt' | 'updatedAt'>[]): Promise<{ success: boolean; count: number }> {
    const headers = await this.getHeaders();
    
    return this.http.post<{ success: boolean; count: number }>(
      `${this.API_BASE_URL}/history/batch`,
      { items },
      { headers }
    ).toPromise() as Promise<{ success: boolean; count: number }>;
  }

  async deleteHistory(params: {
    deviceId?: string;
    from?: string;
    to?: string;
    domainHash?: string;
  } = {}): Promise<{ success: boolean; deletedCount: number }> {
    const headers = await this.getHeaders();
    const httpParams = new URLSearchParams(params as any);
    
    return this.http.delete<{ success: boolean; deletedCount: number }>(
      `${this.API_BASE_URL}/history?${httpParams.toString()}`,
      { headers }
    ).toPromise() as Promise<{ success: boolean; deletedCount: number }>;
  }

  // Пристрої
  async getDevices(): Promise<Device[]> {
    const headers = await this.getHeaders();
    
    const devices = await this.http.get<Device[]>(
      `${this.API_BASE_URL}/devices`,
      { headers }
    ).toPromise() as Device[];
    return devices;
  }

  async registerDevice(device: Omit<Device, 'userId' | '_id' | 'totalVisits' | 'firstVisit' | 'isActive' | 'lastSync'>): Promise<{ success: boolean; device: Device }> {
    const headers = await this.getHeaders();
    
    return this.http.post<{ success: boolean; device: Device }>(
      `${this.API_BASE_URL}/devices/register`,
      device,
      { headers }
    ).toPromise() as Promise<{ success: boolean; device: Device }>;
  }

  async updateDeviceName(deviceId: string, deviceName: string): Promise<{ success: boolean; device: Device }> {
    const headers = await this.getHeaders();
    
    return this.http.put<{ success: boolean; device: Device }>(
      `${this.API_BASE_URL}/devices/${deviceId}/name`,
      { deviceName },
      { headers }
    ).toPromise() as Promise<{ success: boolean; device: Device }>;
  }

  async deactivateDevice(deviceId: string): Promise<{ success: boolean; device: Device }> {
    const headers = await this.getHeaders();
    
    return this.http.put<{ success: boolean; device: Device }>(
      `${this.API_BASE_URL}/devices/${deviceId}/deactivate`,
      {},
      { headers }
    ).toPromise() as Promise<{ success: boolean; device: Device }>;
  }

  async deleteDevice(deviceId: string): Promise<{ success: boolean; message: string }> {
    const headers = await this.getHeaders();
    
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.API_BASE_URL}/devices/${deviceId}`,
      { headers }
    ).toPromise() as Promise<{ success: boolean; message: string }>;
  }

  async getDeviceStats(deviceId: string, params: {
    period?: '7d' | '30d' | '90d' | '1y' | 'all';
  } = {}): Promise<{
    period: string;
    stats: {
      totalVisits: number;
      uniqueDomains: number;
      totalDuration: number;
      avgDuration: number;
      firstVisit?: Date;
      lastVisit?: Date;
    };
    dailyActivity: Array<{
      _id: { year: number; month: number; day: number };
      visits: number;
      duration: number;
    }>;
  }> {
    const headers = await this.getHeaders();
    const httpParams = new URLSearchParams(params as any);
    
    return this.http.get<any>(
      `${this.API_BASE_URL}/devices/${deviceId}/stats?${httpParams.toString()}`,
      { headers }
    ).toPromise() as Promise<any>;
  }

  // Користувачі
  async getUserProfile(): Promise<any> {
    const headers = await this.getHeaders();
    
    return this.http.get<any>(
      `${this.API_BASE_URL}/users/profile`,
      { headers }
    ).toPromise() as Promise<any>;
  }

  async updateUserSettings(settings: {
    dataRetentionDays?: number;
    allowGlobalAnalytics?: boolean;
    language?: string;
    timezone?: string;
    theme?: string;
  }): Promise<{ success: boolean; user: any }> {
    const headers = await this.getHeaders();
    
    return this.http.put<{ success: boolean; user: any }>(
      `${this.API_BASE_URL}/users/settings`,
      settings,
      { headers }
    ).toPromise() as Promise<{ success: boolean; user: any }>;
  }

  async getUserStats(params: {
    period?: '7d' | '30d' | '90d' | '1y' | 'all';
    deviceId?: string;
    from?: string;
    to?: string;
  } = {}): Promise<HistoryStats> {
    const headers = await this.getHeaders();
    const httpParams = new URLSearchParams();
    
    // Додаємо всі параметри, включаючи from/to
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams.append(key, value.toString());
      }
    });
    
    const url = `${this.API_BASE_URL}/users/stats?${httpParams.toString()}`;
    
    const response = await this.http.get<HistoryStats>(
      url,
      { headers }
    ).toPromise();
    
    return response as HistoryStats;
  }

  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    const headers = await this.getHeaders();
    
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.API_BASE_URL}/users/account`,
      { headers }
    ).toPromise() as Promise<{ success: boolean; message: string }>;
  }

  async getGlobalStats(): Promise<any> {
    const headers = await this.getHeaders();
    
    return this.http.get<any>(
      `${this.API_BASE_URL}/global-stats`,
      { headers }
    ).toPromise() as Promise<any>;
  }

  // Очищення всіх даних користувача
  async clearUserData(): Promise<{ success: boolean; deletedCount: number }> {
    const headers = await this.getHeaders();
    
    return this.http.delete<{ success: boolean; deletedCount: number }>(
      `${this.API_BASE_URL}/users/data`,
      { headers }
    ).toPromise() as Promise<{ success: boolean; deletedCount: number }>;
  }

  // Отримання поточного deviceId з localStorage
  private getCurrentDeviceIdFromStorage(): string | null {
    try {
      return localStorage.getItem('chartex_device_id');
    } catch (error) {
      return null;
    }
  }

} 