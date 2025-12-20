import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Device } from '../../../services/api.service';
import { formatDuration as formatDurationUtil, formatNumber, getDeviceTypeLabel } from '../../../utils/utils';

@Component({
  selector: 'app-devices-section',
  templateUrl: './devices-section.component.html',
  styleUrls: ['./devices-section.component.scss'],
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevicesSectionComponent {
  @Input() devices: Device[] = [];

  constructor(private translateService: TranslateService) {}

  formatDuration(seconds: number): string {
    return formatDurationUtil(seconds, this.translateService);
  }

  formatNumber = formatNumber;
  getDeviceTypeLabel = getDeviceTypeLabel;

  trackByDevice(index: number, device: any): string {
    return device.deviceId || index.toString();
  }
}
