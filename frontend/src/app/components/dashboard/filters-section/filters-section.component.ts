import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { Device } from '../../../services/api.service';

@Component({
  selector: 'app-filters-section',
  templateUrl: './filters-section.component.html',
  styleUrls: ['./filters-section.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatSelectModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FiltersSectionComponent implements OnInit, OnChanges {
  @Input() selectedPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
  @Input() selectedDevice: string = 'all';
  @Input() devices: Device[] = [];
  @Input() showDeviceFilter: boolean = true;

  @Output() periodChange = new EventEmitter<'7d' | '30d' | '90d' | '1y' | 'all'>();
  @Output() deviceChange = new EventEmitter<string>();

  // Зберігаємо попередні значення для порівняння
  private previousPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
  private previousDevice: string = 'all';

  onPeriodChange(newPeriod: '7d' | '30d' | '90d' | '1y' | 'all') {
    // Випромінюємо подію тільки якщо значення дійсно змінилося
    if (newPeriod !== this.previousPeriod) {
      this.previousPeriod = newPeriod;
      this.periodChange.emit(newPeriod);
    }
  }

  onDeviceChange(newDevice: string) {
    // Випромінюємо подію тільки якщо значення дійсно змінилося
    if (newDevice !== this.previousDevice) {
      this.previousDevice = newDevice;
      this.deviceChange.emit(newDevice);
    }
  }

  ngOnInit() {
    // Ініціалізуємо попередні значення
    this.previousPeriod = this.selectedPeriod;
    this.previousDevice = this.selectedDevice;
  }

  ngOnChanges(changes: SimpleChanges) {
    // Оновлюємо попередні значення при зміні входів
    if (changes['selectedPeriod']) {
      this.previousPeriod = this.selectedPeriod;
    }
    if (changes['selectedDevice']) {
      this.previousDevice = this.selectedDevice;
    }
  }
} 