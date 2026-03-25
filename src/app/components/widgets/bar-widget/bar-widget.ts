// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Bar Chart Widget Component
//  Multi-series bar chart
//  Supports: vertical, horizontal, stacked modes
//
//  Uses ng-apexcharts for rendering
//  Direct port from React BarContent component
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
import { NgApexchartsModule } from 'ng-apexcharts';
import { QueryService } from '../../../services/query.service';
import { mapChartResult } from '../../../core/query-result-mapper';
import { WidgetDatePickerComponent, DatePickerChange } from '../../shared/widget-date-picker/widget-date-picker';
import { FilterCondition } from '../../../core/query-types';

import {
  ApexAxisChartSeries,
  ApexAnnotations,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexTooltip,
  ApexPlotOptions,
  ApexStroke,
  ApexFill,
} from 'ng-apexcharts';
import { BarConfig, NumberFormatProfile, Widget } from '../../../core/interfaces';
import { CHART_COLORS } from '../../../core/constants';



export interface BarChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  legend: ApexLegend;
  tooltip: ApexTooltip;
  plotOptions: ApexPlotOptions;
  stroke: ApexStroke;
  fill: ApexFill;
  colors: string[];
  /** E3: horizontal reference/target line annotations */
  annotations: ApexAnnotations;
}


@Component({
  selector: 'app-bar-widget',
  imports: [CommonModule, NgApexchartsModule, WidgetDatePickerComponent],
  templateUrl: './bar-widget.html',
  styleUrl: './bar-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarWidget implements OnChanges {

  @Input({ required: true }) widget!: Widget;
  @Input() contentH: number = 200;

  chartOptions?: BarChartOptions;

  localDatePreset = '';
  private localDateFilter: FilterCondition | null = null;

  private readonly qsvc = inject(QueryService);
  private readonly cdr  = inject(ChangeDetectorRef);

  onDateChange(e: DatePickerChange): void {
    this.localDateFilter = e.filter;
    this.localDatePreset  = e.preset;
    this.buildChart();
    this.cdr.markForCheck();
  }

  constructor() {
    effect(() => {
      this.qsvc.globalFilters(); // reactive dependency
      untracked(() => { if (this.widget) { this.buildChart(); this.cdr.markForCheck(); } });
    });
  }

  // ── Config accessor ──────────────────────────────────────────
  get cfg(): BarConfig {
    return this.widget.config as BarConfig;
  }

  // ── E2: value formatter ───────────────────────────────────────
  /**
   * Formats a numeric value for Y-axis labels and tooltips.
   * When no numberFormat is configured (existing widgets) the original
   * compact behaviour is preserved exactly:
   *   axis:    >=1000 → Xk (0 dp)   e.g. 42000 → "42k"
   *   tooltip: >=1000 → X.Xk (1 dp) e.g. 42000 → "42.0k"
   */
  // ── E3: annotation builder ────────────────────────────────────
  /**
   * Converts cfg.referenceLines into ApexAnnotations.yaxis entries.
   * Returns undefined (not an empty object) when no lines are defined
   * so the ApexCharts annotations key is omitted entirely for existing widgets.
   */
  private buildAnnotations(): ApexAnnotations {
    const lines = this.cfg.referenceLines;
    if (!lines?.length) return {};
    return {
      yaxis: lines.map(rl => ({
        y: rl.value,
        borderColor: rl.color,
        strokeDashArray: rl.dash === false ? 0 : 6,
        label: {
          text: rl.label,
          style: {
            color: rl.color,
            background: 'transparent',
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
          },
          position: 'right',
          offsetX: -8,
        },
      })),
    };
  }

  // ── E2: value formatter ───────────────────────────────────────
  private formatVal(val: number, fmt: NumberFormatProfile | undefined, tooltipMode = false): string {
    if (!fmt) {
      // Existing behaviour — untouched
      if (val >= 1_000) return `${(val / 1_000).toFixed(tooltipMode ? 1 : 0)}k`;
      return `${val}`;
    }
    const dec = fmt.decimals ?? (fmt.notation === 'fixed' || fmt.notation === 'currency' ? 2 : 0);
    switch (fmt.notation) {
      case 'currency':
        return `${fmt.currencySymbol ?? '$'}${val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
      case 'percent':
        return `${val.toFixed(dec)}%`;
      case 'fixed':
        return val.toFixed(dec);
      case 'compact':
      default:
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000)     return `${(val / 1_000).toFixed(dec)}k`;
        return `${val}`;
    }
  }

  ngOnChanges(): void {
    this.buildChart();
  }

  // ── Chart builder ────────────────────────────────────────────
  private buildChart(): void {
    const cfg = this.cfg;

    // Resolve series + categories: query result OR static config
    let activeSeries = cfg?.series ?? [];
    let activeCategories: string[] = activeSeries[0]?.data.map(d => d.n) ?? [];

    if (cfg?.queryConfig) {
      try {
        const effectiveQcfg = this.localDateFilter
          ? { ...cfg.queryConfig, filters: [...(cfg.queryConfig.filters ?? []), this.localDateFilter] }
          : cfg.queryConfig;
        const result = this.qsvc.executeChartQuery(effectiveQcfg);
        const mapped = mapChartResult(result);
        activeSeries     = mapped.series;
        activeCategories = mapped.labels;
      } catch { /* keep static */ }
    }

    const series: ApexAxisChartSeries = activeSeries.map(s => ({
      name: s.key,
      data: s.data.map(d => d.v),
    }));

    const categories = activeCategories;

    const colors = activeSeries.map(
      (s, i) => s.color || CHART_COLORS[i % CHART_COLORS.length]
    );

    this.chartOptions = {
      series,
      colors,

      chart: {
        type: cfg.horizontal ? 'bar' : 'bar',
        height: this.contentH - 8,
        background: 'transparent',
        toolbar: { show: false },
        sparkline: { enabled: false },
        animations: {
          enabled: true,
          speed: 400,
        },
      },

      plotOptions: {
        bar: {
          horizontal: cfg.horizontal,
          columnWidth: '60%',
          borderRadius: 3,
          dataLabels: { position: 'top' },
        },
      },

      stroke: {
        show: true,
        width: 2,
        colors: ['transparent'],
      },

      fill: {
        opacity: cfg.stacked ? 0.85 : 1,
      },

      dataLabels: {
        enabled: false,
      },

      grid: {
        show: cfg.showGrid,
        borderColor: '#1e2d42',
        strokeDashArray: 3,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: cfg.showGrid } },
        padding: { top: 0, right: 8, bottom: 0, left: 8 },
      },

      xaxis: {
        categories,
        labels: {
          style: {
            colors: '#526070',
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },

      yaxis: {
        labels: {
          style: {
            colors: '#526070',
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
          },
          // E2: delegates to formatVal — falls back to original compact logic when numberFormat absent
          formatter: (val: number) => this.formatVal(val, cfg.numberFormat),
        },
      },

      legend: {
        show: cfg.showLegend,
        position: 'top',
        labels: { colors: '#8fa3be' },
        fontSize: '11px',
        fontFamily: 'JetBrains Mono, monospace',
        markers: { size: 6 },
      },

      tooltip: {
        theme: 'dark',
        style: {
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
        },
        y: {
          // E2: tooltipMode=true preserves the original 1dp compact style for tooltips
          formatter: (val: number) => this.formatVal(val, cfg.numberFormat, true),
        },
      },

      // E3: undefined when no referenceLines defined — key is omitted entirely
      annotations: this.buildAnnotations(),
    };
  }
}
