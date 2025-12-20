import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { cleanDomainName, formatDuration } from '../../../../utils/utils';

@Component({
  selector: 'app-top-sites',
  templateUrl: './top-sites.component.html',
  styleUrls: ['./top-sites.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopSitesComponent implements OnChanges {
  @Input() topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];
  @Input() showDurationCharts: boolean = true;

  constructor(private cdr: ChangeDetectorRef, private translateService: TranslateService) { }

  ngOnChanges() {
    this.cdr.markForCheck();
  }

  trackByDomain(index: number, domain: any): string {
    return domain.name || index.toString();
  }

  formatDuration(seconds: number): string {
    return formatDuration(seconds, this.translateService);
  }

  cleanDomainName = cleanDomainName;

  // Безпечна функція для округлення
  safeRound = (value: number): number => {
    if (typeof Math !== 'undefined' && typeof Math.round === 'function') {
      return Math.round(value);
    }
    // Fallback якщо Math недоступний
    return Math.floor(value + 0.5);
  };
}