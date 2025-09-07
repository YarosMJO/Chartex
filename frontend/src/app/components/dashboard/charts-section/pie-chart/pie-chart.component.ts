import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pie-chart',
  templateUrl: './pie-chart.component.html',
  styleUrls: ['./pie-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PieChartComponent implements OnInit, OnChanges {
  @Input() categoryDistributionData: number[] = [];
  @Input() pieChartOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.logDebugInfo('ngOnInit');
  }

  ngOnChanges() {
    this.logDebugInfo('ngOnChanges');
    this.cdr.markForCheck();
  }

  private logDebugInfo(method: string) {
    console.log(`🔍 PIE CHART DEBUG: ${method} called`, {
      dataLength: this.categoryDistributionData.length,
      hasOptions: !!this.pieChartOptions
    });
  }
}
