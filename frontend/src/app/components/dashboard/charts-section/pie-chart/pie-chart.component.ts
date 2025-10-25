import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { formatDuration, categorizeWebsite, getDomainFromUrl } from '../../../../utils/utils';

@Component({
  selector: 'app-pie-chart',
  templateUrl: './pie-chart.component.html',
  styleUrls: ['./pie-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PieChartComponent implements OnChanges {
  @Input() categoryDistributionData: number[] = [];
  @Input() isDarkTheme: boolean = false;
  @Input() filteredDomains: any[] = [];
  @Input() userStats: any = null;

  // Кеш для опцій графіка
  private _chartOptions: any = null;
  private _lastThemeState: boolean | null = null;

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges() {
    // Якщо є відфільтровані домени, підготовлюємо дані з них
    if (this.filteredDomains && this.filteredDomains.length > 0) {
      this.prepareDataFromFilteredDomains(this.filteredDomains);
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
        this.categoryDistributionData = [];
        this.cdr.markForCheck();
        return;
      }

      const categoryStats = new Map<string, number>();

      this.userStats.topDomains.forEach((domain: any) => {
        if (domain.decryptedData) {
          const domainName = getDomainFromUrl(domain.decryptedData.url);
          const category = categorizeWebsite(domainName);
          const duration = domain.totalDuration || 0;

          categoryStats.set(category, (categoryStats.get(category) || 0) + duration);
        }
      });

      // Сортуємо категорії за часом та беремо топ-6
      const sortedCategories = Array.from(categoryStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      this.categoryDistributionData = sortedCategories.map(([category, duration]) => duration);

    } catch (error) {
      this.categoryDistributionData = [];
    }
    
    this.cdr.markForCheck();
  }

  // Метод для підготовки даних з відфільтрованих доменів
  private prepareDataFromFilteredDomains(filteredDomains: any[]): void {
    try {
      if (!filteredDomains || filteredDomains.length === 0) {
        this.categoryDistributionData = [];
        this.cdr.markForCheck();
        return;
      }

      const categoryStats = new Map<string, number>();

      filteredDomains.forEach(domain => {
        if (domain.decryptedData) {
          const domainName = getDomainFromUrl(domain.decryptedData.url);
          const category = categorizeWebsite(domainName);
          const duration = domain.totalDuration || 0;

          categoryStats.set(category, (categoryStats.get(category) || 0) + duration);
        }
      });

      // Сортуємо категорії за часом та беремо топ-6
      const sortedCategories = Array.from(categoryStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      this.categoryDistributionData = sortedCategories.map(([category, duration]) => duration);

    } catch (error) {
      this.categoryDistributionData = [];
    }
    
    this.cdr.markForCheck();
  }


  get pieChartOptions() {
    // Визначаємо, чи потрібно показувати легенду на основі розміру екрану
    const shouldShowLegend = window.innerWidth > 1200;
    
    // Перевіряємо чи потрібно оновити кеш
    const currentTheme = this.isDarkTheme;
    const cacheKey = `pieChart_${currentTheme}_${shouldShowLegend}`;
    if (this._chartOptions === null || 
        this._lastThemeState !== currentTheme ||
        this._chartOptions._cacheKey !== cacheKey) {
      this._lastThemeState = currentTheme;
      this._chartOptions = {
        ...this.buildPieChartOptions(shouldShowLegend),
        _cacheKey: cacheKey
      };
    }
    return this._chartOptions;
  }

  private buildPieChartOptions(shouldShowLegend: boolean) {
    return {
      chart: {
        type: 'pie',
        height: 380,
        foreColor: this.isDarkTheme ? '#f3eaff' : '#23272f',
        background: this.isDarkTheme ? '#232136' : '#fff'
      },
      labels: ['Соц. мережі', 'Робота', 'Розваги', 'Новини', 'Покупки', 'Інше'],
      colors: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'],
      dataLabels: {
        enabled: true,
        formatter: (val: number, opts: any) => {
          return opts.w.globals.seriesTotals[opts.seriesIndex] > 0
            ? this.safeRound(val || 0) + '%'
            : '';
        },
        style: {
          colors: this.isDarkTheme ? ['#f3eaff'] : ['#23272f']
        }
      },
      plotOptions: {
        pie: {
          offsetY: 0,
          dataLabels: {
            offset: 0
          }
        }
      },
      tooltip: {
        theme: this.isDarkTheme ? 'dark' : 'light',
        y: {
          formatter: function (value: number) {
            return formatDuration(value);
          }
        }
      },
      legend: {
        show: shouldShowLegend,
        position: 'bottom',
        horizontalAlign: 'center',
        floating: false,
        fontSize: '14px',
        fontFamily: 'inherit',
        width: '100%',
        itemMargin: {
          horizontal: 8,
          vertical: 6
        },
        onItemClick: {
          toggleDataSeries: true
        },
        formatter: (seriesName: string, opts: any) => seriesName,
        markers: {
          width: 10,
          height: 10,
          radius: 5
        },
        labels: {
          colors: undefined
        }
      },
      stroke: {
        width: 2,
        colors: ['#ffffff']
      },
    };
  }

  private safeRound(value: number): number {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Math.round(value * 100) / 100;
  }
}
