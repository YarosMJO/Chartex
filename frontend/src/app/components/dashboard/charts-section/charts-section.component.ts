import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';
import { formatDuration, cleanDomainName } from '../../../utils/utils';
import { HeatmapSeries } from '../../../services/heatmap.service';

@Component({
  selector: 'app-charts-section',
  templateUrl: './charts-section.component.html',
  styleUrls: ['./charts-section.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartsSectionComponent implements OnInit, OnChanges {
  @Input() activityChartData: { x: string; y: number }[] = [];
  @Input() topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];
  @Input() selectedPeriod: string = '';
  @Input() activityChartOptions: any = {};
  @Input() activityHeatmapData: HeatmapSeries[] = [];
  @Input() activityHeatmapOptions: any = {};

  ngOnInit() {
    console.log('🔍 CHARTS DEBUG: ChartsSectionComponent initialized');
    console.log('🔍 CHARTS DEBUG: activityHeatmapData length:', this.activityHeatmapData.length);
    console.log('🔍 CHARTS DEBUG: activityHeatmapOptions:', this.activityHeatmapOptions);
    if (this.activityHeatmapData.length > 0) {
      console.log('🔍 CHARTS DEBUG: First heatmap series:', this.activityHeatmapData[0]);
    }
  }

  formatDuration = formatDuration;
  cleanDomainName = cleanDomainName;

  trackByDomain(index: number, domain: any): string {
    return domain.name || domain._id || index.toString();
  }

  // Додаємо метод для відладки


  // Відстежуємо зміни в даних
  ngOnChanges() {
    console.log('🔍 CHARTS DEBUG: ChartsSectionComponent data changed');
    console.log('🔍 CHARTS DEBUG: activityHeatmapData length:', this.activityHeatmapData.length);
    console.log('🔍 CHARTS DEBUG: activityHeatmapOptions:', this.activityHeatmapOptions);
    if (this.activityHeatmapData.length > 0) {
      console.log('🔍 CHARTS DEBUG: Updated heatmap data:', this.activityHeatmapData);
      console.log('🔍 CHARTS DEBUG: First series:', {
        name: this.activityHeatmapData[0].name,
        dataLength: this.activityHeatmapData[0].data.length,
        firstDataPoint: this.activityHeatmapData[0].data[0]
      });
    } else {
      console.log('🔍 CHARTS DEBUG: No heatmap data available');
    }
  }
} 