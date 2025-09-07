import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-bubble-chart',
  templateUrl: './bubble-chart.component.html',
  styleUrls: ['./bubble-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BubbleChartComponent implements OnInit, OnChanges {
  @Input() bubbleChartData: { 
    x: number; 
    y: number; 
    z: number; 
    name: string;
    rawTotalMinutes?: number;
    rawVisits?: number;
    rawAvgMinutes?: number;
  }[] = [];
  @Input() bubbleChartOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.logDebugInfo('ngOnInit');
  }

  ngOnChanges() {
    this.logDebugInfo('ngOnChanges');
    this.cdr.markForCheck();
  }

  getBubbleChartSeries() {
    console.log('🔍 BUBBLE CHART DEBUG: getBubbleChartSeries called with data:', this.bubbleChartData);
    return [{
      name: 'Сайти',
      data: this.bubbleChartData
    }];
  }

  onChartReady(event: any) {
    console.log('🔍 BUBBLE CHART DEBUG: Chart ready event:', event);
  }

  private logDebugInfo(method: string) {
    console.log(`🔍 BUBBLE CHART DEBUG: ${method} called`, {
      dataLength: this.bubbleChartData.length,
      hasOptions: !!this.bubbleChartOptions
    });
  }
}
