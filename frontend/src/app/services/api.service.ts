import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
  private readonly API_BASE_URL = environment.apiUrl;
  private encryptionKey: string | null = null; // Ключ шифрування

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Отримати ключ шифрування з localStorage
    this.encryptionKey = localStorage.getItem('chartex_encryption_key');
  }

  // Метод для встановлення ключа шифрування
  setEncryptionKey(key: string) {
    console.log('Встановлення ключа шифрування:', { 
      hasKey: !!key, 
      keyLength: key?.length,
      keyPreview: key?.substring(0, 10) + '...'
    });
    this.encryptionKey = key;
    localStorage.setItem('chartex_encryption_key', key);
  }

  // Метод для дешифрування даних
  private decryptData(encryptedData: string): DecryptedData | undefined {
    if (!this.encryptionKey) {
      console.warn('Ключ шифрування не знайдено');
      return undefined;
    }

    try {
      console.log('Спроба дешифрування даних:', { 
        hasEncryptedData: !!encryptedData, 
        encryptedDataLength: encryptedData?.length 
      });
      
      // Використовуємо той самий алгоритм, що й в extension
      const decrypted = this.base64ToUtf8(encryptedData);
      const parts = decrypted.split('|');
      
      console.log('Дешифровані частини:', { 
        partsCount: parts.length, 
        hasKey: parts[1] === this.encryptionKey 
      });
      
      if (parts[1] === this.encryptionKey) {
        const decryptedData = JSON.parse(parts[0]);
        console.log('Успішно дешифровано:', decryptedData);
        return decryptedData;
      }
      throw new Error('Невірний ключ шифрування');
    } catch (error) {
      console.error('Помилка дешифрування:', error);
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
      console.error('Base64 to UTF8 error:', error);
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
    const itemsWithDecryptedData = response.items.map(item => ({
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
  } = {}): Promise<HistoryStats> {
    const stats = await this.getUserStats(params);
    
    console.log('Отримана статистика для дешифрування:', {
      hasStats: !!stats,
      topDomainsCount: stats.topDomains?.length || 0,
      hasEncryptionKey: !!this.encryptionKey
    });
    
    // Дешифрувати дані для топ доменів
    const topDomainsWithDecryptedData = stats.topDomains.map((domain, index) => {
      console.log(`Дешифрування домену ${index + 1}:`, {
        hasEncryptedData: !!domain.encryptedData,
        encryptedDataLength: domain.encryptedData?.length
      });
      
      const decryptedData = domain.encryptedData ? this.decryptData(domain.encryptedData) : undefined;
      
      console.log(`Результат дешифрування ${index + 1}:`, {
        success: !!decryptedData,
        decryptedUrl: decryptedData?.url
      });
      
      return {
        ...domain,
        decryptedData
      };
    });

    return {
      ...stats,
      topDomains: topDomainsWithDecryptedData
    };
  }

    private async getHeaders(): Promise<HttpHeaders> {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
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
    const httpParams = new HttpParams({ fromObject: params as any });
    
    return this.http.get<PaginatedResponse<HistoryItem>>(
      `${this.API_BASE_URL}/history`,
      { headers, params: httpParams }
    ).toPromise() as Promise<PaginatedResponse<HistoryItem>>;
  }

  async getHistoryStats(params: {
    deviceId?: string;
    from?: string;
    to?: string;
    groupBy?: 'day' | 'hour' | 'domain';
  } = {}): Promise<any[]> {
    const headers = await this.getHeaders();
    const httpParams = new HttpParams({ fromObject: params as any });
    
    return this.http.get<any[]>(
      `${this.API_BASE_URL}/history/stats`,
      { headers, params: httpParams }
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
    const httpParams = new HttpParams({ fromObject: params as any });
    
    return this.http.delete<{ success: boolean; deletedCount: number }>(
      `${this.API_BASE_URL}/history`,
      { headers, params: httpParams }
    ).toPromise() as Promise<{ success: boolean; deletedCount: number }>;
  }

  // Пристрої
  async getDevices(): Promise<Device[]> {
    const headers = await this.getHeaders();
    
    return this.http.get<Device[]>(
      `${this.API_BASE_URL}/devices`,
      { headers }
    ).toPromise() as Promise<Device[]>;
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
    const httpParams = new HttpParams({ fromObject: params as any });
    
    return this.http.get<any>(
      `${this.API_BASE_URL}/devices/${deviceId}/stats`,
      { headers, params: httpParams }
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
  } = {}): Promise<HistoryStats> {
    const headers = await this.getHeaders();
    const httpParams = new HttpParams({ fromObject: params as any });
    
    console.log('API getUserStats params:', params);
    console.log('API getUserStats deviceId:', params.deviceId);
    console.log('API getUserStats hasDeviceId:', !!params.deviceId);
    console.log('API getUserStats URL:', `${this.API_BASE_URL}/users/stats`);
    
    return this.http.get<HistoryStats>(
      `${this.API_BASE_URL}/users/stats`,
      { headers, params: httpParams }
    ).toPromise() as Promise<HistoryStats>;
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
} 