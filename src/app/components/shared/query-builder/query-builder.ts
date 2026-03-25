import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QueryService } from '../../../services/query.service';
import { WidgetType } from '../../../core/interfaces';
import {
  StatQueryConfig, ChartQueryConfig,
  PieQueryConfig, TableQueryConfig,
} from '../../../core/query-types';
import { StatQueryBuilder } from './stat-query-builder/stat-query-builder';
import { ChartQueryBuilder } from './chart-query-builder/chart-query-builder';
import { PieQueryBuilder } from './pie-query-builder/pie-query-builder';
import { TableQueryBuilder } from './table-query-builder/table-query-builder';

export type AnyQueryConfig =
  | StatQueryConfig
  | ChartQueryConfig
  | PieQueryConfig
  | TableQueryConfig;

@Component({
  selector: 'app-query-builder',
  imports: [CommonModule, FormsModule, StatQueryBuilder, ChartQueryBuilder, PieQueryBuilder, TableQueryBuilder],
  templateUrl: './query-builder.html',
  styleUrl: '../config-panels/config-panels.scss',
})
export class QueryBuilder implements OnInit {
  @Input({ required: true }) widgetType!: WidgetType;
  @Input() queryConfig: AnyQueryConfig | null = null;
  @Output() queryConfigChange = new EventEmitter<AnyQueryConfig>();

  readonly WidgetType = WidgetType;

  private readonly qsvc = inject(QueryService);

  selectedProduct = '';

  get products(): Array<{ slug: string; display_name: string }> {
    return this.qsvc.getProductList();
  }

  get productLabel(): string {
    return this.products.find(p => p.slug === this.selectedProduct)?.display_name ?? 'Select product';
  }

  get builderLabel(): string {
    if (this.widgetType === WidgetType.Analytics) return 'Analytics metric';
    if (this.widgetType === WidgetType.Progress) return 'Progress metric';
    if (this.isStat) return 'Single-value metric';
    if (this.isChart) return 'Series chart';
    if (this.isPie) return 'Distribution chart';
    if (this.isTable) return 'Tabular query';
    return 'Query builder';
  }

  ngOnInit(): void {
    this.selectedProduct =
      (this.queryConfig as any)?.product ?? this.products[0]?.slug ?? '';
  }

  // ── Type guards ──────────────────────────────────────────────
  get isStat():     boolean { return this.widgetType === WidgetType.Stat     || this.widgetType === WidgetType.Analytics; }
  get isChart():    boolean { return this.widgetType === WidgetType.Bar      || this.widgetType === WidgetType.Line; }
  get isPie():      boolean { return this.widgetType === WidgetType.Pie; }
  get isTable():    boolean { return this.widgetType === WidgetType.Table; }
  get isProgress(): boolean { return this.widgetType === WidgetType.Progress; }

  // ── Typed config pass-throughs ───────────────────────────────
  get statConfig():  StatQueryConfig  | null { return (this.isStat || this.isProgress) ? this.queryConfig as StatQueryConfig  : null; }
  get chartConfig(): ChartQueryConfig | null { return this.isChart   ? this.queryConfig as ChartQueryConfig : null; }
  get pieConfig():   PieQueryConfig   | null { return this.isPie     ? this.queryConfig as PieQueryConfig   : null; }
  get tableConfig(): TableQueryConfig | null { return this.isTable   ? this.queryConfig as TableQueryConfig : null; }

  onProductChange(slug: string): void {
    this.selectedProduct = slug;
    // Clear query config when product changes so sub-builders reinitialise
    this.queryConfigChange.emit(undefined as any);
  }

  onQueryConfigChange(cfg: AnyQueryConfig): void {
    this.queryConfigChange.emit(cfg);
  }
}
