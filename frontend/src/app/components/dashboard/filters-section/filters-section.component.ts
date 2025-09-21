import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
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
export class FiltersSectionComponent {
  @Input() selectedPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';
  @Input() selectedDevice: string = 'all';
  @Input() devices: Device[] = [];
  @Input() showDeviceFilter: boolean = true;

  @Output() periodChange = new EventEmitter<'7d' | '30d' | '90d' | '1y' | 'all'>();
  @Output() deviceChange = new EventEmitter<string>();

  onPeriodChange() {
    this.periodChange.emit(this.selectedPeriod);
  }

  onDeviceChange() {
    this.deviceChange.emit(this.selectedDevice);
  }
} 