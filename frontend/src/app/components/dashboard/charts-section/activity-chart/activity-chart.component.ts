import { Component, Input, ChangeDetectionStrategy, OnChanges, ChangeDetectorRef, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-activity-chart',
  templateUrl: './activity-chart.component.html',
  styleUrls: ['./activity-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityChartComponent implements OnChanges, OnDestroy {
  @Input() activityChartData: { x: string; y: number }[] = [];
  @Input() selectedPeriod: string = '';
  @Input() activityChartOptions: any = {};

  private wheelHandler?: (e: Event) => void;
  private touchStartHandler?: (e: Event) => void;
  private touchMoveHandler?: (e: Event) => void;

  constructor(
    private cdr: ChangeDetectorRef,
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

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

  onActivityChartReady(event: any) {
    // Chart ready event handled
  }

  ngOnDestroy() {
    // Cleanup if needed
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
