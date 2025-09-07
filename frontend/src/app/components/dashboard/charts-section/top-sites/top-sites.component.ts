import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';
import { formatDuration, cleanDomainName } from '../../../../utils/utils';

@Component({
  selector: 'app-top-sites',
  templateUrl: './top-sites.component.html',
  styleUrls: ['./top-sites.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopSitesComponent implements OnInit, OnChanges {
  @Input() topDomainsData: { name: string; title: string; visits: number; duration: number }[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.logDebugInfo('ngOnInit');
  }

  ngOnChanges() {
    this.logDebugInfo('ngOnChanges');
    this.cdr.markForCheck();
  }

  trackByDomain(index: number, domain: any): string {
    return domain.name || index.toString();
  }

  formatDuration = formatDuration;
  cleanDomainName = cleanDomainName;

  private logDebugInfo(method: string) {
    console.log(`🔍 TOP SITES DEBUG: ${method} called`, {
      dataLength: this.topDomainsData.length
    });
  }
}
