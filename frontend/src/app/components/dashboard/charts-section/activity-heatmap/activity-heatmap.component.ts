import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { HeatmapSeries } from '../../../../services/heatmap.service';

@Component({
  selector: 'app-activity-heatmap',
  templateUrl: './activity-heatmap.component.html',
  styleUrls: ['./activity-heatmap.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityHeatmapComponent implements OnChanges {
  @Input() activityHeatmapData: HeatmapSeries[] = [];
  @Input() activityHeatmapOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) { }


  ngOnChanges() {
    this.cdr.markForCheck();
  }


}
