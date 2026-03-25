import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BarConfig, LineConfig, NumberFormatProfile, ReferenceLine } from '../../../core/interfaces';
import { CHART_COLORS } from '../../../core/constants';

type SeriesConfig = BarConfig | LineConfig;

@Component({
  selector: 'app-edit-series-config',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-series-config.html',
  styleUrl: '../config-panels/config-panels.scss',
})
export class EditSeriesConfig {
  @Input({ required: true }) cfg!: SeriesConfig;
  /** 'bar' | 'line' — controls which display options appear */
  @Input({ required: true }) typeLabel!: 'bar' | 'line';
  @Output() cfgChange = new EventEmitter<SeriesConfig>();

  upd(key: string, value: any): void {
    this.cfgChange.emit({ ...this.cfg, [key]: value } as SeriesConfig);
  }

  // ── Series array helpers ──────────────────────────────────────
  get series() { return (this.cfg as any).series ?? []; }

  addSeries(): void {
    const s = this.series;
    const template = s[0]?.data ?? [{ n: 'A', v: 0 }];
    this.upd('series', [
      ...s,
      {
        key: `Series ${s.length + 1}`,
        color: CHART_COLORS[s.length % CHART_COLORS.length],
        data: template.map((d: any) => ({ n: d.n, v: 0 })),
      },
    ]);
  }

  removeSeries(i: number): void {
    this.upd('series', this.series.filter((_: any, si: number) => si !== i));
  }

  updateSeriesField(i: number, key: string, value: any): void {
    this.upd('series', this.series.map((s: any, si: number) =>
      si === i ? { ...s, [key]: value } : s
    ));
  }

  seriesDataToStr(series: any): string {
    return (series.data ?? []).map((d: any) => `${d.n}:${d.v}`).join('\n');
  }

  updateSeriesData(i: number, raw: string): void {
    const data = raw
      .split('\n')
      .map(l => { const [n, v] = l.split(':'); return { n: (n || '').trim(), v: Number.parseFloat(v) || 0 }; })
      .filter(d => d.n);
    this.updateSeriesField(i, 'data', data);
  }

  chartColor(i: number, override?: string): string {
    return override || CHART_COLORS[i % CHART_COLORS.length];
  }

  // ── E2: Number format helpers ─────────────────────────────────

  /** Current format notation, falling back to 'compact' (existing default) */
  get formatNotation(): NumberFormatProfile['notation'] {
    return (this.cfg as any).numberFormat?.notation ?? 'compact';
  }

  /**
   * Updates a single key inside numberFormat.
   * When notation is 'compact', the numberFormat object is cleared entirely
   * so existing widgets with no numberFormat continue to work identically.
   */
  updateFormat(key: keyof NumberFormatProfile, value: any): void {
    if (key === 'notation' && value === 'compact') {
      // Compact is the default — store undefined so no-format widgets are unaffected
      this.upd('numberFormat', undefined);
      return;
    }
    const current: NumberFormatProfile = (this.cfg as any).numberFormat ?? { notation: 'compact' };
    this.upd('numberFormat', { ...current, [key]: value });
  }

  // ── E3: Reference line helpers ────────────────────────────────

  get refLines(): ReferenceLine[] {
    return (this.cfg as any).referenceLines ?? [];
  }

  addRefLine(): void {
    this.upd('referenceLines', [
      ...this.refLines,
      { label: 'Target', value: 0, color: '#f59e0b', dash: true } satisfies ReferenceLine,
    ]);
  }

  removeRefLine(i: number): void {
    this.upd('referenceLines', this.refLines.filter((_, ri) => ri !== i));
  }

  updateRefLine(i: number, key: keyof ReferenceLine, value: any): void {
    this.upd('referenceLines', this.refLines.map((rl, ri) =>
      ri === i ? { ...rl, [key]: value } : rl
    ));
  }

}
