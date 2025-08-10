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
  @Input() timeOfDayWeekHeatmapData: HeatmapSeries[] = [];
  @Input() timeOfDayWeekHeatmapOptions: any = {};
  @Input() categoryDistributionData: number[] = [];
  @Input() pieChartOptions: any = {};
  @Input() bubbleChartData: { x: number; y: number; z: number; name: string }[] = [];
  @Input() bubbleChartOptions: any = {};

  ngOnInit() {
    console.log('🔍 CHARTS DEBUG: ChartsSectionComponent initialized');
    console.log('🔍 CHARTS DEBUG: activityHeatmapData length:', this.activityHeatmapData.length);
    console.log('🔍 CHARTS DEBUG: activityHeatmapOptions:', this.activityHeatmapOptions);
    console.log('🔍 CHARTS DEBUG: bubbleChartData in ngOnInit:', this.bubbleChartData);
    console.log('🔍 CHARTS DEBUG: bubbleChartOptions in ngOnInit:', this.bubbleChartOptions);
    if (this.activityHeatmapData.length > 0) {
      console.log('🔍 CHARTS DEBUG: First heatmap series:', this.activityHeatmapData[0]);
    }
  }

  formatDuration = formatDuration;
  cleanDomainName = cleanDomainName;

  trackByDomain(index: number, domain: any): string {
    return domain.name || domain._id || index.toString();
  }

  // Метод для форматування даних бульбашкової діаграми для ApexCharts
  get formattedBubbleChartData() {
    console.log('🔍 BUBBLE DEBUG: formattedBubbleChartData called');
    console.log('🔍 BUBBLE DEBUG: bubbleChartData:', this.bubbleChartData);

    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      return [];
    }

    // Працюємо з об'єктами, щоб tooltip і dataLabels мали доступ до x/y/z/name
    const formattedData = this.bubbleChartData.map(item => ({
      x: item.x,
      y: item.y,
      z: item.z,
      name: item.name
    }));

    console.log('🔍 BUBBLE DEBUG: Using real data, length:', formattedData.length);

    // Діапазони для перевірки/клампінгу повинні відповідати налаштуванням осей
    const maxX = 1000;
    const maxY = 250;

    // Логи діапазонів
    const xValues = formattedData.map(p => p.x);
    const yValues = formattedData.map(p => p.y);
    const zValues = formattedData.map(p => p.z);
    console.log('🔍 BUBBLE DEBUG: X range:', Math.min(...xValues), '-', Math.max(...xValues));
    console.log('🔍 BUBBLE DEBUG: Y range:', Math.min(...yValues), '-', Math.max(...yValues));
    console.log('🔍 BUBBLE DEBUG: Z range:', Math.min(...zValues), '-', Math.max(...zValues));

    const xInRange = xValues.every(x => x >= 0 && x <= maxX);
    const yInRange = yValues.every(y => y >= 0 && y <= maxY);
    const zInRange = zValues.every(z => z >= 15 && z <= 45);
    console.log('🔍 BUBBLE DEBUG: Values in range - X:', xInRange, 'Y:', yInRange, 'Z:', zInRange);

    if (!xInRange || !yInRange || !zInRange) {
      console.warn('🔍 BUBBLE DEBUG: Some values are outside expected ranges! Clamping...');
      const clampedData = formattedData.map(p => ({
        x: Math.min(Math.max(p.x, 0), maxX),
        y: Math.min(Math.max(p.y, 0), maxY),
        z: Math.min(Math.max(p.z, 15), 45),
        name: p.name
      }));
      console.log('🔍 BUBBLE DEBUG: Clamped data to fit within bounds:', clampedData);
      return clampedData;
    }

    console.log('🔍 BUBBLE DEBUG: Returning formatted data:', formattedData);
    return formattedData;
  }

  // Відстежуємо зміни в даних
  ngOnChanges() {
    console.log('🔍 BUBBLE DEBUG: ngOnChanges called');
    console.log('🔍 BUBBLE DEBUG: bubbleChartData in ngOnChanges:', this.bubbleChartData);
    console.log('🔍 BUBBLE DEBUG: bubbleChartOptions in ngOnChanges:', this.bubbleChartOptions);
    
    // Log the formatted data
    const formattedData = this.formattedBubbleChartData;
    console.log('🔍 BUBBLE DEBUG: formattedBubbleChartData in ngOnChanges:', formattedData);
    
    // Chart data has been updated
  }

  onChartReady(chart: any) {
    console.log('🔍 BUBBLE DEBUG: Chart ready event fired');
    console.log('🔍 BUBBLE DEBUG: Chart instance:', chart);
    console.log('🔍 BUBBLE DEBUG: Current bubbleChartData in onChartReady:', this.bubbleChartData);
    console.log('🔍 BUBBLE DEBUG: Current formattedBubbleChartData in onChartReady:', this.formattedBubbleChartData);
    
    if (chart && chart.w && chart.w.config && chart.w.config.series) {
      console.log('🔍 BUBBLE DEBUG: Chart series:', chart.w.config.series);
      console.log('🔍 BUBBLE DEBUG: Chart data:', chart.w.config.series[0]?.data);
      console.log('🔍 BUBBLE DEBUG: Chart options:', chart.w.config);
    } else {
      console.log('🔍 BUBBLE DEBUG: Chart config or series is undefined', chart);
    }
  }
} 