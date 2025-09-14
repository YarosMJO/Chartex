import { Component, Input, ChangeDetectionStrategy, OnChanges, ChangeDetectorRef } from '@angular/core';
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
export class ActivityChartComponent implements OnChanges {
  @Input() activityChartData: { x: string; y: number }[] = [];
  @Input() selectedPeriod: string = '';
  @Input() activityChartOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges() {
    if (this.activityChartData.length > 0) {
      // Перевіряємо діапазон значень
      const yValues = this.activityChartData.map(item => item.y);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
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
}
