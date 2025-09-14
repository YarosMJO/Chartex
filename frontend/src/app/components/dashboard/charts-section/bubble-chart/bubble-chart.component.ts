import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-bubble-chart',
  templateUrl: './bubble-chart.component.html',
  styleUrls: ['./bubble-chart.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, NgApexchartsModule, TranslateModule],
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
  @Input() scaleMode: 'normal' | 'zoomed' = 'normal';
  @Output() scaleToggle = new EventEmitter<void>();

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

  toggleScale() {
    this.scaleToggle.emit();
  }

  getScaleButtonIcon(): string {
    return this.scaleMode === 'normal' ? 'zoom_in' : 'zoom_out';
  }

  getScaleButtonTitle(): string {
    return this.scaleMode === 'normal' ? 'Збільшити масштаб' : 'Зменшити масштаб';
  }
}
