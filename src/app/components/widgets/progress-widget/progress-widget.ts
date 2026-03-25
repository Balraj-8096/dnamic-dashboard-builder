
// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Progress Bars Widget
//  Multi-metric progress display with glow effects
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
import { ProgressColorRule, ProgressConfig, ProgressItem, Widget } from '../../../core/interfaces';
import { QueryService } from '../../../services/query.service';
import { mapProgressResults } from '../../../core/query-result-mapper';

@Component({
  selector: 'app-progress-widget',
  imports: [CommonModule],
  templateUrl: './progress-widget.html',
  styleUrl: './progress-widget.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressWidget implements OnChanges {

  @Input({ required: true }) widget!: Widget;
  @Input() contentH: number = 200;

  private readonly qsvc = inject(QueryService);
  private readonly cdr  = inject(ChangeDetectorRef);
  private _displayItems: ProgressItem[] | null = null;

  constructor() {
    effect(() => {
      this.qsvc.globalFilters();
      untracked(() => { if (this.widget) { this.refresh(); this.cdr.markForCheck(); } });
    });
  }

  get cfg(): ProgressConfig {
    return this.widget.config as ProgressConfig;
  }

  get items(): ProgressItem[] {
    return this._displayItems ?? this.cfg?.items ?? [];
  }

  ngOnChanges(): void { this.refresh(); }

  private refresh(): void {
    const queries = this.cfg?.progressQueries;
    const baseItems = this.cfg?.items ?? [];
    if (queries?.length && baseItems.length) {
      try {
        const results = queries.map(q => this.qsvc.executeStatQuery(q));
        this._displayItems = mapProgressResults(results, baseItems);
      } catch {
        this._displayItems = null;
      }
    } else {
      this._displayItems = null;
    }
  }

  getPercent(item: ProgressItem): number {
    return Math.min(100, Math.round((item.value / item.max) * 100));
  }

  // ── E6: color rule resolver ───────────────────────────────────
  /**
   * Returns the bar fill color after evaluating global color rules.
   * Rules are sorted descending by minPercent — highest matching rule wins.
   * Falls back to item.color (existing behaviour) when:
   *   - cfg.colorRules is absent or empty (all existing widgets)
   *   - no rule matches the current percentage
   */
  resolveItemColor(item: ProgressItem): string {
    const rules = this.cfg?.colorRules;
    if (!rules?.length) return item.color;
    const pct = this.getPercent(item);
    const matched = [...rules]
      .sort((a: ProgressColorRule, b: ProgressColorRule) => b.minPercent - a.minPercent)
      .find((r: ProgressColorRule) => pct >= r.minPercent);
    return matched?.color ?? item.color;
  }
}