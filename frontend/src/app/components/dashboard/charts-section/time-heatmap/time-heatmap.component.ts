import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';
import { HeatmapSeries } from '../../../../services/heatmap.service';

@Component({
  selector: 'app-time-heatmap',
  templateUrl: './time-heatmap.component.html',
  styleUrls: ['./time-heatmap.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeHeatmapComponent implements OnInit, OnChanges {
  @Input() timeOfDayWeekHeatmapData: HeatmapSeries[] = [];
  @Input() timeOfDayWeekHeatmapOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.logDebugInfo('ngOnInit');
  }

  ngOnChanges() {
    this.logDebugInfo('ngOnChanges');
    this.cdr.markForCheck();
  }

  private logDebugInfo(method: string) {
    console.log(`🔍 TIME HEATMAP DEBUG: ${method} called`, {
      dataLength: this.timeOfDayWeekHeatmapData.length,
      hasOptions: !!this.timeOfDayWeekHeatmapOptions
    });
  }
}
