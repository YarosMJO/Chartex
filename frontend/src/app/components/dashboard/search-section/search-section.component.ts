import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatDuration } from '../../../utils/utils';

@Component({
  selector: 'app-search-section',
  templateUrl: './search-section.component.html',
  styleUrls: ['./search-section.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatSelectModule,
    TranslateModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchSectionComponent implements OnInit, OnChanges {
  @Input() searchQuery: string = '';
  @Input() searchResults: any[] = [];
  @Input() isSearching: boolean = false;
  @Input() hasResults: boolean = false;
  @Input() selectedPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';

  @Output() searchChange = new EventEmitter<string>();
  @Output() clearSearch = new EventEmitter<void>();
  @Output() periodChange = new EventEmitter<'7d' | '30d' | '90d' | '1y' | 'all'>();

  constructor(private translateService: TranslateService) {}

  formatDuration(seconds: number): string {
    return formatDuration(seconds, this.translateService);
  }
  
  private previousPeriod: '7d' | '30d' | '90d' | '1y' | 'all' = '30d';

  ngOnInit() {
    this.previousPeriod = this.selectedPeriod;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedPeriod']) {
      this.previousPeriod = this.selectedPeriod;
    }
  }

  onPeriodChange(newPeriod: '7d' | '30d' | '90d' | '1y' | 'all') {
    if (newPeriod !== this.previousPeriod) {
      this.previousPeriod = newPeriod;
      this.periodChange.emit(newPeriod);
    }
  }

  onSearchInput(event: any) {
    const query = event.target.value;
    this.searchChange.emit(query);
  }

  onClearSearch() {
    this.clearSearch.emit();
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      // Можна додати додаткову логіку для Enter, якщо потрібно
    }
  }
} 