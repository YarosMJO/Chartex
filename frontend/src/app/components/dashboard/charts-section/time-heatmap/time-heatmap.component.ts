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

  // Кеш для опцій графіка
  private _chartOptions: any = null;
  private _lastThemeState: boolean | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private heatmapService: HeatmapService
  ) { }

  ngOnChanges() {
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
