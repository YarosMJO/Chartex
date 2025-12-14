import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
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
export class ChartsSectionComponent implements OnChanges {
  @Input() activityChartData: { x: string; y: number }[] = [];
  @Input() topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];
  @Input() selectedPeriod: string = '';
  @Input() selectedDevice: string = '';
  @Input() activityHeatmapData: HeatmapSeries[] = [];
  @Input() timeOfDayWeekHeatmapData: HeatmapSeries[] = [];
  @Input() categoryDistributionData: number[] = [];
  @Input() categoryLabels: string[] = [];
  @Input() userStats: any = null;
  @Input() sortedDomains: any[] = [];
  @Input() bubbleChartData: {
    x: number;
    y: number;
    z: number;
    name: string;
    rawTotalMinutes?: number;
    rawVisits?: number;
    rawAvgMinutes?: number;
  }[] = [];
  @Input() bubbleChartScaleMode: 'normal' | 'zoomed' = 'normal';
  @Input() showDurationCharts: boolean = true;
  @Input() isDarkTheme: boolean = false;
  @Input() filteredDomains: any[] = [];
  @Output() bubbleChartScaleToggle = new EventEmitter<void>();

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges() {
    this.cdr.markForCheck();
  }

  onBubbleChartScaleToggle() {
    this.bubbleChartScaleToggle.emit();
  }
} 