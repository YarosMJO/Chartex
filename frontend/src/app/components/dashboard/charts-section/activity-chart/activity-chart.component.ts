import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';

@Component({
  selector: 'app-activity-chart',
  templateUrl: './activity-chart.component.html',
  styleUrls: ['./activity-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityChartComponent implements OnChanges {
  @Input() activityChartData: { x: string; y: number }[] = [];
  @Input() selectedPeriod: string = '';
  @Input() activityChartOptions: any = {};

  constructor(
    private cdr: ChangeDetectorRef
  ) { }

  ngOnChanges() {
    if (this.activityChartData && this.activityChartData.length > 0) {
      // Валідуємо та очищаємо дані
      this.activityChartData = this.activityChartData
        .filter(item => item && typeof item === 'object')
        .map(item => ({
          x: this.sanitizeString(item.x),
          y: this.sanitizeNumber(item.y)
        }))
        .filter(item => item.x && item.y >= 0);

      // Перевіряємо діапазон значень
      if (this.activityChartData.length > 0) {
        const yValues = this.activityChartData.map(item => item.y);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);

        // Додаткова валідація для ApexCharts
        if (isNaN(minY) || isNaN(maxY) || !isFinite(minY) || !isFinite(maxY)) {
          console.warn('Invalid data detected in activity chart:', this.activityChartData);
          this.activityChartData = [];
        }
      }
    } else {
      this.activityChartData = [];
    }

    this.cdr.markForCheck();
  }

  getActivitySeries() {
    return [{
      name: 'Активність',
      data: this.activityChartData
    }];
  }

  private sanitizeString(value: any): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return '';
  }

  private sanitizeNumber(value: any): number {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return Math.max(0, value);
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }
    return 0;
  }
}
