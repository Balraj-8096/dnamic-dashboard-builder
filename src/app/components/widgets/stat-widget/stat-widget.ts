// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Stat Widget Component
//  Single KPI tile with trend indicator and sparkline
//
//  Two render modes:
//  ├── Single field mode — large value, trend, sparkline
//  └── Multi field mode  — 2-3 column grid of mini KPI tiles
//      activated when selectedFields.length > 1
//
//  Direct port from React StatContent component
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
import { ColorThreshold, StatConfig, Widget } from '../../../core/interfaces';
import { DATA_SCHEMA } from '../../../core/data-schema';
import { QueryService } from '../../../services/query.service';
import { mapStatResult, StatDisplayData } from '../../../core/query-result-mapper';
import { WidgetDatePickerComponent, DatePickerChange } from '../../shared/widget-date-picker/widget-date-picker';
import { FilterCondition } from '../../../core/query-types';


@Component({
  selector: 'app-stat-widget',
  imports: [CommonModule, WidgetDatePickerComponent],
  templateUrl: './stat-widget.html',
  styleUrl: './stat-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatWidget implements OnChanges {

  @Input({ required: true }) widget!: Widget;
  @Input() contentH: number = 120;

  private readonly qsvc = inject(QueryService);
  private readonly cdr  = inject(ChangeDetectorRef);

  constructor() {
    effect(() => {
      this.qsvc.globalFilters();
      untracked(() => { if (this.widget) { this.refresh(); this.cdr.markForCheck(); } });
    });
  }

  // ── Display state (query result OR static config) ────────────
  displayValue     = '';
  displayTrend     = '';
  displayTrendUp   = true;
  displaySparkData: number[] = [];
  displayPeriod    = '';
  /** E1: raw numeric value used for threshold evaluation */
  private rawValue   = 0;
  /** E1: resolved accent after threshold evaluation — used in template instead of cfg.accent */
  resolvedAccent   = '';

  // ── Per-widget date filter ────────────────────────────────────
  localDatePreset = '';
  private localDateFilter: FilterCondition | null = null;

  onDateChange(e: DatePickerChange): void {
    this.localDateFilter = e.filter;
    this.localDatePreset  = e.preset;
    this.refresh();
    this.cdr.markForCheck();
  }

  // ── Config accessor ──────────────────────────────────────────
  get cfg(): StatConfig {
    return this.widget.config as StatConfig;
  }

  ngOnChanges(): void { this.refresh(); }

  private refresh(): void {
    const qcfg = this.cfg?.queryConfig;
    if (qcfg) {
      try {
        const effectiveQcfg = this.localDateFilter
          ? { ...qcfg, filters: [...(qcfg.filters ?? []), this.localDateFilter] }
          : qcfg;
        const result = this.qsvc.executeStatQuery(effectiveQcfg);
        const mapped: StatDisplayData = mapStatResult(result, qcfg.periodLabel);
        this.displayValue     = mapped.value;
        this.displayTrend     = mapped.trend;
        this.displayTrendUp   = mapped.trendUp;
        this.displaySparkData = mapped.sparkData;
        this.displayPeriod    = mapped.periodLabel;
        // E1: use raw numeric result for accurate threshold evaluation
        this.rawValue = result.value ?? 0;
      } catch {
        this.displayValue = 'Error';
        this.displayTrend = '';
        this.rawValue = 0;
      }
    } else {
      this.displayValue     = this.cfg?.value       ?? '';
      this.displayTrend     = this.cfg?.trend        ?? '';
      this.displayTrendUp   = this.cfg?.trendUp      ?? true;
      this.displaySparkData = this.cfg?.sparkData    ?? [];
      // E1: parse static value string for threshold evaluation
      this.rawValue = parseFloat((this.cfg?.value ?? '').replace(/[^0-9.-]/g, '')) || 0;
    }
    // E1: resolve accent after value is known — falls back to cfg.accent when no thresholds set
    this.resolvedAccent = this.evalThresholds(this.rawValue);
  }

  // ── E1: threshold evaluator ───────────────────────────────────
  /**
   * Walks thresholds descending — highest matching threshold wins.
   * Returns cfg.accent unchanged when colorThresholds is absent or empty,
   * so all existing widgets with no thresholds are completely unaffected.
   */
  private evalThresholds(val: number): string {
    const rules = this.cfg?.colorThresholds;
    if (!rules?.length) return this.cfg?.accent ?? '';
    const matched = [...rules]
      .sort((a: ColorThreshold, b: ColorThreshold) => b.threshold - a.threshold)
      .find((r: ColorThreshold) => val >= r.threshold);
    return matched?.color ?? this.cfg?.accent ?? '';
  }

  // ── Multi-field mode ─────────────────────────────────────────

  /**
   * Selected KPI fields from DATA_SCHEMA.
   * Populated when user selects fields in wizard or edit modal.
   * null = single field mode (use cfg.value directly)
   */
  get selectedFields() {
    const ids = this.cfg.selectedFields;
    if (!ids?.length) return null;
    return ids
      .map(id => DATA_SCHEMA.kpi.find(f => f.id === id))
      .filter(Boolean) as typeof DATA_SCHEMA.kpi;
  }

  /**
   * Whether to render in multi-field grid mode.
   * True when 2+ fields selected.
   */
  get isMultiField(): boolean {
    const f = this.selectedFields;
    return f !== null && f.length > 1;
  }

  /**
   * Column count for multi-field grid.
   * 1-2 fields = 2 cols, 3-4 fields = 2 cols, 5+ = 3 cols
   */
  get multiCols(): number {
    const count = this.selectedFields?.length ?? 0;
    if (count <= 2) return 2;
    if (count <= 4) return 2;
    return 3;
  }

  // ── Sparkline helpers ────────────────────────────────────────

  /**
   * Generate sparkline bar heights as percentages.
   * Each bar height = (value / max) * 100%
   * Last bar is full opacity, others at 35% (matches React)
   */
  getSparkBars(data: number[]): {
    height: string;
    opacity: number;
  }[] {
    if (!data?.length) return [];
    const max = Math.max(...data, 1);
    return data.map((v, i) => ({
      height: `${(v / max) * 100}%`,
      opacity: i === data.length - 1 ? 1 : 0.35,
    }));
  }

  /**
   * Generate SVG path for mini area chart.
   * Used in single-field sparkline.
   */
  getSparklinePath(data: number[]): {
    linePath: string;
    fillPath: string;
  } {
    if (!data?.length) return { linePath: '', fillPath: '' };

    const h = 32;
    const w = 100;
    const max = Math.max(...data, 1);
    const min = Math.min(...data);

    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h * 0.85) - 4;
      return `${x},${y}`;
    });

    const linePath = `M${pts.join(' L')}`;
    const fillPath = `${linePath} L${w},${h} L0,${h} Z`;

    return { linePath, fillPath };
  }

  /**
   * Gradient ID for sparkline — unique per widget.
   * Prevents gradient conflicts when multiple stat widgets shown.
   */
  get gradientId(): string {
    const color = (this.cfg.accent || '#3b82f6').replace('#', '');
    return `sg_${color}_${this.widget.id}`;
  }
}
