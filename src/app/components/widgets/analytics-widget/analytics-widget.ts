// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Analytics Widget Component
//  Compact metric card with area sparkline chart
//
//  Layout:
//  ├── Top: large value + change badge
//  ├── Middle: mini SVG area chart
//  └── Bottom: period label
//
//  Direct port from React AnalyticsContent component
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
import { AnalyticsConfig, ColorThreshold, Widget } from '../../../core/interfaces';
import { QueryService } from '../../../services/query.service';
import { mapStatResult } from '../../../core/query-result-mapper';
import { WidgetDatePickerComponent, DatePickerChange } from '../../shared/widget-date-picker/widget-date-picker';
import { FilterCondition } from '../../../core/query-types';

@Component({
  selector: 'app-analytics-widget',
  imports: [CommonModule, WidgetDatePickerComponent],
  templateUrl: './analytics-widget.html',
  styleUrl: './analytics-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsWidget implements OnChanges {

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

  // ── Display state ────────────────────────────────────────────
  displayValue       = '';
  displayChangeValue = '';
  displayChangeLabel = '';
  displayTrendUp     = true;
  displayData:       number[] = [];
  displayPeriod      = '';
  /** E1: raw numeric value used for threshold evaluation */
  private rawValue     = 0;
  /** E1: resolved accent after threshold evaluation */
  private resolvedAccent = '';

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
  get cfg(): AnalyticsConfig {
    return this.widget.config as AnalyticsConfig;
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
        const mapped = mapStatResult(result, qcfg.periodLabel);
        this.displayValue       = mapped.value;
        this.displayChangeValue = mapped.trend;
        this.displayChangeLabel = mapped.changeLabel;
        this.displayTrendUp     = mapped.trendUp;
        this.displayData        = mapped.sparkData;
        this.displayPeriod      = mapped.periodLabel;
        // E1: use raw numeric result for accurate threshold evaluation
        this.rawValue = result.value ?? 0;
      } catch {
        this.displayValue = 'Error';
        this.rawValue = 0;
      }
    } else {
      this.displayValue       = this.cfg?.value       ?? '';
      this.displayChangeValue = this.cfg?.changeValue ?? '';
      this.displayChangeLabel = this.cfg?.changeLabel ?? '';
      this.displayTrendUp     = this.cfg?.trendUp     ?? true;
      this.displayData        = this.cfg?.data        ?? [];
      this.displayPeriod      = this.cfg?.period      ?? '';
      // E1: parse static value string for threshold evaluation
      this.rawValue = parseFloat((this.cfg?.value ?? '').replace(/[^0-9.-]/g, '')) || 0;
    }
    // E1: resolve accent after value is known
    this.resolvedAccent = this.evalThresholds(this.rawValue);
  }

  // ── E1: threshold evaluator ───────────────────────────────────
  /**
   * Same logic as stat-widget — see stat-widget.ts for full commentary.
   * Returns cfg.accent unchanged when colorThresholds is absent or empty.
   */
  private evalThresholds(val: number): string {
    const rules = this.cfg?.colorThresholds;
    if (!rules?.length) return this.cfg?.accent ?? '';
    const matched = [...rules]
      .sort((a: ColorThreshold, b: ColorThreshold) => b.threshold - a.threshold)
      .find((r: ColorThreshold) => val >= r.threshold);
    return matched?.color ?? this.cfg?.accent ?? '';
  }

  // ── SVG area chart ───────────────────────────────────────────

  /**
   * SVG viewport dimensions
   */
  readonly svgW = 100;
  readonly svgH = 48;

  /**
   * Generate SVG path data for area chart line and fill.
   * Normalizes data to fit within SVG viewport.
   * Direct port from React MiniArea component.
   */
  getAreaPaths(data: number[]): {
    linePath: string;
    fillPath: string;
  } {
    if (!data?.length || data.length < 2) {
      return { linePath: '', fillPath: '' };
    }

    const h = this.svgH;
    const w = this.svgW;
    const max = Math.max(...data, 1);
    const min = Math.min(...data);

    // Map data points to SVG coordinates
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1))
        * (h * 0.85) - 4;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const linePath = `M${pts.join(' L')}`;
    const fillPath = `${linePath} L${w},${h} L0,${h} Z`;

    return { linePath, fillPath };
  }

  /**
   * Gradient ID — unique per widget to prevent SVG conflicts.
   * E1: uses resolvedAccent so gradient colour matches the threshold colour.
   */
  get gradientId(): string {
    const color = (this.resolvedAccent || this.cfg?.accent || '#22c55e').replace('#', '');
    return `ag_${color}_${this.widget.id}`;
  }

  /**
   * Accent color with fallback.
   * E1: returns resolvedAccent (post-threshold evaluation) instead of raw cfg.accent.
   * Falls back to cfg.accent when resolvedAccent is empty (before first refresh).
   */
  get accent(): string {
    return this.resolvedAccent || this.cfg?.accent || '#22c55e';
  }
}
