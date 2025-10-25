import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, ElementRef, Renderer2 } from '@angular/core';
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
  @Input() isDarkTheme: boolean = false;

  // Кеш для опцій графіка
  private _chartOptions: any = null;
  private _lastThemeState: boolean | null = null;

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


  get activityChartOptions() {
    // Перевіряємо чи потрібно оновити кеш
    if (this._chartOptions === null || this._lastThemeState !== this.isDarkTheme) {
      this._lastThemeState = this.isDarkTheme;
      this._chartOptions = this.buildActivityChartOptions();
    }
    return this._chartOptions;
  }

  getActivitySeries() {
    return [{
      name: 'Активність',
      data: this.activityChartData
    }];
  }


  private buildActivityChartOptions() {
    const baseOptions = {
      chart: { 
        type: 'area', 
        height: 300,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        zoom: {
          enabled: true,
          type: 'x',
          autoScaleYaxis: true
        },
        pan: {
          enabled: true,
          type: 'x'
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800
        },
      },
      xaxis: { 
        type: 'category',
        axisBorder: {
          show: true
        },
        axisTicks: {
          show: true
        },
        labels: {
          style: {
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          style: {
            fontSize: '12px'
          }
        }
      },
      colors: ['#667eea'],
      fill: { 
        type: 'gradient', 
        gradient: { 
          shadeIntensity: 1, 
          opacityFrom: 0.7, 
          opacityTo: 0.9, 
          stops: [0, 90, 100] 
        } 
      },
      stroke: { 
        curve: 'smooth',
        width: 3,
        colors: ['#667eea']
      },
      dataLabels: { enabled: false },
      grid: { 
        borderColor: '#e7e7e7', 
        row: { colors: ['#f3f3f3', 'transparent'], opacity: 0.5 } 
      },
      tooltip: { 
        theme: 'light',
        enabled: true,
        shared: false,
        intersect: false,
        y: {
          formatter: function(val: any) {
            return val + ' відвідувань';
          }
        }
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'left'
      },
      markers: {
        size: 5,
        colors: ['#667eea'],
        strokeColors: '#fff',
        strokeWidth: 2,
        hover: {
          size: 7
        }
      }
    };

    if (this.isDarkTheme) {
      return {
        ...baseOptions,
        chart: { 
          ...baseOptions.chart,
          foreColor: '#f3eaff', 
          background: '#232136' 
        },
        xaxis: { 
          ...baseOptions.xaxis,
          labels: { style: { colors: '#f3eaff' } } 
        },
        yaxis: { 
          ...baseOptions.yaxis,
          labels: { style: { colors: '#f3eaff' } } 
        },
        colors: ['#a259f7'],
        fill: { 
          type: 'gradient', 
          gradient: { 
            shadeIntensity: 1, 
            opacityFrom: 0.5, 
            opacityTo: 0.8, 
            stops: [0, 90, 100], 
            colorStops: [] 
          } 
        },
        stroke: { 
          curve: 'smooth', 
          colors: ['#a259f7'],
          width: 2
        },
        grid: { 
          borderColor: '#3a2e5c', 
          row: { colors: ['#2a2042', 'transparent'], opacity: 0.3 } 
        },
        tooltip: { 
          theme: 'dark', 
          style: { fontSize: '14px', color: '#fff' }, 
          y: { formatter: (val: any) => val + ' відвідувань' } 
        }
      };
    }

    return baseOptions;
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
