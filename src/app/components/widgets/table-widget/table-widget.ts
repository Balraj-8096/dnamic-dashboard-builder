// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Data Table Widget
//  Sortable data table with status badges
//  Uses Angular Material MatTable
// ═══════════════════════════════════════════════════════════════

import {
  Component,
  Input,
  OnChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  effect,
  untracked,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { TableColumn, TableConfig, TableRow, Widget } from '../../../core/interfaces';
import { STATUS_FALLBACK, STATUS_MAP } from '../../../core/constants';
import { QueryService } from '../../../services/query.service';
import { mapTableResult } from '../../../core/query-result-mapper';
import { WidgetDatePickerComponent, DatePickerChange } from '../../shared/widget-date-picker/widget-date-picker';
import { FilterCondition } from '../../../core/query-types';

@Component({
  selector: 'app-table-widget',
  imports:         [CommonModule, MatTableModule, WidgetDatePickerComponent],
  templateUrl: './table-widget.html',
  styleUrl: './table-widget.scss',
})
export class TableWidget implements OnChanges {

  @Input({ required: true }) widget!: Widget;
  @Input() contentH: number = 200;

  // Displayed column keys for MatTable
  displayedColumns: string[] = [];

  private readonly qsvc = inject(QueryService);
  private readonly cdr  = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      this.qsvc.globalFilters();
      untracked(() => { if (this.widget) { this.refresh(); this.cdr.markForCheck(); } });
    });
  }

  localDatePreset = '';
  private localDateFilter: FilterCondition | null = null;

  onDateChange(e: DatePickerChange): void {
    this.localDateFilter = e.filter;
    this.localDatePreset  = e.preset;
    this.refresh();
    this.cdr.markForCheck();
  }

  private _displayCols: TableColumn[] | null = null;
  private _displayRows: TableRow[]   | null = null;

  get cfg(): TableConfig {
    return this.widget.config as TableConfig;
  }

  get cols(): TableColumn[] {
    return this._displayCols ?? this.cfg?.columns ?? [];
  }

  get rows(): TableRow[] {
    return this._displayRows ?? this.cfg?.rows ?? [];
  }

  ngOnChanges(): void { this.refresh(); }

  private refresh(): void {
    if (this.cfg?.queryConfig) {
      try {
        const effectiveQcfg = this.localDateFilter
          ? { ...this.cfg.queryConfig, filters: [...(this.cfg.queryConfig.filters ?? []), this.localDateFilter] }
          : this.cfg.queryConfig;
        const mapped = mapTableResult(this.qsvc.executeTableQuery(effectiveQcfg));
        // Prefer cfg.columns (user-configured visible columns) so that source fields
        // fetched for derived/combined columns don't appear as extra table columns.
        this._displayCols = this.cfg.columns?.length ? this.cfg.columns : mapped.columns;
        this._displayRows = mapped.rows;
      } catch {
        this._displayCols = null;
        this._displayRows = null;
      }
    } else {
      this._displayCols = null;
      this._displayRows = null;
    }
    this.displayedColumns = this.cols.map(c => c.key);
  }

  /**
   * Get status badge style for a cell value.
   * Only applied when cfg.statusColumn === true
   * and the column key is 'status'.
   */
  getStatusStyle(value: unknown): {
    bg: string;
    fg: string;
    label: string;
  } {
    const key = String(value ?? '').toLowerCase();
    return STATUS_MAP[key] || {
      ...STATUS_FALLBACK,
      label: value,
    };
  }

  /**
   * Check if a column should render status badges.
   */
  isStatusCol(col: TableColumn): boolean {
    return this.cfg?.statusColumn === true &&
           col.key === 'status';
  }

  /**
   * Get cell value from row by column key.
   */
  getCellValue(row: TableRow, key: string): unknown {
    return row[key] ?? '';
  }
}

