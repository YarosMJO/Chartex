import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule } from '@ngx-translate/core';

export interface FilterOptions {
  categories: string[];
  durationRange: { min: number; max: number };
  dateRange: { start: Date | null; end: Date | null };
  customPeriod: boolean;
  durationType: 'total' | 'average'; // Додаємо тип фільтрації часу
}

@Component({
  selector: 'app-advanced-filters',
  templateUrl: './advanced-filters.component.html',
  styleUrls: ['./advanced-filters.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
    MatInputModule,
    TranslateModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdvancedFiltersComponent implements OnDestroy {
  @Input() filters: FilterOptions = {
    categories: [],
    durationRange: { min: 0, max: 180 }, // Максимальний час в хвилинах (3 години)
    dateRange: { start: null, end: null },
    customPeriod: false,
    durationType: 'total' // За замовчуванням фільтруємо по загальному часу
  };

  @Input() availableCategories: string[] = [];
  @Input() isExpanded: boolean = false;

  @Output() filtersChange = new EventEmitter<FilterOptions>();
  @Output() clearFilters = new EventEmitter<void>();

  // Дебаунсинг для дат
  private dateInputTimeout: any = null;
  private dateChangeTimeout: any = null;
  
  // Флаг для запобігання циклічним оновленням
  private isUpdatingDurationType: boolean = false;

  // Попередньо визначені категорії
  predefinedCategories = [
    { value: 'social', label: 'DASHBOARD.FILTERS.CATEGORIES.SOCIAL' },
    { value: 'news', label: 'DASHBOARD.FILTERS.CATEGORIES.NEWS' },
    { value: 'work', label: 'DASHBOARD.FILTERS.CATEGORIES.WORK' },
    { value: 'education', label: 'DASHBOARD.FILTERS.CATEGORIES.EDUCATION' },
    { value: 'entertainment', label: 'DASHBOARD.FILTERS.CATEGORIES.ENTERTAINMENT' },
    { value: 'shopping', label: 'DASHBOARD.FILTERS.CATEGORIES.SHOPPING' },
    { value: 'technology', label: 'DASHBOARD.FILTERS.CATEGORIES.TECHNOLOGY' },
    { value: 'search_engine', label: 'DASHBOARD.FILTERS.CATEGORIES.SEARCH_ENGINE' }
  ];

  // Опції часу проведеного на сайті (в хвилинах)
  durationOptions = [
    { value: 'all', label: 'DASHBOARD.FILTERS.DURATION.ALL', range: { min: 0, max: 180 } },
    { value: 'short', label: 'DASHBOARD.FILTERS.DURATION.SHORT', range: { min: 0, max: 5 } }, // До 5 хвилин
    { value: 'medium', label: 'DASHBOARD.FILTERS.DURATION.MEDIUM', range: { min: 5, max: 30 } }, // 5-30 хвилин
    { value: 'long', label: 'DASHBOARD.FILTERS.DURATION.LONG', range: { min: 30, max: 180 } }, // Більше 30 хвилин
    { value: 'custom', label: 'DASHBOARD.FILTERS.DURATION.CUSTOM', range: { min: 0, max: 180 } }
  ];

  // Оновлюємо діапазони в залежності від типу фільтрації
  get adjustedDurationOptions() {
    if (this.filters.durationType === 'average') {
      // Для середнього часу використовуємо менші діапазони
      return [
        { value: 'all', label: 'DASHBOARD.FILTERS.DURATION.ALL', range: { min: 0, max: 60 } },
        { value: 'short', label: 'DASHBOARD.FILTERS.DURATION.SHORT', range: { min: 0, max: 2 } }, // До 2 хвилин
        { value: 'medium', label: 'DASHBOARD.FILTERS.DURATION.MEDIUM', range: { min: 2, max: 10 } }, // 2-10 хвилин
        { value: 'long', label: 'DASHBOARD.FILTERS.DURATION.LONG', range: { min: 10, max: 60 } }, // Більше 10 хвилин
        { value: 'custom', label: 'DASHBOARD.FILTERS.DURATION.CUSTOM', range: { min: 0, max: 60 } }
      ];
    } else {
      // Для загального часу використовуємо оригінальні діапазони
      return this.durationOptions;
    }
  }

  selectedDurationOption: string = 'all';

  onCategoryChange(category: string, checked: boolean) {
    const newCategories = checked 
      ? [...this.filters.categories, category]
      : this.filters.categories.filter(c => c !== category);
    
    this.updateFilters({ ...this.filters, categories: newCategories });
  }

  onDurationOptionChange(option: string) {
    this.selectedDurationOption = option;
    
    const durationOption = this.adjustedDurationOptions.find(d => d.value === option);
    if (durationOption) {
      // Якщо вибирається "custom", встановлюємо розумні значення за замовчуванням
      if (option === 'custom') {
        const maxRange = this.filters.durationType === 'average' ? 60 : 180;
        const defaultRange = { min: 0, max: maxRange };
        this.updateFilters({ 
          ...this.filters, 
          durationRange: defaultRange 
        });
      } else {
        this.updateFilters({ 
          ...this.filters, 
          durationRange: durationOption.range 
        });
      }
    }
  }

    private updateSelectedDurationOption() {
    const { min, max } = this.filters.durationRange;

    // Перевіряємо чи це "all" опція (0-180 для total, 0-60 для average)
    const maxRange = this.filters.durationType === 'average' ? 60 : 180;
    if (min === 0 && max === maxRange) {
      this.selectedDurationOption = 'all';
    } else {
      // Шукаємо точне співпадіння з попередньо визначеними опціями
      const matchingOption = this.adjustedDurationOptions.find(option =>
        option.range.min === min && option.range.max === max
      );
      if (matchingOption) {
        this.selectedDurationOption = matchingOption.value;
      } else {
        // Якщо немає точного співпадіння, це кастомний діапазон
        this.selectedDurationOption = 'custom';
      }
    }
  }

  onMinDurationChange(value: string | number) {
    if (this.isUpdatingDurationType) {
      return; // Пропускаємо оновлення під час зміни типу
    }
    
    const maxRange = this.filters.durationType === 'average' ? 60 : 180;
    const newMin = Math.max(0, Math.min(Number(value), this.filters.durationRange.max));
    
    if (newMin !== this.filters.durationRange.min) {
      // Якщо мінімальне значення перевищує максимальне, збільшуємо максимальне
      if (newMin > this.filters.durationRange.max) {
        this.filters.durationRange.max = newMin;
      }
      
      this.filters.durationRange.min = newMin;
      this.updateSelectedDurationOption();
      this.updateFilters({ ...this.filters });
    }
  }

  onMaxDurationChange(value: string | number) {
    if (this.isUpdatingDurationType) {
      return; // Пропускаємо оновлення під час зміни типу
    }
    
    const maxRange = this.filters.durationType === 'average' ? 60 : 180;
    const newMax = Math.max(this.filters.durationRange.min, Math.min(Number(value), maxRange));
    
    if (newMax !== this.filters.durationRange.max) {
      // Якщо максимальне значення менше мінімального, зменшуємо мінімальне
      if (newMax < this.filters.durationRange.min) {
        this.filters.durationRange.min = newMax;
      }
      
      this.filters.durationRange.max = newMax;
      this.updateSelectedDurationOption();
      this.updateFilters({ ...this.filters });
    }
  }

  onDateRangeChange(type: 'start' | 'end', date: Date | null) {
    // Очищаємо попередній таймаут
    if (this.dateChangeTimeout) {
      clearTimeout(this.dateChangeTimeout);
    }
    
    // Встановлюємо новий таймаут
    this.dateChangeTimeout = setTimeout(() => {
      // Перевіряємо чи дійсно змінилася дата
      const currentDate = this.filters.dateRange[type];
      const dateChanged = this.hasDateChanged(currentDate, date);
      
      if (dateChanged) {
        this.updateFilters({ 
          ...this.filters, 
          dateRange: { 
            ...this.filters.dateRange, 
            [type]: date 
          } 
        });
      }
    }, 100); // Затримка 100мс для dateChange
  }

  private hasDateChanged(oldDate: Date | null, newDate: Date | null): boolean {
    if (oldDate === null && newDate === null) return false;
    if (oldDate === null || newDate === null) return true;
    return oldDate.getTime() !== newDate.getTime();
  }

  onDateInputChange(type: 'start' | 'end', event: any) {
    // Очищаємо попередні таймаути
    if (this.dateInputTimeout) {
      clearTimeout(this.dateInputTimeout);
    }
    if (this.dateChangeTimeout) {
      clearTimeout(this.dateChangeTimeout);
    }
    
    // Встановлюємо новий таймаут
    this.dateInputTimeout = setTimeout(() => {
      const value = event.target.value;
      if (value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          this.onDateRangeChange(type, date);
        }
      }
    }, 300); // Затримка 300мс
  }

  onDateBlur(type: 'start' | 'end', event: any) {
    // Очищаємо таймаути при blur
    if (this.dateInputTimeout) {
      clearTimeout(this.dateInputTimeout);
    }
    if (this.dateChangeTimeout) {
      clearTimeout(this.dateChangeTimeout);
    }
    
    const value = event.target.value;
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        this.onDateRangeChange(type, date);
      }
    }
  }

  onDateKeyup(type: 'start' | 'end', event: any) {
    // Очищаємо попередні таймаути
    if (this.dateInputTimeout) {
      clearTimeout(this.dateInputTimeout);
    }
    if (this.dateChangeTimeout) {
      clearTimeout(this.dateChangeTimeout);
    }
    
    // Встановлюємо новий таймаут
    this.dateInputTimeout = setTimeout(() => {
      const value = event.target.value;
      if (value && value.length >= 8) { // Мінімальна довжина для дати YYYY-MM-DD
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          this.onDateRangeChange(type, date);
        }
      }
    }, 200); // Затримка 200мс для keyup
  }

  onCustomPeriodToggle() {
    this.updateFilters({ 
      ...this.filters, 
      customPeriod: !this.filters.customPeriod 
    });
  }

  onClearFilters() {
    this.selectedDurationOption = 'all';
    this.clearFilters.emit();
  }

  private updateFilters(newFilters: FilterOptions) {
    this.filtersChange.emit(newFilters);
  }

  getDurationLabel(min: number, max: number): string {
    if (max === 1440) return 'DASHBOARD.FILTERS.DURATION.ALL';
    if (min < 5) return 'DASHBOARD.FILTERS.DURATION.SHORT';
    if (min < 30) return 'DASHBOARD.FILTERS.DURATION.MEDIUM';
    return 'DASHBOARD.FILTERS.DURATION.LONG';
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} хв`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}г ${mins}хв` : `${hours}г`;
  }

  // Додаємо метод для зміни типу фільтрації часу
  onDurationTypeChange(type: 'total' | 'average') {
    // Встановлюємо флаг для запобігання циклічним оновленням
    this.isUpdatingDurationType = true;
    
    // Оновлюємо діапазон в залежності від типу
    const maxRange = type === 'average' ? 60 : 180;
    const newFilters = { 
      ...this.filters, 
      durationType: type,
      durationRange: { min: 0, max: maxRange }
    };
    
    // Скидаємо вибрану опцію на "all"
    this.selectedDurationOption = 'all';
      }
    } else {
      // Інакше перевіряємо чи відповідає якійсь з попередньо визначених опцій
      // Але тільки якщо не вибрано кастомний тип
      if (this.selectedDurationOption !== 'custom') {
        this.updateSelectedDurationOption();
      }
    }
    
    this.updateFilters(newFilters);
    
    // Скидаємо флаг після невеликої затримки
    setTimeout(() => {
      this.isUpdatingDurationType = false;
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.dateInputTimeout) {
      clearTimeout(this.dateInputTimeout);
    }
    if (this.dateChangeTimeout) {
      clearTimeout(this.dateChangeTimeout);
    }
  }
} 