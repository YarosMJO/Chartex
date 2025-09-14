import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import { HeatmapSeries } from '../../../../services/heatmap.service';

@Component({
  selector: 'app-time-heatmap',
  templateUrl: './time-heatmap.component.html',
  styleUrls: ['./time-heatmap.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, NgApexchartsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeHeatmapComponent implements OnChanges {
  @Input() timeOfDayWeekHeatmapData: HeatmapSeries[] = [];
  @Input() timeOfDayWeekHeatmapOptions: any = {};

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnChanges() {
    this.cdr.markForCheck();
  }
}
