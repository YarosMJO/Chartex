import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
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
    
    if (this.activityChartData.length > 0) {
      // Перевіряємо діапазон значень
      const yValues = this.activityChartData.map(item => item.y);
      console.log('🔍 ACTIVITY CHART DEBUG: Y values range:', Math.min(...yValues), 'to', Math.max(...yValues));
      console.log('🔍 ACTIVITY CHART DEBUG: Updated chart data:', this.activityChartData.length, 'items');
    }
    
    // Ручне оновлення для OnPush стратегії
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

  formatDuration = formatDuration;
  cleanDomainName = cleanDomainName;

  trackByDomain(index: number, domain: any): string {
    return domain.name || domain._id || index.toString();
  }

  getActivitySeries() {
    const series = [{
      name: 'Відвідування',
      data: this.activityChartData || []
    }];
    if (series[0].data.length > 0) {
      console.log('🔍 ACTIVITY CHART DEBUG: Returning series with', series[0].data.length, 'data points');
    }
    return series;
  }

  getBubbleChartSeries() {
    console.log('🔍 BUBBLE CHART DEBUG: getBubbleChartSeries called');
    console.log('🔍 BUBBLE CHART DEBUG: bubbleChartData length:', this.bubbleChartData?.length || 0);
    console.log('🔍 BUBBLE CHART DEBUG: bubbleChartData sample:', this.bubbleChartData?.slice(0, 2));
    console.log('🔍 BUBBLE CHART DEBUG: bubbleChartData names:', this.bubbleChartData?.map(d => d.name));
    console.log('🔍 BUBBLE CHART DEBUG: formattedBubbleChartData length:', this.formattedBubbleChartData?.length || 0);
    console.log('🔍 BUBBLE CHART DEBUG: formattedBubbleChartData sample:', this.formattedBubbleChartData?.slice(0, 2));
    
    const series = [{
      name: 'Сайти',
      data: this.formattedBubbleChartData || []
    }];
    
    console.log('🔍 BUBBLE CHART DEBUG: Returning series with', series[0].data.length, 'data points');
    if (series[0].data.length > 0) {
      console.log('🔍 BUBBLE CHART DEBUG: Sample data with names:', series[0].data.slice(0, 2).map(d => ({ name: d.name, x: d.x, y: d.y })));
    }
    return series;
  }

  // Метод для форматування даних бульбашкової діаграми для ApexCharts
  get formattedBubbleChartData() {
    console.log('🔍 BUBBLE DEBUG: formattedBubbleChartData called');
    console.log('🔍 BUBBLE DEBUG: bubbleChartData length:', this.bubbleChartData?.length || 0);
    console.log('🔍 BUBBLE DEBUG: bubbleChartData:', this.bubbleChartData);
    console.log('🔍 BUBBLE DEBUG: bubbleChartData names:', this.bubbleChartData?.map(d => d.name));

    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      console.log('🔍 BUBBLE DEBUG: No bubble chart data available');
      return [];
    }

    try {
      // Працюємо з об'єктами, щоб tooltip і dataLabels мали доступ до x/y/z/name
      const formattedData = this.bubbleChartData.map((dataPoint, index) => {
        // Детальне логування для кожної точки даних
        console.log(`🔍 BUBBLE DEBUG: Processing dataPoint ${index}:`, {
          name: dataPoint.name,
          nameType: typeof dataPoint.name,
          nameLength: dataPoint.name?.length,
          x: dataPoint.x,
          y: dataPoint.y,
          z: dataPoint.z
        });
        
        // Валідація кожної точки даних
        if (!dataPoint || typeof dataPoint !== 'object') {
          console.warn('🔍 BUBBLE DEBUG: Invalid data point:', {
            dataPoint: dataPoint,
            dataPointType: typeof dataPoint,
            index: index
          });
          return null;
        }
        
        return {
          x: dataPoint.x || 0,
          y: dataPoint.y || 0,
          z: dataPoint.z || 15,
          name: dataPoint.name || 'Unknown',
          // Додаємо всі кастомні поля для tooltip
          rawTotalMinutes: dataPoint.rawTotalMinutes || 0,
          rawVisits: dataPoint.rawVisits || 0,
          rawAvgMinutes: dataPoint.rawAvgMinutes || 0
        };
      }).filter(point => point !== null);

      console.log('🔍 BUBBLE DEBUG: Using real data, length:', formattedData.length);

      // Діапазони для перевірки/клампінгу повинні відповідати налаштуванням осей
      const maxX = 1000;
      const maxY = 250;

      // Логи діапазонів
      const xValues = formattedData.map(point => point.x);
      const yValues = formattedData.map(point => point.y);
      const zValues = formattedData.map(point => point.z);
      console.log('🔍 BUBBLE DEBUG: X range:', Math.min(...xValues), '-', Math.max(...xValues));
      console.log('🔍 BUBBLE DEBUG: Y range:', Math.min(...yValues), '-', Math.max(...yValues));
      console.log('🔍 BUBBLE DEBUG: Z range:', Math.min(...zValues), '-', Math.max(...zValues));

      const xInRange = xValues.every(xVal => xVal >= 0 && xVal <= maxX);
      const yInRange = yValues.every(yVal => yVal >= 0 && yVal <= maxY);
      const zInRange = zValues.every(zVal => zVal >= 15 && zVal <= 45);
      console.log('🔍 BUBBLE DEBUG: Values in range - X:', xInRange, 'Y:', yInRange, 'Z:', zInRange);

      if (!xInRange || !yInRange || !zInRange) {
        console.warn('🔍 BUBBLE DEBUG: Some values are outside expected ranges! Clamping...');
        const clampedData = formattedData.map(point => ({
          x: Math.min(Math.max(point.x, 0), maxX),
          y: Math.min(Math.max(point.y, 0), maxY),
          z: Math.min(Math.max(point.z, 15), 45),
          name: point.name
        }));
        console.log('🔍 BUBBLE DEBUG: Clamped data to fit within bounds:', clampedData);
        return clampedData;
      }

      console.log('🔍 BUBBLE DEBUG: Returning formatted data:', formattedData);
      console.log('🔍 BUBBLE DEBUG: Final formatted data count:', formattedData.length);
      console.log('🔍 BUBBLE DEBUG: Final formatted data names:', formattedData.map(d => d.name));
      return formattedData;
    } catch (error) {
      console.error('🔍 BUBBLE DEBUG: Error formatting bubble chart data:', error);
      return [];
    }
  }


  onActivityChartReady(chart: any) {
    console.log('🔍 ACTIVITY CHART DEBUG: Chart ready - type:', chart?.w?.config?.chart?.type);
    
    if (chart && chart.w && chart.w.config && chart.w.config.series) {
      const series = chart.w.config.series[0];
      console.log('🔍 ACTIVITY CHART DEBUG: Chart has', series?.data?.length || 0, 'data points');
      console.log('🔍 ACTIVITY CHART DEBUG: Chart colors:', chart.w.config.colors);
      
      // Перевіряємо чи chart відображається
      setTimeout(() => {
        const chartElement = chart.el;
        if (chartElement) {
          const svgElement = chartElement.querySelector('svg');
          console.log('🔍 ACTIVITY CHART DEBUG: SVG element found:', !!svgElement);
          if (svgElement) {
            const paths = svgElement.querySelectorAll('path');
            console.log('🔍 ACTIVITY CHART DEBUG: Number of paths in SVG:', paths.length);
          }
        }
      }, 1000);
    } else {
      console.log('🔍 ACTIVITY CHART DEBUG: Chart config incomplete');
    }
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