import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CATALOG } from '../../../core/catalog';
import { FACTORIES } from '../../../core/factories';
import { Widget, WidgetType, WidgetConfig } from '../../../core/interfaces';
import { DashboardService } from '../../../services/dashboard.service';
import { QueryService } from '../../../services/query.service';
import {
  StatQueryResult, ChartQueryResult, PieQueryResult, TableQueryResult,
} from '../../../core/query-types';
import { EditStatConfig } from "../../shared/edit-stat-config/edit-stat-config";
import { EditAnalyticsConfig } from "../../shared/edit-analytics-config/edit-analytics-config";
import { EditSeriesConfig } from "../../shared/edit-series-config/edit-series-config";
import { EditPieConfig } from "../../shared/edit-pie-config/edit-pie-config";
import { EditTableConfig } from "../../shared/edit-table-config/edit-table-config";
import { EditNoteConfig } from "../../shared/edit-note-config/edit-note-config";
import { EditProgressConfig } from "../../shared/edit-progress-config/edit-progress-config";
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
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TableEditorModal } from '../table-editor-modal/table-editor-modal';

export interface WizardDialogData {
  /** Pre-selected type from Ctrl+1-9 or sidebar click. null = open at Step 1. */
  initType: WidgetType | null;
}

@Component({
  selector: 'app-add-widget-wizard',
  imports: [
    CommonModule, ReactiveFormsModule, QueryBuilder,
    EditStatConfig, EditAnalyticsConfig, EditSeriesConfig, EditPieConfig,
    EditTableConfig, EditNoteConfig, EditProgressConfig, EditSectionConfig,
    StatWidget, AnalyticsWidget, BarWidget, LineWidget, PieWidget,
    ProgressWidget, NoteWidget, SectionWidget, TableEditorModal,
  ],
  templateUrl: './add-widget-wizard.html',
  styleUrl: './add-widget-wizard.scss',
})
export class AddWidgetWizard implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<AddWidgetWizard>);
  private readonly data      = inject<WizardDialogData>(MAT_DIALOG_DATA);
  private readonly svc       = inject(DashboardService);
  private readonly fb        = inject(FormBuilder);
  private readonly qsvc      = inject(QueryService);

  readonly catalog = CATALOG;
  readonly WidgetType = WidgetType;
  private viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;

  // ── Wizard state ──────────────────────────────────────────────
  step = 1;
  selectedType: WidgetType | null = null;
  cfg: WidgetConfig | null = null;
  queryJsonOpen   = true;
  resultJsonOpen  = true;
  payloadJsonOpen = true;
  queryResult: StatQueryResult | ChartQueryResult | PieQueryResult | TableQueryResult | null = null;
  queryError: string | null = null;
  resultCategory: 'stat' | 'chart' | 'pie' | 'table' | null = null;

  titleForm = this.fb.group({ title: ['', Validators.required] });

  // ── Derived ───────────────────────────────────────────────────
  get cat()           { return this.catalog.find(c => c.type === this.selectedType) ?? null; }
  get isConfigStep()  { return this.step === 2; }
  readonly stepLabels = ['Choose Type', 'Configure'];

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    const initType = this.data?.initType ?? null;
    if (initType) {
      this._initForType(initType);
      this.step = 2;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.viewportWidth = window.innerWidth;
  }

  // ── Step 1: select type card ───────────────────────────────────
  selectType(type: WidgetType): void {
    this._initForType(type);
    this.step = 2;
  }

  private _initForType(type: WidgetType): void {
    this.selectedType = type;
    const base = FACTORIES[type]?.(0, 0);
    this.cfg = base?.config ?? null;
    this.titleForm.setValue({ title: base?.title ?? '' });
    this.queryJsonOpen   = true;
    this.resultJsonOpen  = true;
    this.payloadJsonOpen = true;
    this.runQuery();
  }

  // ── Query support ─────────────────────────────────────────────
  get hasQuery(): boolean {
    return ![WidgetType.Note, WidgetType.Section].includes(this.selectedType!);
  }

  get queryCfg(): AnyQueryConfig | null {
    return (this.cfg as any)?.queryConfig ?? null;
  }

  onQueryCfgChange(qcfg: AnyQueryConfig): void {
    this.cfg = { ...this.cfg, queryConfig: qcfg } as any;
    this.runQuery();
  }

  // ── Display config panel output ───────────────────────────────
  onCfgChange(newCfg: WidgetConfig): void {
    this.cfg = newCfg;
  }

  private runQuery(): void {
    const qcfg = this.queryCfg as any;
    if (!qcfg?.product || !this.selectedType) {
      this.queryResult = null;
      this.queryError = null;
      this.resultCategory = null;
      return;
    }

    try {
      const t = this.selectedType;
      if (t === WidgetType.Stat || t === WidgetType.Analytics || t === WidgetType.Progress) {
        this.queryResult = this.qsvc.executeStatQuery(qcfg);
        this.resultCategory = 'stat';
      } else if (t === WidgetType.Bar || t === WidgetType.Line) {
        this.queryResult = this.qsvc.executeChartQuery(qcfg);
        this.resultCategory = 'chart';
      } else if (t === WidgetType.Pie) {
        this.queryResult = this.qsvc.executePieQuery(qcfg);
        this.resultCategory = 'pie';
      } else if (t === WidgetType.Table) {
        this.queryResult = this.qsvc.executeTableQuery(qcfg);
        this.resultCategory = 'table';
      } else {
        this.queryResult = null;
        this.resultCategory = null;
      }
      this.queryError = null;
    } catch (e) {
      this.queryResult = null;
      this.queryError = (e as Error).message;
      this.resultCategory = null;
    }
  }

  // ── Navigation ────────────────────────────────────────────────
  canNext(): boolean { return this.step === 1 ? !!this.selectedType : true; }
  nextStep(): void   { if (this.canNext()) this.step++; }
  prevStep(): void   { if (this.step > 1) this.step--; }

  // ── Add to dashboard ─────────────────────────────────────────
  addToDashboard(): void {
    if (!this.selectedType || !this.cfg) return;
    if (this.titleForm.invalid) { this.titleForm.markAllAsTouched(); return; }

    const base = FACTORIES[this.selectedType]?.(0, 0);
    if (!base) return;

    this.svc.addWidget({
      ...base,
      title:  this.titleForm.value.title ?? base.title,
      config: { ...this.cfg },
    });
    this.dialogRef.close();
  }

  close(): void { this.dialogRef.close(); }

  // ── Table-editor shortcut ─────────────────────────────────────
  /** Draft widget passed to TableEditorModal when table type is selected in step 2. */
  get draftWidget(): Widget | null {
    if (this.selectedType !== WidgetType.Table) return null;
    const base = FACTORIES[WidgetType.Table]?.(0, 0);
    if (!base) return null;
    return { ...base, title: this.titleForm.value.title || base.title };
  }

  /** Called by TableEditorModal (saved) output — routes through svc.addWidget and closes. */
  onTableSaveFromWizard(updated: Widget): void {
    this.svc.addWidget(updated);
    this.dialogRef.close();
  }

  // ── Preview helpers ───────────────────────────────────────────
  get previewTitle(): string { return this.titleForm.value.title ?? ''; }

  get previewContentH(): number {
    if (this.viewportWidth <= 720) return 120;
    if (this.viewportWidth <= 1024) return 140;
    return 180;
  }

  get summaryRows(): { k: string; v: string }[] {
    if (!this.selectedType) return [];
    const qcfg = this.queryCfg as any;
    return [
      { k: 'Type',    v: this.cat?.label ?? '' },
      { k: 'Title',   v: this.previewTitle || '—' },
      ...(qcfg?.product  ? [{ k: 'Product',  v: qcfg.product }] : []),
      ...(qcfg?.entities?.length
        ? [{ k: 'Entities', v: (qcfg.entities as string[]).join(' → ') }]
        : []),
    ];
  }

  get previewH(): number {
    if (!this.selectedType) return 180;
    if (this.viewportWidth <= 720) {
      if ([WidgetType.Bar, WidgetType.Line, WidgetType.Pie].includes(this.selectedType)) return 170;
      if (this.selectedType === WidgetType.Table) return 150;
      return 132;
    }
    if (this.viewportWidth <= 1100) {
      if ([WidgetType.Bar, WidgetType.Line, WidgetType.Pie].includes(this.selectedType)) return 200;
      if (this.selectedType === WidgetType.Table) return 180;
      return 150;
    }
    if ([WidgetType.Bar, WidgetType.Line, WidgetType.Pie].includes(this.selectedType)) return 240;
    if (this.selectedType === WidgetType.Table) return 220;
    return 180;
  }

  get previewWidget(): Widget | null {
    if (!this.selectedType || !this.cfg) return null;
    const base = FACTORIES[this.selectedType]?.(0, 0);
    if (!base) return null;
    return {
      ...base,
      title: this.previewTitle || base.title,
      config: this.cfg ?? base.config,
    };
  }

  get settingsRows(): { k: string; v: string; isColor?: boolean }[] {
    if (!this.selectedType) return [];
    const cfg = this.cfg as any;
    const qcfg = this.queryCfg as any;
    return [
      { k: 'Type',  v: this.cat?.label ?? '' },
      { k: 'Title', v: this.previewTitle || 'â€”' },
      ...(qcfg?.product ? [{ k: 'Product', v: qcfg.product }] : []),
      ...(qcfg?.entities?.length
        ? [{ k: 'Entities', v: (qcfg.entities as string[]).join(' â†’ ') }]
        : []),
      ...(cfg?.accent ? [{ k: 'Accent', v: cfg.accent, isColor: true }] : []),
      ...(this.selectedType === WidgetType.Table && cfg?.columns
        ? [{ k: 'Columns', v: `${cfg.columns.length} cols` }] : []),
      ...(this.selectedType === WidgetType.Progress && cfg?.items
        ? [{ k: 'Items', v: `${cfg.items.length} bars` }] : []),
      ...(this.selectedType === WidgetType.Pie && cfg?.data
        ? [{ k: 'Segments', v: `${cfg.data.length}` }] : []),
      ...((this.selectedType === WidgetType.Bar || this.selectedType === WidgetType.Line) && cfg?.series
        ? [{ k: 'Series', v: `${cfg.series.length}` }] : []),
    ];
  }

  // Config panel type casts for template binding
  get cfgAsStat()      { return this.cfg as any; }
  get cfgAsAnalytics() { return this.cfg as any; }
  get cfgAsSeries()    { return this.cfg as any; }
  get cfgAsPie()       { return this.cfg as any; }
  get cfgAsTable()     { return this.cfg as any; }
  get cfgAsProgress()  { return this.cfg as any; }
  get cfgAsNote()      { return this.cfg as any; }
  get cfgAsSection()   { return this.cfg as any; }
}
