
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  inject,
  effect,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  fromEvent,
  Subject,
  takeUntil,
} from 'rxjs';

import { DashboardService } from '../../services/dashboard.service';
import { AlignmentGuide, Widget, WidgetType } from '../../core/interfaces';
import { gridToPixel, nudgeWidget } from '../../core/layout.utils';
import { COLS, GAP, KB_BLOCKED_TAGS, ZOOM_MAX, ZOOM_MIN, clamp } from '../../core/constants';
import { WidgetCard } from "../widget-card/widget-card";
import { Sidebar } from "../sidebar/sidebar";
import { getCatalogByIndex } from '../../core/catalog';
import { createWidget } from '../../core/factories';
import { Toolbar } from "../toolbar/toolbar";
import { MatDialog } from '@angular/material/dialog';
import { AddWidgetWizard, WizardDialogData } from '../modals/add-widget-wizard/add-widget-wizard';
import { EditModal } from '../modals/edit-modal/edit-modal';
import { TemplatesModal } from '../modals/templates-modal/templates-modal';
import { ImportModal } from '../modals/import-modal/import-modal';
import { HelpModal } from '../modals/help-modal/help-modal';
import { Minimap } from "../minimap/minimap";
import { ContextMenu } from "../modals/context-menu/context-menu";
import { GlobalFilterBarComponent } from "../shared/global-filter-bar/global-filter-bar";
import { HistoryPanel } from "../history-panel/history-panel";

@Component({
  selector: 'app-canvas',
  imports: [CommonModule, WidgetCard, Sidebar, Toolbar, Minimap, ContextMenu, GlobalFilterBarComponent, HistoryPanel],
  templateUrl: './canvas.html',
  styleUrl: './canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Canvas implements OnInit, OnDestroy {
  readonly svc = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  @ViewChild('mainRef', { static: true }) mainRef!: ElementRef<HTMLElement>;
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLElement>;

  readonly COLS = COLS;
  readonly colIndices = Array.from({ length: COLS }, (_, i) => i);
  readonly compactBreakpoint = 1024;

  // Step 32: destroy$ drives all RxJS subscription cleanup
  private readonly destroy$ = new Subject<void>();
  private resizeObserver?: ResizeObserver;
  // Step 32: stored reference so removeEventListener gets the same function
  private onWheel!: (e: WheelEvent) => void;

  constructor() {
    // ── Add Widget Wizard ──────────────────────────────────────
    // Single open point for sidebar / toolbar / Ctrl+1-9
    effect(() => {
      if (!this.svc.wizardOpen()) return;
      const ref = this.dialog.open<AddWidgetWizard, WizardDialogData>(
        AddWidgetWizard,
        {
          width: 'min(1120px, calc(100vw - 16px))',
          maxWidth: '100vw',
          height: 'min(92dvh, 920px)',
          panelClass: ['dashboard-modal-pane', 'dashboard-modal-pane--wizard'],
          autoFocus: false,
          restoreFocus: false,
          data: { initType: this.svc.wizardInitType() },
        }
      );
      ref.afterClosed().subscribe(() => this.svc.closeWizard());
    });

    // ── Edit Modal ─────────────────────────────────────────────
    effect(() => {
      const widget = this.svc.editingWidget();
      if (!widget) return;
      const ref = this.dialog.open(EditModal, {
        width: 'min(1180px, calc(100vw - 16px))',
        maxWidth: '100vw',
        height: 'min(92dvh, 940px)',
        panelClass: ['dashboard-modal-pane', 'dashboard-modal-pane--edit'],
        autoFocus: false,
        restoreFocus: false,
        data: widget,
      });
      ref.afterClosed().subscribe(() => this.svc.closeEditModal());
    });

    // ── Templates Modal ────────────────────────────────────────
    effect(() => {
      if (!this.svc.showTemplates()) return;
      const ref = this.dialog.open(TemplatesModal, { width: '75%' });
      ref.afterClosed().subscribe(() => this.svc.closeTemplates());
    });

    // ── Import Modal ───────────────────────────────────────────
    effect(() => {
      if (!this.svc.showImport()) return;
      const ref = this.dialog.open(ImportModal, { width: '75%' });
      ref.afterClosed().subscribe(() => this.svc.closeImport());
    });

    // ── Help Modal ─────────────────────────────────────────────
    effect(() => {
      if (!this.svc.showHelp()) return;
      const ref = this.dialog.open(HelpModal, { width: '75%' });
      ref.afterClosed().subscribe(() => this.svc.closeHelp());
    });

    // ── C21: auto-scroll to newly added widget ─────────────────
    // pendingScrollId cleared on first match — fires once (C21)
    effect(() => {
      const widgets = this.svc.widgets();
      const pendingId = this.svc.pendingScrollId;
      if (!pendingId) return;
      const found = widgets.find(w => w.id === pendingId);
      if (found) {
        this.svc.pendingScrollId = null;
        requestAnimationFrame(() => {
          // Scroll to the widget's actual pixel position (not always bottom)
          const pixelTop = gridToPixel(found, this.svc.colW(), this.svc.rowH()).top;
          const scrollTarget = Math.max(0, pixelTop - 80); // 80px above widget
          this.mainRef?.nativeElement.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        });
      }
    });
  }

  ngOnInit(): void {
    const main = this.mainRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    this.syncResponsiveUi();
    this.svc.setViewportH(main.clientHeight);

    // Step 32: ResizeObserver with rAF delay (bug fix #14)
    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        this.svc.setCanvasW(canvas.offsetWidth);
        this.svc.setViewportH(main.clientHeight);
        this.syncResponsiveUi();
      });
    });
    this.resizeObserver.observe(canvas);

    // Step 32: scroll uses fromEvent + takeUntil(destroy$)
    fromEvent(main, 'scroll')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.svc.setScrollTop(main.scrollTop));

    // Step 32: wheel stored as named reference for cleanup; passive:false for preventDefault
    this.onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.svc.setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.svc.zoom() + delta)));
    };
    main.addEventListener('wheel', this.onWheel, { passive: false });
  }

  ngOnDestroy(): void {
    // Step 32: complete destroy$ — kills all takeUntil subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    this.resizeObserver?.disconnect();
    // Step 32: remove wheel listener by stored reference
    this.mainRef?.nativeElement.removeEventListener('wheel', this.onWheel);
  }

  // ── Keyboard shortcuts (Step 22) ──────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    // C24: block when typing in form fields
    if (KB_BLOCKED_TAGS.has((e.target as HTMLElement).tagName)) return;
    const ctrl = e.ctrlKey || e.metaKey;

    // Ctrl+Z — undo
    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.svc.undo(); return; }
    // Ctrl+Y / Ctrl+Shift+Z — redo
    if (ctrl && (e.key === 'y' || (e.key === 'Z' && e.shiftKey))) { e.preventDefault(); this.svc.redo(); return; }
    // Ctrl+C — copy selected widget to clipboard
    if (ctrl && e.key === 'c') {
      const w = this.svc.selectedWidget();
      if (w) { e.preventDefault(); this.svc.copyWidget(w); }
      return;
    }
    // Ctrl+V — paste clipboard widget onto canvas
    if (ctrl && e.key === 'v') {
      if (this.svc.clipboard()) { e.preventDefault(); this.svc.pasteWidget(); }
      return;
    }
    // Ctrl+D — duplicate (A3: svc.duplicateWidget always scrolls+selects)
    if (ctrl && e.key === 'd') {
      const w = this.svc.selectedWidget();
      if (w) { e.preventDefault(); this.svc.duplicateWidget(w); }
      return;
    }
    // Del/Backspace — delete (A2: deleteWidget clears all stale IDs)
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.svc.selectedId()) {
      e.preventDefault();
      this.svc.deleteWidget(this.svc.selectedId()!);
      return;
    }
    // Escape — close all modals + deselect
    if (e.key === 'Escape') { this.svc.closeAllModals(); return; }
    // Ctrl+1-9 — open wizard (C18: getCatalogByIndex, ignores sidebarSearch)
    if (ctrl && e.key >= '1' && e.key <= '9') {
      const cat = getCatalogByIndex(parseInt(e.key, 10) - 1);
      if (cat) { e.preventDefault(); this.svc.openWizard(cat.type); }
      return;
    }
    // L/l — lock toggle (bug fix #9: case-insensitive)
    if ((e.key === 'l' || e.key === 'L') && this.svc.selectedId()) {
      this.svc.lockWidget(this.svc.selectedId()!);
      return;
    }
    // Arrow nudge (C17: nudgeWidget — no push, silent block on collision)
    const dirMap: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const dir = dirMap[e.key];
    if (dir && this.svc.selectedId()) {
      e.preventDefault();
      const w = this.svc.selectedWidget();
      if (w) this.svc.widgets.set(nudgeWidget(w, dir[0], dir[1], this.svc.widgets()));
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.svc.setViewportH(this.mainRef.nativeElement.clientHeight);
    this.syncResponsiveUi();
  }

  onCanvasClick(): void {
    this.svc.select(null);
    this.svc.closeContextMenu();
    this.svc.closeToolbarMenu();
  }

  closeCompactChrome(): void {
    this.svc.closeSidebar();
    this.svc.closeToolbarMenu();
  }

  openAddWidgetWizard(): void {
    this.svc.openWizard(null);
  }

  openTemplates(): void {
    this.svc.openTemplates();
  }

  loadDemo(): void {
    this.svc.loadDemo();
  }

  openSelectedWidgetEditor(): void {
    const widget = this.svc.selectedWidget();
    if (!widget) return;
    this.svc.openEditModal(widget);
  }

  duplicateSelectedWidget(): void {
    const widget = this.svc.selectedWidget();
    if (!widget) return;
    this.svc.duplicateWidget(widget);
  }

  toggleSelectedWidgetLock(): void {
    const widget = this.svc.selectedWidget();
    if (!widget) return;
    this.svc.lockWidget(widget.id);
  }

  deleteSelectedWidget(): void {
    const widget = this.svc.selectedWidget();
    if (!widget) return;
    this.svc.deleteWidget(widget.id);
  }

  trackWidget(_: number, widget: { id: string }): string { return widget.id; }

  get zoomStyle(): Record<string, string> {
    const z = this.svc.zoom();
    return {
      transform: `scale(${z})`,
      transformOrigin: 'top left',
      width: `${100 / z}%`,
      minHeight: `${100 / z}%`,
    };
  }

  alignmentGuideStyle(guide: AlignmentGuide): Record<string, string> {
    if (guide.axis === 'x') {
      return {
        left: `${guide.pos}px`,
        top: `${guide.start}px`,
        height: `${Math.max(guide.end - guide.start, 1)}px`,
      };
    }

    return {
      left: `${guide.start}px`,
      top: `${guide.pos}px`,
      width: `${Math.max(guide.end - guide.start, 1)}px`,
    };
  }

  // ── Drag-from-sidebar drop zone ────────────────────────────────
  isDragOver = false;

  onCanvasDragOver(e: DragEvent): void {
    if (!e.dataTransfer?.types.includes('text/plain')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.isDragOver = true;
  }

  onCanvasDragLeave(e: DragEvent): void {
    // Only clear when leaving the canvas itself, not a child element
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      this.isDragOver = false;
    }
  }

  onCanvasDrop(e: DragEvent): void {
    this.isDragOver = false;
    const type = e.dataTransfer?.getData('text/plain') as WidgetType | undefined;
    if (!type) return;
    e.preventDefault();

    const canvasEl = this.canvasRef.nativeElement;
    const rect = canvasEl.getBoundingClientRect();
    const zoom = this.svc.zoom();
    const colW = this.svc.colW();

    const relX = (e.clientX - rect.left) / zoom;
    const relY = (e.clientY - rect.top)  / zoom;

    const gridX = clamp(Math.floor(relX / (colW + GAP)), 0, COLS - 1);
    const gridY = Math.max(0, Math.floor(relY / (this.svc.rowH() + GAP)));

    const draft = createWidget(type, gridX, gridY);
    if (!draft) return;

    const placed = this.svc.addWidgetAt(draft);
    this.svc.openEditModal(placed);
  }

  private syncResponsiveUi(): void {
    this.svc.setCompactViewport(window.innerWidth <= this.compactBreakpoint);
  }
}
