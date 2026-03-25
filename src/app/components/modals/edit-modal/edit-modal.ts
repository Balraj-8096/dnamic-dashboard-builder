import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { getCatalogItem } from '../../../core/catalog';
import { Widget, WidgetConfig, WidgetType } from '../../../core/interfaces';
import { DashboardService } from '../../../services/dashboard.service';
import { QueryService } from '../../../services/query.service';
import {
  StatQueryResult, ChartQueryResult, PieQueryResult, TableQueryResult,
} from '../../../core/query-types';
import { EditStatConfig } from "../../shared/edit-stat-config/edit-stat-config";
import { EditAnalyticsConfig } from "../../shared/edit-analytics-config/edit-analytics-config";
import { EditSeriesConfig } from "../../shared/edit-series-config/edit-series-config";
import { EditPieConfig } from "../../shared/edit-pie-config/edit-pie-config";
import { EditProgressConfig } from "../../shared/edit-progress-config/edit-progress-config";
import { EditNoteConfig } from "../../shared/edit-note-config/edit-note-config";
import { EditSectionConfig } from "../../shared/edit-section-config/edit-section-config";
import { QueryBuilder, AnyQueryConfig } from "../../shared/query-builder/query-builder";
import { StatWidget } from "../../widgets/stat-widget/stat-widget";
import { AnalyticsWidget } from "../../widgets/analytics-widget/analytics-widget";
import { BarWidget } from "../../widgets/bar-widget/bar-widget";
import { LineWidget } from "../../widgets/line-widget/line-widget";
import { PieWidget } from "../../widgets/pie-widget/pie-widget";
import { ProgressWidget } from "../../widgets/progress-widget/progress-widget";
import { NoteWidget } from "../../widgets/note-widget/note-widget";
import { SectionWidget } from "../../widgets/section-widget/section-widget";
import { TableEditorModal } from "../table-editor-modal/table-editor-modal";

@Component({
  selector: 'app-edit-modal',
  imports: [
    CommonModule, FormsModule,
    QueryBuilder,
    EditStatConfig, EditAnalyticsConfig, EditSeriesConfig, EditPieConfig,
    EditProgressConfig, EditNoteConfig, EditSectionConfig,
    StatWidget, AnalyticsWidget, BarWidget, LineWidget, PieWidget,
    ProgressWidget, NoteWidget, SectionWidget,
    TableEditorModal,
  ],
  templateUrl: './edit-modal.html',
  styleUrl: './edit-modal.scss',
})
export class EditModal implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<EditModal>);
  readonly widget = inject<Widget>(MAT_DIALOG_DATA);
  private readonly svc  = inject(DashboardService);
  private readonly qsvc = inject(QueryService);

  title   = '';
  cfg!:    WidgetConfig;
  queryJsonOpen   = true;
  resultJsonOpen  = true;
  payloadJsonOpen = true;

  // ── Query result state ────────────────────────────────────────
  queryResult:    StatQueryResult | ChartQueryResult | PieQueryResult | TableQueryResult | null = null;
  queryError:     string | null = null;
  resultCategory: 'stat' | 'chart' | 'pie' | 'table' | null = null;
  private viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;

  // Expose enum for template
  readonly WidgetType = WidgetType;

  // ── Derived ───────────────────────────────────────────────────
  get cat() { return getCatalogItem(this.widget.type); }

  /** Data widgets support live query; Note/Section are display-only */
  get hasQuery(): boolean {
    return ![WidgetType.Note, WidgetType.Section].includes(this.widget.type);
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.title = this.widget.title;
    this.cfg = JSON.parse(JSON.stringify(this.widget.config));
    this.runQuery();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.viewportWidth = window.innerWidth;
  }

  // ── Display config changes ────────────────────────────────────
  onCfgChange(newCfg: WidgetConfig): void {
    this.cfg = newCfg;
  }

  // ── Query config ──────────────────────────────────────────────
  get queryCfg(): AnyQueryConfig | null {
    return (this.cfg as any)?.queryConfig ?? null;
  }

  onQueryCfgChange(qcfg: AnyQueryConfig): void {
    this.cfg = { ...this.cfg, queryConfig: qcfg } as any;
    this.runQuery();
  }

  // ── Query execution (for dev result panel) ───────────────────
  private runQuery(): void {
    const qcfg = this.queryCfg as any;
    if (!qcfg?.product) {
      this.queryResult    = null;
      this.queryError     = null;
      this.resultCategory = null;
      return;
    }
    try {
      const t = this.widget.type;
      if (t === WidgetType.Stat || t === WidgetType.Analytics || t === WidgetType.Progress) {
        this.queryResult    = this.qsvc.executeStatQuery(qcfg);
        this.resultCategory = 'stat';
      } else if (t === WidgetType.Bar || t === WidgetType.Line) {
        this.queryResult    = this.qsvc.executeChartQuery(qcfg);
        this.resultCategory = 'chart';
      } else if (t === WidgetType.Pie) {
        this.queryResult    = this.qsvc.executePieQuery(qcfg);
        this.resultCategory = 'pie';
      } else if (t === WidgetType.Table) {
        this.queryResult    = this.qsvc.executeTableQuery(qcfg);
        this.resultCategory = 'table';
      }
      this.queryError = null;
    } catch (e) {
      this.queryResult    = null;
      this.queryError     = (e as Error).message;
      this.resultCategory = null;
    }
  }

  // Typed result accessors for template
  get statResult():  StatQueryResult  | null { return this.resultCategory === 'stat'  ? this.queryResult as StatQueryResult  : null; }
  get chartResult(): ChartQueryResult | null { return this.resultCategory === 'chart' ? this.queryResult as ChartQueryResult : null; }
  get pieResult():   PieQueryResult   | null { return this.resultCategory === 'pie'   ? this.queryResult as PieQueryResult   : null; }
  get tableResult(): TableQueryResult | null { return this.resultCategory === 'table' ? this.queryResult as TableQueryResult : null; }

  // ── Preview ───────────────────────────────────────────────────
  get previewH(): number {
    if (this.viewportWidth <= 720) {
      if ([WidgetType.Bar, WidgetType.Line, WidgetType.Pie].includes(this.widget.type)) return 170;
      if (this.widget.type === WidgetType.Table) return 150;
      return 132;
    }
    if (this.viewportWidth <= 1100) {
      if ([WidgetType.Bar, WidgetType.Line, WidgetType.Pie].includes(this.widget.type)) return 200;
      if (this.widget.type === WidgetType.Table) return 180;
      return 150;
    }
    if ([WidgetType.Bar, WidgetType.Line, WidgetType.Pie].includes(this.widget.type)) return 240;
    if (this.widget.type === WidgetType.Table) return 220;
    return 180;
  }

  get previewWidget(): Widget {
    return { ...this.widget, title: this.title, config: this.cfg ?? this.widget.config };
  }

  // ── Settings strip ────────────────────────────────────────────
  get settingsRows(): { k: string; v: string; isColor?: boolean }[] {
    const t   = this.widget.type;
    const cfg = this.cfg as any;
    const qcfg = this.queryCfg as any;
    return [
      { k: 'Type',  v: this.cat?.label ?? '' },
      { k: 'Title', v: this.title || '—' },
      ...(qcfg?.product    ? [{ k: 'Product',  v: qcfg.product }] : []),
      ...(qcfg?.entities?.length
        ? [{ k: 'Entities', v: (qcfg.entities as string[]).join(' → ') }]
        : []),
      ...(cfg?.accent      ? [{ k: 'Accent',   v: cfg.accent, isColor: true }] : []),
      ...(t === WidgetType.Table && cfg?.columns
        ? [{ k: 'Columns',  v: `${cfg.columns.length} cols` }] : []),
      ...(t === WidgetType.Progress && cfg?.items
        ? [{ k: 'Items',    v: `${cfg.items.length} bars` }] : []),
      ...(t === WidgetType.Pie && cfg?.data
        ? [{ k: 'Segments', v: `${cfg.data.length}` }] : []),
      ...((t === WidgetType.Bar || t === WidgetType.Line) && cfg?.series
        ? [{ k: 'Series',   v: `${cfg.series.length}` }] : []),
    ];
  }

  // ── Actions ───────────────────────────────────────────────────
  save(): void {
    this.svc.saveWidget({ ...this.widget, title: this.title, config: { ...this.cfg } });
    this.dialogRef.close();
  }

  cancel(): void {
    this.dialogRef.close();
  }

  /** Called by TableEditorModal (saved) output — saves and closes the dialog. */
  onTableSave(updated: Widget): void {
    this.svc.saveWidget(updated);
    this.dialogRef.close();
  }

  // Type casts for config panel bindings
  get cfgAsStat()      { return this.cfg as any; }
  get cfgAsAnalytics() { return this.cfg as any; }
  get cfgAsSeries()    { return this.cfg as any; }
  get cfgAsPie()       { return this.cfg as any; }
  get cfgAsTable()     { return this.cfg as any; }
  get cfgAsProgress()  { return this.cfg as any; }
  get cfgAsNote()      { return this.cfg as any; }
  get cfgAsSection()   { return this.cfg as any; }
}
