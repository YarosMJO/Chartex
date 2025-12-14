import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { categorizeWebsite, formatDuration, getDomainFromUrl } from '../../../../utils/utils';

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
  @Input() categoryLabels: string[] = [];
  @Input() isDarkTheme: boolean = false;
  @Input() filteredDomains: any[] = [];
  @Input() userStats: any = null;

  // Кеш для опцій графіка
  private _chartOptions: any = null;

  constructor(private cdr: ChangeDetectorRef, private translateService: TranslateService) { }

  ngOnChanges() {
    // Use categoryLabels directly from input (passed from dashboard)
    // Only fall back to extraction if labels not provided
    if (!this.categoryLabels || this.categoryLabels.length === 0) {
      if (this.filteredDomains && this.filteredDomains.length > 0) {
        this.extractCategoryLabels(this.filteredDomains);
      } else if (this.userStats?.topDomains) {
        this.extractCategoryLabels(this.userStats.topDomains);
      }
    }

    this._chartOptions = null;
    this.cdr.markForCheck();
  }

  // Extract category labels from filtered domains in same order as categoryDistributionData
  private extractCategoryLabels(domains: any[]): void {
    try {
      if (!domains || domains.length === 0) {
        this.categoryLabels = [];
        return;
      }

      // Build category map from domains (same logic as dashboard's aggregateByCategory)
      const categoryStats = new Map<string, number>();
      domains.forEach(domain => {
        const url = domain.decryptedData?.url || domain._id;
        const category = categorizeWebsite(getDomainFromUrl(url));
        if (category !== 'search_engine') {
          categoryStats.set(category, (categoryStats.get(category) || 0) + (domain.totalDuration || 0));
        }
      });

      // Sort by duration (descending) - MUST match dashboard's aggregateByCategory logic exactly
      const sortedCategories = Array.from(categoryStats.entries()).sort((a, b) => b[1] - a[1]);
      this.categoryLabels = sortedCategories.map(([cat]) => cat);
    } catch (error) {
      this.categoryLabels = [];
    }
  }


  get pieChartOptions() {
    const shouldShowLegend = window.innerWidth > 1200;
    const currentCategories = this.categoryLabels.join(',');
    const cacheKey = `pieChart_${this.isDarkTheme}_${shouldShowLegend}_${currentCategories}`;

    if (this._chartOptions === null || this._chartOptions._cacheKey !== cacheKey) {
      this._chartOptions = {
        ...this.buildPieChartOptions(shouldShowLegend),
        _cacheKey: cacheKey
      };
    }
    return this._chartOptions;
  }

  private buildPieChartOptions(shouldShowLegend: boolean) {
    // Use categoryLabels (extracted from domains) for chart labels
    const labels = this.categoryLabels.map(cat => {
      const key = `DASHBOARD.FILTERS.CATEGORIES.${cat.toUpperCase().replace(/-/g, '_')}`;
      const translated = this.translateService.instant(key);
      return translated !== key ? translated : cat;
    });

    const colorPalette = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#fa709a'];
    const colors = labels.map((_, i) => colorPalette[i % colorPalette.length]);

    return {
      chart: {
        type: 'pie',
        height: 380,
        foreColor: this.isDarkTheme ? '#f3eaff' : '#23272f',
        background: this.isDarkTheme ? '#232136' : '#fff'
      },
      labels,
      colors,
      dataLabels: {
        enabled: true,
        formatter: (val: number, opts: any) => opts.w.globals.seriesTotals[opts.seriesIndex] > 0 ? `${this.safeRound(val)}%` : '',
        style: { colors: this.isDarkTheme ? ['#f3eaff'] : ['#23272f'] }
      },
      plotOptions: { pie: { offsetY: 0, dataLabels: { offset: 0 } } },
      tooltip: {
        theme: this.isDarkTheme ? 'dark' : 'light',
        y: { formatter: (v: number) => formatDuration(v) }
      },
      legend: {
        show: shouldShowLegend,
        position: 'bottom',
        horizontalAlign: 'center',
        floating: false,
        fontSize: '14px',
        fontFamily: 'inherit',
        width: '100%',
        itemMargin: { horizontal: 8, vertical: 6 },
        onItemClick: { toggleDataSeries: true },
        markers: { width: 10, height: 10, radius: 5 }
      },
      stroke: { width: 2, colors: ['#ffffff'] }
    };
  }

  private safeRound(value: number): number {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Math.round(value * 100) / 100;
  }
}
