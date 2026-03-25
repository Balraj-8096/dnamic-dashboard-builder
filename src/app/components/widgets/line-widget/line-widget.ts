// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Line / Area Chart Widget Component
//  Multi-series line or area chart
//  Supports: area fill, smooth curves, dot markers
//
//  Uses ng-apexcharts for rendering
//  Direct port from React LineContent component
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
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexAnnotations,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexGrid,
  ApexLegend,
  ApexTooltip,
  ApexStroke,
  ApexFill,
  ApexMarkers,
} from 'ng-apexcharts';
import { QueryService } from '../../../services/query.service';
import { mapChartResult } from '../../../core/query-result-mapper';
import { WidgetDatePickerComponent, DatePickerChange } from '../../shared/widget-date-picker/widget-date-picker';
import { FilterCondition } from '../../../core/query-types';
import { LineConfig, NumberFormatProfile, Widget } from '../../../core/interfaces';
import { CHART_COLORS } from '../../../core/constants';



export interface LineChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  legend: ApexLegend;
  tooltip: ApexTooltip;
  stroke: ApexStroke;
  fill: ApexFill;
  markers: ApexMarkers;
  colors: string[];
  /** E3: horizontal reference/target line annotations */
  annotations: ApexAnnotations;
}


@Component({
  selector: 'app-line-widget',
  imports: [CommonModule, NgApexchartsModule, WidgetDatePickerComponent],
  templateUrl: './line-widget.html',
  styleUrl: './line-widget.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineWidget implements OnChanges {

  @Input({ required: true }) widget!: Widget;
  @Input() contentH: number = 200;

  chartOptions?: LineChartOptions;

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
      this.qsvc.globalFilters();
      untracked(() => { if (this.widget) { this.buildChart(); this.cdr.markForCheck(); } });
    });
  }

  get cfg(): LineConfig {
    return this.widget.config as LineConfig;
  }

  // ── E3: annotation builder ────────────────────────────────────
  /** Same logic as bar-widget — see bar-widget.ts for full commentary. */
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
  /** Same logic as bar-widget — see bar-widget.ts for full commentary. */
  private formatVal(val: number, fmt: NumberFormatProfile | undefined, tooltipMode = false): string {
    if (!fmt) {
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

  private buildChart(): void {
    const cfg = this.cfg;

    let activeSeries     = cfg?.series ?? [];
    let activeCategories = activeSeries[0]?.data.map(d => d.n) ?? [];

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
        type: cfg.areaFill ? 'area' : 'line',
        height: this.contentH - 8,
        background: 'transparent',
        toolbar: { show: false },
        animations: {
          enabled: true,
          speed: 400,
        },
      },

      stroke: {
        curve: cfg.smooth ? 'smooth' : 'straight',
        width: 2,
      },

      fill: {
        type: cfg.areaFill ? 'gradient' : 'solid',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0.02,
          stops: [0, 100],
        },
      },

      markers: {
        size: cfg.showDots ? 4 : 0,
        strokeWidth: 0,
        hover: { size: 6 },
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

      // E3: undefined when no referenceLines defined — key omitted entirely for existing widgets
      annotations: this.buildAnnotations(),
    };
  }
}
