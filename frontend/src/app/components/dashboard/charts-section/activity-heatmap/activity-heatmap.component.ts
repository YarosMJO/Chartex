import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { HeatmapSeries, HeatmapService } from '../../../../services/heatmap.service';

@Component({
  selector: 'app-activity-heatmap',
  templateUrl: './activity-heatmap.component.html',
  styleUrls: ['./activity-heatmap.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityHeatmapComponent implements OnChanges {
  @Input() activityHeatmapData: HeatmapSeries[] = [];
  @Input() isDarkTheme: boolean = false;
  @Input() filteredDomains: any[] = [];
  @Input() userStats: any = null;
  @Input() selectedPeriod: string = '';
  @Input() selectedDevice: string = '';

  // Кеш для опцій графіка
  private _chartOptions: any = null;
  private _lastThemeState: boolean | null = null;
  private _lastChartWidth: number | null = null;

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
    if (!this.userStats?.topDomains) {
      this.activityHeatmapData = [];
      this.cdr.markForCheck();
      return;
    }

    try {
      const heatmapData = await this.heatmapService.prepareActivityHeatmapData(
        this.userStats,
        this.selectedPeriod,
        this.selectedDevice
      );

      this.activityHeatmapData = heatmapData;
    } catch (error) {
      // Fallback to empty data
      this.activityHeatmapData = [];
    }
    
    this.cdr.markForCheck();
  }

  // Метод для підготовки даних з відфільтрованих доменів
  private async prepareDataFromFilteredDomains(filteredDomains: any[]): Promise<void> {
    if (!filteredDomains || filteredDomains.length === 0) {
      this.activityHeatmapData = [];
      this.cdr.markForCheck();
      return;
    }

    if (!this.userStats) {
      this.activityHeatmapData = [];
      this.cdr.markForCheck();
      return;
    }

    try {
      // Створюємо тимчасовий об'єкт userStats з відфільтрованими даними
      const tempUserStats = {
        ...this.userStats,
        topDomains: filteredDomains,
        stats: {
          ...this.userStats.stats,
          totalVisits: filteredDomains.reduce((sum, domain) => sum + (domain.visits || 0), 0),
          totalDuration: filteredDomains.reduce((sum, domain) => sum + (domain.totalDuration || 0), 0),
          uniqueDomains: filteredDomains.length
        }
      };

      const heatmapData = await this.heatmapService.prepareActivityHeatmapData(
        tempUserStats,
        this.selectedPeriod,
        this.selectedDevice
      );

      this.activityHeatmapData = heatmapData;
    } catch (error) {
      // Fallback to empty data
      this.activityHeatmapData = [];
    }
    
    this.cdr.markForCheck();
  }

  get activityHeatmapOptions() {
    // Перевіряємо чи потрібно оновити кеш
    const currentTheme = this.isDarkTheme;
    const currentWidth = this.chartWidth;
    if (this._chartOptions === null || 
        this._lastThemeState !== currentTheme || 
        this._lastChartWidth !== currentWidth) {
      this._lastThemeState = currentTheme;
      this._lastChartWidth = currentWidth;
      this._chartOptions = this.heatmapService.getActivityHeatmapOptions(this.isDarkTheme, this.isChartNarrow());
    }
    return this._chartOptions;
  }

  private get chartWidth(): number {
    return window.innerWidth;
  }

  private isChartNarrow(): boolean {
    return this.chartWidth < 768; // Вважаємо графік вузьким, якщо ширина менше 768px
  }
}
