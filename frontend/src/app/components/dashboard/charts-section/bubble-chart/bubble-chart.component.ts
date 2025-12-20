import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatDuration, cleanDomainName } from '../../../../utils/utils';

@Component({
  selector: 'app-bubble-chart',
  templateUrl: './bubble-chart.component.html',
  styleUrls: ['./bubble-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BubbleChartComponent implements OnChanges {
  @Input() bubbleChartData: {
    x: number;
    y: number;
    z: number;
    name: string;
    rawTotalMinutes?: number;
    rawVisits?: number;
    rawAvgMinutes?: number;
  }[] = [];
  @Input() scaleMode: 'normal' | 'zoomed' = 'normal';
  @Input() isDarkTheme: boolean = false;
  @Input() filteredDomains: any[] = [];
  @Input() userStats: any = null;
  @Input() sortedDomains: any[] = [];
  @Output() scaleToggle = new EventEmitter<void>();

  // Кеш для опцій графіка
  private _chartOptions: any = null;
  private _lastThemeState: boolean | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private translateService: TranslateService
  ) { }

  ngOnChanges() {
    // Якщо є відсортовані домени, підготовлюємо дані з них
    if (this.sortedDomains && this.sortedDomains.length > 0) {
      this.prepareDataFromSortedDomains(this.sortedDomains);
    } else if (this.userStats && this.userStats.topDomains) {
      // Підготовлюємо дані з userStats
      this.prepareDataFromUserStats();
    }
    this.cdr.markForCheck();
  }

  // Метод для підготовки даних з userStats
  private prepareDataFromUserStats(): void {
    try {
      if (!this.userStats || !this.userStats.topDomains || this.userStats.topDomains.length === 0) {
        this.bubbleChartData = [];
        this.cdr.markForCheck();
        return;
      }

      // Вилучаємо google.com
      const filteredTopDomains = this.userStats.topDomains.filter((d: any) => {
        const domain = cleanDomainName(d.decryptedData?.url || d._id);
        return domain !== 'google.com';
      });

      // Використовуємо ту ж саму логіку, що й для верхнього графіка (без групування)
      const domainsToProcess = filteredTopDomains
        .slice(0, 10)
        .map((domain: any) => ({
          visits: domain.visits || 0,
          totalDuration: domain.totalDuration || 0,
          cleanName: cleanDomainName(domain.decryptedData?.url || domain._id),
          originalId: domain._id || '',
          originalUrl: domain.decryptedData?.url || '',
          originalDomain: domain
        }));

      // Використовуємо всі домени, навіть без даних (як у верхньому графіку)
      const finalDomainsToProcess = domainsToProcess;

      // Calculate ranges for better scaling
      const maxVisits = Math.max(...domainsToProcess.map((d: any) => d.visits || 0));

      this.bubbleChartData = finalDomainsToProcess.map((domain: any, index: number) => {
        const visits = domain.visits || 0;
        const duration = domain.totalDuration || 0;

        // Convert to minutes for better scaling
        const totalDurationMinutes = this.safeRound((duration || 0) / 60);

        // Ensure minimum values for visibility
        const totalTimeMinutes = Math.max(totalDurationMinutes || 1, 1);
        const visitsCount = Math.max(visits || 1, 1);

        // Додаємо невеликий offset для уникнення накладання бульбашок з однаковими даними
        const offsetX = index * 0.1; // Невеликий offset по X
        const offsetY = index * 0.05; // Невеликий offset по Y

        // X-координата: реальна кількість відвідувань + offset
        const finalX = (visitsCount || 1) + (offsetX || 0);

        // Y-координата: загальний час в хвилинах + offset
        const finalY = Math.max(totalTimeMinutes || 0.1, 0.1) + (offsetY || 0); // Мінімум 0.1 хв + offset

        // Z (розмір бульбашки) базується на відвідуваннях для різноманітності
        const normalizedZ = (maxVisits || 0) > 0 ? ((visitsCount || 0) / (maxVisits || 1)) : 0;
        const finalZ = Math.max(this.safeRound((normalizedZ || 0) * 30) + 15, 15); // Range: 15-45

        // Обмежуємо розмір бульбашки
        const clampedZ = Math.min(Math.max(finalZ || 15, 15), 45);

        // Використовуємо реальні значення
        const scaledX = finalX || 1; // X = реальна кількість відвідувань
        const scaledY = finalY || 0.1; // Y = реальні хвилини середнього часу

        // Використовуємо збережені оригінальні дані з групування
        const originalUrl = domain.originalUrl;
        const originalId = domain.originalId;
        const inputForCleanName = originalUrl || originalId;
        const cleanNameResult = cleanDomainName(inputForCleanName);
        const siteName = (cleanNameResult && typeof cleanNameResult === 'string') ? cleanNameResult : 'Unknown';

        if (!siteName || siteName === 'Unknown') {
          // Site name not available, using fallback
        }

        const result = {
          x: scaledX,
          y: scaledY,
          z: clampedZ,
          name: siteName,
          rawTotalMinutes: totalDurationMinutes || 0,
          rawVisits: visits || 0,
          rawAvgMinutes: (visitsCount || 0) > 0 ? this.safeRound((totalTimeMinutes || 0) / (visitsCount || 1) * 100) / 100 : 0
        };

        return result;
      });

    } catch (error) {
      this.bubbleChartData = [];
    }
    
    this.cdr.markForCheck();
  }

  // Метод для підготовки даних з відсортованих доменів
  private prepareDataFromSortedDomains(sortedDomains: any[]): void {
    try {
      if (!sortedDomains || sortedDomains.length === 0) {
        this.bubbleChartData = [];
        this.cdr.markForCheck();
        return;
      }

      // Використовуємо ту ж саму логіку, що й для верхнього графіка (без групування)
      const domainsToProcess = sortedDomains
        .slice(0, 10)
        .map((domain: any) => ({
          visits: domain.totalVisits || 0,
          totalDuration: domain.totalDuration || 0,
          cleanName: domain.cleanName,
          originalId: domain.originalNames?.[0] || '',
          originalUrl: domain.originalNames?.[0] || '',
          originalDomain: domain
        }));

      // Check if we have any domains with meaningful data
      const domainsWithData = domainsToProcess.filter((d: any) => (d.visits || 0) > 0 || (d.totalDuration || 0) > 0);

      // Використовуємо всі домени, навіть без даних (як у верхньому графіку)
      const finalDomainsToProcess = domainsToProcess;

      // Calculate ranges for better scaling
      const maxVisits = Math.max(...finalDomainsToProcess.map((d: any) => d.visits || 0));
      const maxDuration = Math.max(...finalDomainsToProcess.map((d: any) => d.totalDuration || 0));

      this.bubbleChartData = finalDomainsToProcess.map((domain: any, index: number) => {
        const visits = domain.visits || 0;
        const duration = domain.totalDuration || 0;

        // Convert to minutes for better scaling
        const totalDurationMinutes = this.safeRound((duration || 0) / 60);

        // Ensure minimum values for visibility
        const totalTimeMinutes = Math.max(totalDurationMinutes || 1, 1);
        const visitsCount = Math.max(visits || 1, 1);

        // Додаємо невеликий offset для уникнення накладання бульбашок з однаковими даними
        const offsetX = index * 0.1; // Невеликий offset по X
        const offsetY = index * 0.05; // Невеликий offset по Y

        // X-координата: реальна кількість відвідувань + offset
        const finalX = (visitsCount || 1) + (offsetX || 0);

        // Y-координата: загальний час в хвилинах + offset
        const finalY = Math.max(totalTimeMinutes || 0.1, 0.1) + (offsetY || 0); // Мінімум 0.1 хв + offset

        // Z (розмір бульбашки) базується на відвідуваннях для різноманітності
        const normalizedZ = (maxVisits || 0) > 0 ? ((visitsCount || 0) / (maxVisits || 1)) : 0;
        const finalZ = Math.max(this.safeRound((normalizedZ || 0) * 30) + 15, 15); // Range: 15-45

        // Обмежуємо розмір бульбашки
        const clampedZ = Math.min(Math.max(finalZ || 15, 15), 45);

        // Використовуємо реальні значення
        const scaledX = finalX || 1; // X = реальна кількість відвідувань
        const scaledY = finalY || 0.1; // Y = реальні хвилини загального часу

        // Використовуємо збережені оригінальні дані з групування
        const originalUrl = domain.originalUrl;
        const originalId = domain.originalId;
        const inputForCleanName = originalUrl || originalId;
        const cleanNameResult = cleanDomainName(inputForCleanName);
        const siteName = (cleanNameResult && typeof cleanNameResult === 'string') ? cleanNameResult : domain.cleanName || 'Unknown';

        const result = {
          x: scaledX,
          y: scaledY,
          z: clampedZ,
          name: siteName,
          rawTotalMinutes: totalDurationMinutes || 0,
          rawVisits: visits || 0,
          rawAvgMinutes: (visitsCount || 0) > 0 ? this.safeRound((totalTimeMinutes || 0) / (visitsCount || 1) * 100) / 100 : 0
        };

        return result;
      });

    } catch (error) {
      this.bubbleChartData = [];
    }
    
    this.cdr.markForCheck();
  }


  get bubbleChartOptions() {
    // Перевіряємо чи потрібно оновити кеш
    const currentTheme = this.isDarkTheme;
    const currentScaleMode = this.scaleMode;
    const xAxisMax = this.getXAxisMax();
    const yAxisMax = this.getYAxisMax();
    const cacheKey = `bubbleChart_${currentTheme}_${currentScaleMode}_${xAxisMax}_${yAxisMax}`;
    
    if (this._chartOptions === null || 
        this._lastThemeState !== currentTheme ||
        this._chartOptions._cacheKey !== cacheKey) {
      this._lastThemeState = currentTheme;
      this._chartOptions = {
        ...this.buildBubbleChartOptions(),
        _cacheKey: cacheKey
      };
    }
    return this._chartOptions;
  }

  getBubbleChartSeries() {
    return [{
      name: 'Сайти',
      data: this.bubbleChartData
    }];
  }


  toggleScale() {
    this.scaleToggle.emit();
  }

  getScaleButtonIcon(): string {
    return this.scaleMode === 'normal' ? 'zoom_in' : 'zoom_out';
  }

  getScaleButtonTitle(): string {
    return this.scaleMode === 'normal' ? 'Збільшити масштаб' : 'Зменшити масштаб';
  }

  private getXAxisMax(): number {
    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      const defaultMax = this.scaleMode === 'zoomed' ? 50 : 100;
      return defaultMax; // Значення за замовчуванням
    }
    
    const maxVisits = Math.max(...this.bubbleChartData.map(d => d.x));
    
    if (this.scaleMode === 'zoomed') {
      // Для збільшеного масштабу обмежуємо максимальне значення
      const result = Math.min(maxVisits * 1.5, 200);
      return result;
    } else {
      // Додаємо 20% відступу для кращого відображення
      const result = Math.max(maxVisits * 1.2, 50);
      return result;
    }
  }

  private getYAxisMax(): number {
    if (!this.bubbleChartData || this.bubbleChartData.length === 0) {
      const defaultMax = this.scaleMode === 'zoomed' ? 30 : 60;
      return defaultMax; // Значення за замовчуванням у хвилинах
    }
    
    // Використовуємо rawTotalMinutes для загального часу
    const maxTotalTime = Math.max(...this.bubbleChartData.map(d => d.rawTotalMinutes || 0));
    
    if (this.scaleMode === 'zoomed') {
      // Для збільшеного масштабу обмежуємо максимальне значення
      const result = Math.min(maxTotalTime * 1.5, 120);
      return result;
    } else {
      // Додаємо 20% відступу для кращого відображення, мінімум 60 хвилин
      const result = Math.max(maxTotalTime * 1.2, 60);
      return result;
    }
  }

  private buildBubbleChartOptions() {
    const options = {
      chart: {
        type: 'bubble',
        height: 450, // Increased from 400 to 450
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        },
        // Ensure proper chart boundaries
        redrawOnWindowResize: true,
        redrawOnParentResize: true,
        // Toolbar and interactions
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
          type: 'xy',
          autoScaleYaxis: true
        },
        pan: {
          enabled: true,
          type: 'xy'
        }
      },
      title: {
        text: this.translateService.instant('DASHBOARD.CHARTS.BUBBLE_CHART')
      },
      xaxis: {
        title: {
          text: this.translateService.instant('DASHBOARD.CHARTS.VISITS') // Виправлено підпис X-осі
        },
        min: 0,
        max: this.getXAxisMax(), // Динамічне максимальне значення на основі даних
        tickAmount: 6,
        labels: {
          style: {
            fontSize: '12px'
          },
          offsetX: 2,
          formatter: (val: number) => `${this.safeRound(val || 0)}`
        },
        decimalsInFloat: 0,
        tooltip: {
          enabled: false
        },
        axisBorder: {
          show: true,
          color: '#78909c',
          offsetX: 0
        },
        axisTicks: {
          show: true,
          color: '#78909c',
          offsetX: 0
        },
        // Ensure proper spacing for bubbles
        crosshairs: {
          show: false
        },
        position: 'bottom'
      },
      yaxis: {
        title: {
          text: this.translateService.instant('DASHBOARD.CHARTS.TOTAL_TIME') + ' (' + this.translateService.instant('UTILS.MINUTES') + ')'
        },
        min: 0,
        max: this.getYAxisMax(), // Динамічне максимальне значення для загального часу
        tickAmount: 6,
        labels: {
          style: {
            fontSize: '12px'
          },
          offsetX: -4,
          formatter: (val: number): string => {
            // Для загального часу показуємо години та хвилини
            if ((val || 0) >= 60) {
              const h = Math.floor((val || 0) / 60);
              const m: number = this.safeRound((val || 0) % 60);
              return `${h}${this.translateService.instant('UTILS.HOURS')} ${m}${this.translateService.instant('UTILS.MINUTES')}`;
            }
            return `${this.safeRound(val || 0)}${this.translateService.instant('UTILS.MINUTES')}`;
          }
        },
        axisBorder: {
          show: true,
          color: '#78909c'
        },
        axisTicks: {
          show: true,
          color: '#78909c'
        },
        opposite: false,
        // Ensure proper spacing for bubbles
        crosshairs: {
          show: false
        }
      },
      dataLabels: {
        enabled: false, // Вимикаємо підписи на бульбашках
        formatter: (val: any, opts: any): string => {
          try {
            const point = opts?.w?.config?.series?.[opts.seriesIndex]?.data?.[opts.dataPointIndex];

            // Y-ось показує середній час, тому використовуємо rawAvgMinutes
            const avgMinutes = point?.rawAvgMinutes ?? 0;

            if (avgMinutes === 0 || !Number.isFinite(avgMinutes)) return '';
            if ((avgMinutes || 0) >= 60) {
              const h = Math.floor((avgMinutes || 0) / 60);
              const m: number = this.safeRound((avgMinutes || 0) % 60);
              return `${h}${this.translateService.instant('UTILS.HOURS')} ${m}${this.translateService.instant('UTILS.MINUTES')}`;
            }
            return `${this.safeRound(avgMinutes || 0)}${this.translateService.instant('UTILS.MINUTES')}`;
          } catch (error) {
            return '';
          }
        },
        style: {
          fontSize: '12px',
          fontWeight: 'bold',
          colors: ['#ffffff']
        },
        background: {
          enabled: true,
          foreColor: '#000000',
          borderRadius: 4,
          padding: 4,
          opacity: 0.9,
          borderWidth: 1,
          borderColor: '#ffffff'
        },
        offsetY: 0,
        textAnchor: 'middle'
      },
      plotOptions: {
        bubble: {
          minBubbleRadius: 15,
          maxBubbleRadius: 45,
          zScaling: true
        }
      },
      grid: {
        padding: {
          top: 10,
          right: 8,
          bottom: 6,
          left: 9
        },
        show: true,
        borderColor: '#e0e0e0',
        strokeDashArray: 5,
        position: 'back'
      },
      tooltip: {
        enabled: true,
        shared: false,
        intersect: true,
        followCursor: false,
        custom: ({ seriesIndex, dataPointIndex, w }: any) => {
          const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
          const siteName = data?.name || '';
          
          // Отримуємо всі дані для повного tooltip
          const totalMinutes = Number(data?.rawTotalMinutes) || 0;
          const avgMinutes = Number(data?.rawAvgMinutes) || 0;
          const visits = Number(data?.rawVisits) || 0;
          
          return `
            <div class="bubble-tooltip">
              <div class="title">${siteName}</div>
              <div class="row"><span class="label">Візитів: </span><span class="value">${visits}</span></div>
              <div class="row"><span class="label">Загальний час: </span><span class="value">${formatDuration((totalMinutes || 0) * 60, this.translateService)}</span></div>
              <div class="row"><span class="label">Середній час: </span><span class="value">${formatDuration(this.safeRound((avgMinutes || 0) * 60), this.translateService)}</span></div>
            </div>
          `;
        }
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'center',
        fontSize: '14px',
        fontFamily: 'inherit',
        markers: {
          width: 12,
          height: 12,
          radius: 6
        },
        onItemClick: {
          toggleDataSeries: false
        },
        formatter: () => 'Загальний час'
      },
      colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      stroke: {
        width: 2,
        colors: ['#ffffff']
      },
      annotations: {
        lines: [{
          x: 0,
          y: 0,
          x2: this.getXAxisMax(),
          y2: this.getYAxisMax(),
          strokeColor: '#ff0000',
          strokeWidth: 2,
          strokeDashArray: 0,
          opacity: 0.8,
          label: {
            text: 'Діагональна лінія',
            textAnchor: 'middle',
            offsetX: 0,
            offsetY: -10,
            style: {
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#ff0000',
              fontSize: '12px',
              fontWeight: 'bold'
            }
          }
        }]
      }
    };

    return options;
  }

  private safeRound(value: number): number {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Math.round(value * 100) / 100;
  }
}
