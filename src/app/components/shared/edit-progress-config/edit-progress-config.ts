import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressColorRule, ProgressConfig, ProgressItem } from '../../../core/interfaces';
import { CHART_COLORS } from '../../../core/constants';


@Component({
  selector: 'app-edit-progress-config',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-progress-config.html',
  styleUrl: '../config-panels/config-panels.scss',
})
export class EditProgressConfig {
  @Input({ required: true }) cfg!: ProgressConfig;
  @Output() cfgChange = new EventEmitter<ProgressConfig>();
 
  upd(key: keyof ProgressConfig, value: any): void {
    this.cfgChange.emit({ ...this.cfg, [key]: value });
  }
 
  get items(): ProgressItem[] { return this.cfg.items ?? []; }
 
  addItem(): void {
    this.upd('items', [
      ...this.items,
      { label: 'New Metric', value: 50, max: 100, color: CHART_COLORS[this.items.length % CHART_COLORS.length] },
    ]);
  }
 
  removeItem(i: number): void {
    this.upd('items', this.items.filter((_, ii) => ii !== i));
  }
 
  updateItem(i: number, key: keyof ProgressItem, value: any): void {
    this.upd('items', this.items.map((item, ii) => ii === i ? { ...item, [key]: value } : item));
  }

  // ── E6: Global color rule helpers ─────────────────────────────

  get colorRules(): ProgressColorRule[] {
    return this.cfg.colorRules ?? [];
  }

  addColorRule(): void {
    this.upd('colorRules', [
      ...this.colorRules,
      { minPercent: 0, color: '#ef4444' } satisfies ProgressColorRule,
    ]);
  }

  removeColorRule(i: number): void {
    this.upd('colorRules', this.colorRules.filter((_, ri) => ri !== i));
  }

  updateColorRule(i: number, key: keyof ProgressColorRule, value: any): void {
    this.upd('colorRules', this.colorRules.map((r, ri) =>
      ri === i ? { ...r, [key]: value } : r
    ));
  }
}
