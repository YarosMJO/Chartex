import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';
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
    TranslateModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchSectionComponent {
  @Input() searchQuery: string = '';
  @Input() searchResults: any[] = [];
  @Input() isSearching: boolean = false;
  @Input() hasResults: boolean = false;

  @Output() searchChange = new EventEmitter<string>();
  @Output() clearSearch = new EventEmitter<void>();

  formatDuration = formatDuration;

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