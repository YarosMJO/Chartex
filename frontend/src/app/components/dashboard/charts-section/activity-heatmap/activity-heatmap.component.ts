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

  // Кеш для опцій графіка
  private _chartOptions: any = null;
  private _lastThemeState: boolean | null = null;
  private _lastChartWidth: number | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private heatmapService: HeatmapService
  ) { }

  ngOnChanges() {
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
