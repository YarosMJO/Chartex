import { Component, Input, ChangeDetectionStrategy, OnInit, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';
import { HeatmapSeries } from '../../../../services/heatmap.service';

@Component({
  selector: 'app-activity-heatmap',
  templateUrl: './activity-heatmap.component.html',
  styleUrls: ['./activity-heatmap.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityHeatmapComponent implements OnInit, OnChanges {
  @Input() activityHeatmapData: HeatmapSeries[] = [];
  @Input() activityHeatmapOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.logDebugInfo('ngOnInit');
  }

  ngOnChanges() {
    this.logDebugInfo('ngOnChanges');
    this.cdr.markForCheck();
  }

  private logDebugInfo(method: string) {
    console.log(`🔍 ACTIVITY HEATMAP DEBUG: ${method} called`, {
      dataLength: this.activityHeatmapData.length,
      hasOptions: !!this.activityHeatmapOptions
    });
  }
}
