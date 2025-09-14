import { Component, Input, ChangeDetectionStrategy, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-bubble-chart',
  templateUrl: './bubble-chart.component.html',
  styleUrls: ['./bubble-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
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
  @Input() bubbleChartOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges() {
    this.cdr.markForCheck();
  }

  getBubbleChartSeries() {
    return [{
      name: 'Сайти',
      data: this.bubbleChartData
    }];
  }

  onChartReady(event: any) {
    // Chart ready event handled
  }
}
