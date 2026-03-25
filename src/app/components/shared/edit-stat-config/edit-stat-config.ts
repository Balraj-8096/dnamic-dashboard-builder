import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ColorThreshold, StatConfig } from '../../../core/interfaces';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-edit-stat-config',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-stat-config.html',
  styleUrl: '../config-panels/config-panels.scss',
})
export class EditStatConfig {
  @Input({ required: true }) cfg!: StatConfig;
  @Output() cfgChange = new EventEmitter<StatConfig>();

  upd(key: keyof StatConfig, value: any): void {
    this.cfgChange.emit({ ...this.cfg, [key]: value });
  }

  get sparkDataStr(): string {
    return (this.cfg.sparkData ?? []).join(',');
  }

  setSparkData(raw: string): void {
    this.upd('sparkData', raw.split(',').map(n => Number.parseFloat(n.trim()) || 0));
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
