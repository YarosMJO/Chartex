import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { HistoryStats } from '../../../services/api.service';
import { formatDuration, formatNumber } from '../../../utils/utils';

@Component({
  selector: 'app-stats-cards',
  templateUrl: './stats-cards.component.html',
  styleUrls: ['./stats-cards.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsCardsComponent {
  @Input() userStats: HistoryStats | null = null;
  @Input() devicesCount: number = 0;

  formatDuration = formatDuration;
  formatNumber = formatNumber;
} 