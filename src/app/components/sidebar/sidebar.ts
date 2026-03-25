
// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Sidebar Component  (Step 20)
//
//  Layout (top → bottom, flex column, 210px wide):
//  ├── "Widget Palette" section label
//  ├── Search input  (filterCatalog — does NOT affect Ctrl+1–9)
//  ├── Filtered widget type buttons  (click → openWizard with type)
//  ├── Empty-search state
//  ├── Divider
//  ├── Keyboard Shortcuts list  (display only)
//  ├── Divider
//  ├── Grid Info panel  (cols, rowH, colW, zoom, widgets, locked)
//  ├── flex spacer
//  ├── Minimap toggle  (on/off)
//  ├── Browse Templates button
//  └── Load Demo button
//
//  Edge cases:
//  ├── C18: sidebar search filter does NOT affect Ctrl+1–9.
//  │         filterCatalog() only applies to the visual palette.
//  │         Keyboard handler (Step 22) always reads full CATALOG.
//  └── sidebarSearch is a service signal so it survives
//        component destruction (wizard re-open keeps the filter).
// ═══════════════════════════════════════════════════════════════

import {
  Component,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { filterCatalog } from '../../core/catalog';
import { COLS, KEYBOARD_SHORTCUTS, ROW_H } from '../../core/constants';
import { WidgetType } from '../../core/interfaces';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  readonly svc = inject(DashboardService);

  // Expose constants to template
  readonly COLS = COLS;
  readonly ROW_H = ROW_H;
  readonly KEYBOARD_SHORTCUTS = KEYBOARD_SHORTCUTS;

  /** Palette items driven by the sidebar search signal */
  get filteredCatalog() {
    return filterCatalog(this.svc.sidebarSearch());
  }

  get hasNoResults(): boolean {
    return !!this.svc.sidebarSearch() && this.filteredCatalog.length === 0;
  }

  get colWRounded(): string {
    return Math.round(this.svc.colW()).toString();
  }

  onSearchChange(value: string): void {
    this.svc.setSidebarSearch(value);
  }

  clearSearch(): void {
    this.svc.clearSidebarSearch();
  }

  openWizard(type: string): void {
    this.svc.openWizard(type as any);
  }

  onPaletteItemDragStart(e: DragEvent, type: WidgetType): void {
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', type);
  }

}
