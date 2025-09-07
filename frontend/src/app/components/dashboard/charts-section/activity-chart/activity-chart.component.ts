import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
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
export class ActivityChartComponent implements OnInit, OnChanges {
  @Input() activityChartData: { x: string; y: number }[] = [];
  @Input() selectedPeriod: string = '';
  @Input() activityChartOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.logDebugInfo('ngOnInit');
  }

  ngOnChanges() {
    this.logDebugInfo('ngOnChanges');
    
    if (this.activityChartData.length > 0) {
      // Перевіряємо діапазон значень
      const yValues = this.activityChartData.map(item => item.y);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
      console.log('🔍 ACTIVITY CHART DEBUG: Y values range:', { minY, maxY, dataLength: this.activityChartData.length });
    }
    
    this.cdr.markForCheck();
  }

  getActivitySeries() {
    console.log('🔍 ACTIVITY CHART DEBUG: getActivitySeries called with data:', this.activityChartData);
    return [{
      name: 'Активність',
      data: this.activityChartData
    }];
  }

  onActivityChartReady(event: any) {
    console.log('🔍 ACTIVITY CHART DEBUG: Chart ready event:', event);
  }

  private logDebugInfo(method: string) {
    console.log(`🔍 ACTIVITY CHART DEBUG: ${method} called`, {
      dataLength: this.activityChartData.length,
      selectedPeriod: this.selectedPeriod,
      hasOptions: !!this.activityChartOptions
    });
  }
}
