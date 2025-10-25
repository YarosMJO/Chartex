import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { HeatmapSeries, HeatmapService } from '../../../../services/heatmap.service';

@Component({
  selector: 'app-time-heatmap',
  templateUrl: './time-heatmap.component.html',
  styleUrls: ['./time-heatmap.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeHeatmapComponent implements OnChanges {
  @Input() timeOfDayWeekHeatmapData: HeatmapSeries[] = [];
  @Input() isDarkTheme: boolean = false;
  @Input() filteredDomains: any[] = [];
  @Input() userStats: any = null;
  @Input() selectedPeriod: string = '';
  @Input() selectedDevice: string = '';

  // Кеш для опцій графіка
  private _chartOptions: any = null;
  private _lastThemeState: boolean | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private heatmapService: HeatmapService
  ) { }

  ngOnChanges() {
    // Якщо є відфільтровані домени, підготовлюємо дані з них
    if (this.filteredDomains && this.filteredDomains.length > 0) {
      this.prepareDataFromFilteredDomains(this.filteredDomains);
    } else if (this.userStats && this.userStats.topDomains) {
      // Підготовлюємо дані з userStats
      this.prepareDataFromUserStats();
    }
    this.cdr.markForCheck();
  }

  // Метод для підготовки даних з userStats
  private async prepareDataFromUserStats(): Promise<void> {
    try {
      const heatmapData = await this.heatmapService.prepareTimeOfDayWeekHeatmapData(
        this.selectedPeriod,
        this.selectedDevice
      );

      this.timeOfDayWeekHeatmapData = heatmapData;
    } catch (error) {
      this.timeOfDayWeekHeatmapData = [];
    }
    
    this.cdr.markForCheck();
  }

  // Метод для підготовки даних з відфільтрованих доменів
  private async prepareDataFromFilteredDomains(filteredDomains: any[]): Promise<void> {
    if (!filteredDomains || filteredDomains.length === 0) {
      this.timeOfDayWeekHeatmapData = [];
      this.cdr.markForCheck();
      return;
    }

    try {
      // Створюємо тимчасовий об'єкт userStats з відфільтрованими даними
      const tempUserStats = {
        ...this.userStats,
        topDomains: filteredDomains,
        stats: {
          ...this.userStats?.stats,
          totalVisits: filteredDomains.reduce((sum, domain) => sum + (domain.visits || 0), 0),
          totalDuration: filteredDomains.reduce((sum, domain) => sum + (domain.totalDuration || 0), 0),
          uniqueDomains: filteredDomains.length
        }
      };

      const heatmapData = await this.heatmapService.prepareTimeOfDayWeekHeatmapData(
        this.selectedPeriod,
        this.selectedDevice
      );

      this.timeOfDayWeekHeatmapData = heatmapData;
    } catch (error) {
      this.timeOfDayWeekHeatmapData = [];
    }
    
    this.cdr.markForCheck();
  }

  get timeOfDayWeekHeatmapOptions() {
    // Обчислюємо максимальне значення з даних heatmap
    let maxVal = 1;
    if (this.timeOfDayWeekHeatmapData && this.timeOfDayWeekHeatmapData.length > 0) {
      try {
        maxVal = this.timeOfDayWeekHeatmapData.reduce((max, series) => {
          const seriesMax = series.data.reduce((sMax, point) => {
            const normalizedVal = Math.floor(((point.y || 0) % 1000) || 0);
            return Math.max(sMax, normalizedVal);
          }, 0);
          return Math.max(max, seriesMax);
        }, 0);
        
        // Конвертуємо назад до секунд (приблизно)
        maxVal = this.safeRound((maxVal || 0) * 3600 / 999) || 3600; // Default 1 година
      } catch (error) {
        maxVal = 3600; // Default 1 година
      }
    } else {
      maxVal = 3600; // Default 1 година
    }
    
    // Перевіряємо чи потрібно оновити кеш
    const currentTheme = this.isDarkTheme;
    const cacheKey = `timeHeatmap_${currentTheme}_${maxVal}`;
    if (this._chartOptions === null || 
        this._lastThemeState !== currentTheme ||
        this._chartOptions._cacheKey !== cacheKey) {
      this._lastThemeState = currentTheme;
      this._chartOptions = {
        ...this.heatmapService.getTimeOfDayWeekHeatmapOptions(this.isDarkTheme, maxVal),
        _cacheKey: cacheKey
      };
    }
    return this._chartOptions;
  }

  private safeRound(value: number): number {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Math.round(value * 100) / 100;
  }
}
