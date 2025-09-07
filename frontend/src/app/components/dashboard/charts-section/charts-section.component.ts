import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';
import { HeatmapSeries } from '../../../services/heatmap.service';
import { ActivityChartComponent } from './activity-chart/activity-chart.component';
import { ActivityHeatmapComponent } from './activity-heatmap/activity-heatmap.component';
import { TimeHeatmapComponent } from './time-heatmap/time-heatmap.component';
import { PieChartComponent } from './pie-chart/pie-chart.component';
import { BubbleChartComponent } from './bubble-chart/bubble-chart.component';
import { TopSitesComponent } from './top-sites/top-sites.component';

@Component({
  selector: 'app-charts-section',
  templateUrl: './charts-section.component.html',
  styleUrls: ['./charts-section.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    NgApexchartsModule, 
    TranslateModule,
    ActivityChartComponent,
    ActivityHeatmapComponent,
    TimeHeatmapComponent,
    PieChartComponent,
    BubbleChartComponent,
    TopSitesComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartsSectionComponent implements OnInit, OnChanges {
  @Input() activityChartData: { x: string; y: number }[] = [];
  @Input() topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];
  @Input() selectedPeriod: string = '';
  @Input() activityChartOptions: any = {};
  @Input() activityHeatmapData: HeatmapSeries[] = [];
  @Input() activityHeatmapOptions: any = {};
  @Input() timeOfDayWeekHeatmapData: HeatmapSeries[] = [];
  @Input() timeOfDayWeekHeatmapOptions: any = {};
  @Input() categoryDistributionData: number[] = [];
  @Input() pieChartOptions: any = {};
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

  private logDebugInfo(context: string) {
    console.log(`🔍 CHARTS DEBUG: ${context} - ChartsSectionComponent`);
    console.log('🔍 CHARTS DEBUG: activityChartData length:', this.activityChartData.length);
    console.log('🔍 CHARTS DEBUG: timeOfDayWeekHeatmapData length:', this.timeOfDayWeekHeatmapData.length);
    
    if (this.activityChartData.length > 0) {
      console.log('🔍 CHARTS DEBUG: Sample activity values:', this.activityChartData.slice(0, 3));
    }
    
    if (this.timeOfDayWeekHeatmapData.length > 0) {
      console.log('🔍 CHARTS DEBUG: Sample heatmap series:', this.timeOfDayWeekHeatmapData[0].name);
      console.log('🔍 CHARTS DEBUG: Sample heatmap data points:', this.timeOfDayWeekHeatmapData[0].data.slice(0, 3));
      console.log('🔍 CHARTS DEBUG: Total heatmap series count:', this.timeOfDayWeekHeatmapData.length);
    } else {
      console.log('🔍 CHARTS DEBUG: No heatmap data available');
    }
  }


} 