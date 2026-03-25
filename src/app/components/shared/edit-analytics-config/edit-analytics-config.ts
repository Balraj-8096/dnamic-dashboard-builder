import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AnalyticsConfig, ColorThreshold } from '../../../core/interfaces';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-analytics-config',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-analytics-config.html',
  styleUrl: '../config-panels/config-panels.scss',
})
export class EditAnalyticsConfig {
  @Input({ required: true }) cfg!: AnalyticsConfig;
  @Output() cfgChange = new EventEmitter<AnalyticsConfig>();

  upd(key: keyof AnalyticsConfig, value: any): void {
    this.cfgChange.emit({ ...this.cfg, [key]: value });
  }

  get dataStr(): string {
    return (this.cfg.data ?? []).join(',');
  }

  setData(raw: string): void {
    this.upd('data', raw.split(',').map(n => Number.parseFloat(n.trim()) || 0));
  }

  // ── E1: Color threshold helpers ───────────────────────────────

  get thresholds(): ColorThreshold[] {
    return this.cfg.colorThresholds ?? [];
  }

  addThreshold(): void {
    this.upd('colorThresholds', [
      ...this.thresholds,
      { threshold: 0, color: '#22c55e' } satisfies ColorThreshold,
    ]);
  }

  removeThreshold(i: number): void {
    this.upd('colorThresholds', this.thresholds.filter((_, ti) => ti !== i));
  }

  updateThreshold(i: number, key: keyof ColorThreshold, value: any): void {
    this.upd('colorThresholds', this.thresholds.map((t, ti) =>
      ti === i ? { ...t, [key]: value } : t
    ));
  }
}
