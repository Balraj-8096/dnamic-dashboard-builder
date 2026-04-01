
import {
  Injectable,
  signal,
  computed,
  effect,
} from '@angular/core';

import {
  Widget,
  WidgetType,
  WidgetConfig,
  ContextMenuState,
  HistorySnapshot,
  DashboardExport,
  AlignmentGuide,
} from '../core/interfaces';

import {
  COLS,
  DEFAULT_ROW_H,
  ALLOWED_ROW_HEIGHTS,
  GAP,
  MIN_CANVAS_W,
  SIDEBAR_W,
  SAVE_ANIMATION_MS,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  MAX_HISTORY_ENTRIES,
  initialCanvasW,
  deepClone,
  clamp,
  uid,
  toFilename,
} from '../core/constants';
import { computeCanvasH, computeColW, findAdjacentPlacement, findFirstFreeSlot, getNextY, packLayout } from '../core/layout.utils';
import { buildSalesDemo, TEMPLATES } from '../core/Templates';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  // ─────────────────────────────────────────────────────────────
  //  CORE WIDGET STATE
  // ─────────────────────────────────────────────────────────────

  /**
   * Master widget array — every widget on the canvas.
   * This is the single most-read signal in the app.
   * Every drag, resize, add, delete updates this.
   */
  readonly widgets = signal<Widget[]>([]);

  /**
   * Dashboard title — shown in toolbar and used as export filename.
   * Default matches React source.
   */
  readonly dashTitle = signal<string>('My Dashboard');

  /** Infers the active product slug from the first widget that has a queryConfig. */
  readonly activeProduct = computed<string | null>(() => {
    for (const w of this.widgets()) {
      const p = (w.config as unknown as Record<string, unknown>)?.['queryConfig'] as Record<string, unknown> | undefined;
      if (p?.['product']) return p['product'] as string;
    }
    return null;
  });

  /**
   * Title edit mode — toolbar title becomes an input field.
   */
  readonly editingTitle = signal<boolean>(false);


  // ─────────────────────────────────────────────────────────────
  //  SELECTION & INTERACTION STATE
  // ─────────────────────────────────────────────────────────────

  /**
   * ID of the currently selected widget.
   * Selected widget shows blue border + action buttons.
   * null = nothing selected.
   *
   * Cleared by:
   * - Clicking canvas background
   * - Esc key
   * - Del key (after delete — edge case C8 from audit)
   *
   * NOT cleared by:
   * - Button/context-menu delete (intentional — edge case C8)
   * - We FIX this in Angular (A2 from audit) — always clear on delete
   */
  readonly selectedId = signal<string | null>(null);

  /**
   * ID of the widget currently being dragged or resized.
   * Active widget shows blue dashed border + elevated z-index.
   * null = no active drag/resize.
   */
  readonly activeId = signal<string | null>(null);

  /**
   * ID of the widget currently flashing green after save.
   * Cleared automatically after SAVE_ANIMATION_MS (700ms).
   * null = no animation running.
   */
  readonly animatingId = signal<string | null>(null);

  /**
   * Clipboard — holds the last copied widget (deep clone).
   * null = nothing copied yet.
   * Persists across multiple pastes (paste is non-destructive).
   */
  readonly clipboard = signal<Widget | null>(null);


  // ─────────────────────────────────────────────────────────────
  //  CANVAS STATE
  // ─────────────────────────────────────────────────────────────

  /**
   * Canvas container width in pixels.
   * Updated by ResizeObserver in canvas component.
   * Initial value accounts for sidebar width and SSR safety.
   * Edge case M8/A5 from audit: MIN_CANVAS_W floor applied.
   */
  readonly canvasW = signal<number>(initialCanvasW());

  /**
   * Current zoom scale factor.
   * Range: ZOOM_MIN (0.4) to ZOOM_MAX (1.5).
   * Applied as CSS transform: scale(zoom) on canvas wrapper.
   * NOT stored in history — zoom changes are not undoable.
   */
  readonly zoom = signal<number>(1);

  /**
   * Per-dashboard row height in pixels.
   * Selectable from ALLOWED_ROW_HEIGHTS (60 / 80 / 100 / 120).
   * NOT stored in history — display preference, same as zoom.
   * Serialized in exportLayout / importLayout so dashboards
   * remember their row height across sessions.
   */
  readonly rowH = signal<number>(DEFAULT_ROW_H);

  /**
   * Current canvas scroll position (scrollTop in pixels).
   * Updated reactively by scroll event listener in canvas.
   * Used by minimap to render the viewport rectangle.
   * Reactive state — NOT read from DOM at render time (bug fix #11).
   */
  readonly scrollTop = signal<number>(0);
  readonly viewportH = signal<number>(600);

  /**
   * Whether the minimap overlay is visible.
   * Toggled by the sidebar on/off button.
   * Only renders when widgets.length > 0.
   */
  readonly showMinimap = signal<boolean>(true);
  readonly showAlignmentGuides = signal<boolean>(true);
  readonly alignmentGuides = signal<AlignmentGuide[]>([]);
  readonly showGridBackground = signal<boolean>(true);

  /**
   * Whether snap-to-widget-edge fires on drag/resize pointerup.
   * When on, dropping a widget within SNAP_TO_WIDGET_PX of another
   * widget's edge commits an aligned position automatically.
   */
  readonly showSnapToWidget = signal<boolean>(true);

  /**
   * ID of the widget currently flashing the snap-target highlight.
   * Set for SNAP_HIGHLIGHT_MS when a snap fires on pointerup.
   * null = no snap highlight running.
   */
  readonly snapHighlightId = signal<string | null>(null);

  /**
   * Whether the revision history side-panel is visible.
   * Toggled by the toolbar clock button.
   */
  readonly showHistoryPanel = signal<boolean>(false);


  // ─────────────────────────────────────────────────────────────
  //  MODAL VISIBILITY FLAGS
  // ─────────────────────────────────────────────────────────────

  /**
   * Whether the Add Widget Wizard modal is open.
   */
  readonly wizardOpen = signal<boolean>(false);

  /**
   * Pre-selected widget type for the wizard.
   * Set when opening wizard from sidebar palette or Ctrl+1-9.
   * Causes wizard to skip Step 1 (type selection) and open on Step 2.
   * null = wizard starts at Step 1 (type selection).
   */
  readonly wizardInitType = signal<WidgetType | null>(null);

  /**
   * Widget currently being edited in the Edit Modal.
   * null = Edit Modal is closed.
   * Set by clicking the edit button on a widget card.
   */
  readonly editingWidget = signal<Widget | null>(null);

  /**
   * Whether the Templates Modal is open.
   */
  readonly showTemplates = signal<boolean>(false);

  /**
   * Whether the Import Modal is open.
   */
  readonly showImport = signal<boolean>(false);

  /**
   * Whether the Help Modal is open.
   */
  readonly showHelp = signal<boolean>(false);

  /**
   * Right-click context menu state.
   * null = menu is closed.
   * { id, x, y } = menu open for widget at cursor position.
   */
  readonly contextMenu = signal<ContextMenuState | null>(null);


  // ─────────────────────────────────────────────────────────────
  //  SIDEBAR STATE
  // ─────────────────────────────────────────────────────────────

  /**
   * Sidebar widget palette search query.
   * Filters displayed widget types in real time.
   * Does NOT affect Ctrl+1-9 keyboard shortcuts (edge case C18).
   * Reset to '' when sidebar is cleared.
   */
  readonly sidebarSearch = signal<string>('');
  readonly compactViewport = signal<boolean>(false);
  readonly sidebarOpen = signal<boolean>(false);
  readonly toolbarMenuOpen = signal<boolean>(false);


  // ─────────────────────────────────────────────────────────────
  //  HISTORY STATE
  // ─────────────────────────────────────────────────────────────

  /**
   * Full undo/redo history stack.
   * Each entry is a complete deep-cloned snapshot of widgets[].
   * Initialized with one empty state entry.
   *
   * Critical: entries must be deep clones (A6 from audit).
   * Angular CDK / gridster mutations must not affect snapshots.
   */
  readonly history = signal<HistorySnapshot[]>([
    { widgets: [], timestamp: Date.now(), label: 'Initial state', widgetCount: 0 },
  ]);

  /**
   * Current position in the history stack.
   * 0 = oldest state, history.length-1 = newest state.
   *
   * Angular note (M6/A1 from audit):
   * Unlike React's lazy useEffect sync, we update histIdx
   * synchronously in ALL operations that modify it.
   * No deferred sync needed — signals are synchronous.
   */
  readonly histIdx = signal<number>(0);


  // ─────────────────────────────────────────────────────────────
  //  COMPUTED SIGNALS
  //  Automatically re-derive whenever their dependencies change
  // ─────────────────────────────────────────────────────────────

  /**
   * Computed column width in pixels.
   * Re-computed whenever canvasW changes (ResizeObserver).
   * Used by every widget card for absolute pixel positioning.
   *
   * Formula: (canvasW - GAP * (COLS + 1)) / COLS
   */
  readonly colW = computed(() =>
    computeColW(this.canvasW())
  );

  /**
   * Computed canvas height in pixels.
   * Re-computed whenever widgets array, rowH, or viewportH changes.
   * Ensures canvas is always tall enough to show all widgets.
   * Fills the visible viewport on larger screens while preserving the 600px floor.
   */
  readonly canvasH = computed(() =>
    computeCanvasH(this.widgets(), this.rowH(), this.viewportH())
  );

  /**
   * Number of locked widgets on the canvas.
   * Shown in sidebar grid info panel and View mode status bar.
   */
  readonly lockedCount = computed(() =>
    this.widgets().filter(w => w.locked).length
  );

  /**
   * Total widget count.
   * Used by View button disabled state (disabled when 0).
   * Used by minimap visibility (hidden when 0).
   */
  readonly widgetCount = computed(() =>
    this.widgets().length
  );

  /**
   * Whether undo is available.
   * True when histIdx > 0 (there is a previous state).
   * Used to disable the undo button in toolbar.
   */
  readonly canUndo = computed(() =>
    this.histIdx() > 0
  );

  /**
   * Whether redo is available.
   * True when histIdx < history.length - 1.
   * Used to disable the redo button in toolbar.
   */
  readonly canRedo = computed(() =>
    this.histIdx() < this.history().length - 1
  );

  /**
   * Currently selected widget object.
   * Derived from selectedId + widgets array.
   * null if nothing selected or ID not found (stale ID guard).
   */
  readonly selectedWidget = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.widgets().find(w => w.id === id) ?? null;
  });

  /**
   * Currently editing widget object.
   * Derived from editingWidget signal.
   * Provides type-safe access to the widget being edited.
   */
  readonly isEditModalOpen = computed(() =>
    this.editingWidget() !== null
  );

  /**
   * Whether any BLOCKING modal is currently open.
   * Used to suppress keyboard shortcuts when a dialog is active.
   *
   * B8 fix: contextMenu intentionally excluded.
   * In React, keyboard shortcuts (Del, L, arrows) fire normally
   * while the context menu is visible — only Esc closes it.
   * Including contextMenu here would silently block Del/L/nudge
   * whenever the user right-clicks, which is wrong.
   *
   * The keyboard handler (Step 22) will explicitly check
   * contextMenu separately and close it on Esc only.
   */
  readonly isAnyModalOpen = computed(() =>
    this.wizardOpen() ||
    this.isEditModalOpen() ||
    this.showTemplates() ||
    this.showImport() ||
    this.showHelp()
    // contextMenu excluded — B8 fix
  );

  /**
   * Zoom percentage as display string.
   * Used by toolbar zoom badge.
   * e.g. zoom=1 → '100%', zoom=0.75 → '75%'
   */
  readonly zoomPercent = computed(() =>
    `${Math.round(this.zoom() * 100)}%`
  );

  /**
   * Whether zoom is at exactly 100%.
   * Toolbar zoom badge glows blue when not at 100%.
   */
  readonly isDefaultZoom = computed(() =>
    this.zoom() === 1
  );


  // ─────────────────────────────────────────────────────────────
  //  SIMPLE STATE MUTATORS
  //  Direct signal writes — no history, no side effects
  // ─────────────────────────────────────────────────────────────

  /** Select a widget by ID. null to deselect. */
  select(id: string | null): void {
    this.selectedId.set(id);
  }

  /** Set the active (dragging/resizing) widget ID. */
  setActive(id: string | null): void {
    this.activeId.set(id);
    if (id === null) {
      this.alignmentGuides.set([]);
    }
  }

  setAlignmentGuides(guides: AlignmentGuide[]): void {
    this.alignmentGuides.set(guides);
  }

  /** Update canvas width — called by ResizeObserver. */
  setCanvasW(w: number): void {
    this.canvasW.set(Math.max(MIN_CANVAS_W, w));
  }

  /** Update scroll position — called by scroll event. */
  setScrollTop(top: number): void {
    this.scrollTop.set(top);
  }

  /** Update visible scroll viewport height â€” used by minimap viewport math. */
  setViewportH(height: number): void {
    this.viewportH.set(Math.max(1, height));
  }

  /** Set zoom level — clamped to valid range. */
  setZoom(z: number): void {
    this.zoom.set(clamp(z, ZOOM_MIN, ZOOM_MAX));
  }

  /** Step zoom in by one increment. */
  zoomIn(): void {
    this.setZoom(this.zoom() + ZOOM_STEP);
  }

  /** Step zoom out by one increment. */
  zoomOut(): void {
    this.setZoom(this.zoom() - ZOOM_STEP);
  }

  /** Reset zoom to 100%. */
  resetZoom(): void {
    this.zoom.set(1);
  }

  /**
   * Set the per-dashboard row height.
   * Value must be one of ALLOWED_ROW_HEIGHTS (60 / 80 / 100 / 120).
   * Silently ignored if value is not in the allowed set.
   * NOT pushed to history — display preference, same as zoom.
   */
  setRowH(h: number): void {
    if (ALLOWED_ROW_HEIGHTS.includes(h)) {
      this.rowH.set(h);
    }
  }

  /** Toggle minimap visibility. */
  toggleMinimap(): void {
    this.showMinimap.update(v => !v);
  }

  toggleAlignmentGuides(): void {
    this.showAlignmentGuides.update(v => !v);
    if (!this.showAlignmentGuides()) {
      this.alignmentGuides.set([]);
    }
  }

  toggleGridBackground(): void {
    this.showGridBackground.update(v => !v);
  }

  toggleSnapToWidget(): void {
    this.showSnapToWidget.update(v => !v);
  }

  toggleHistoryPanel(): void {
    this.showHistoryPanel.update(v => !v);
  }

  /**
   * Jump to any history entry by index.
   * Restores the widget array from that snapshot and sets histIdx.
   * Does NOT push a new entry — just navigates the existing stack.
   */
  jumpToHistory(idx: number): void {
    const stack = this.history();
    if (idx < 0 || idx >= stack.length) return;
    this.histIdx.set(idx);
    this.widgets.set(deepClone(stack[idx].widgets));
    // Clear any stale selection/interaction state
    this.selectedId.set(null);
    this.activeId.set(null);
  }

  /**
   * Flash the snap-target widget with a brief highlight ring.
   * Called by widget-card when a snap fires on pointerup.
   * The ring auto-clears after 400ms.
   */
  triggerSnapHighlight(id: string): void {
    this.snapHighlightId.set(id);
    setTimeout(() => this.snapHighlightId.set(null), 400);
  }

  /** Update sidebar search query. */
  setSidebarSearch(q: string): void {
    this.sidebarSearch.set(q);
  }

  /** Clear sidebar search. */
  clearSidebarSearch(): void {
    this.sidebarSearch.set('');
  }

  /** Update whether the builder is in a compact viewport mode. */
  setCompactViewport(isCompact: boolean): void {
    this.compactViewport.set(isCompact);

    if (!isCompact) {
      this.sidebarOpen.set(false);
      this.toolbarMenuOpen.set(false);
    }
  }

  /** Toggle the compact sidebar drawer. */
  toggleSidebar(): void {
    if (!this.compactViewport()) return;
    this.sidebarOpen.update(v => !v);
    if (this.sidebarOpen()) {
      this.toolbarMenuOpen.set(false);
    }
  }

  /** Explicitly open the compact sidebar drawer. */
  openSidebar(): void {
    if (!this.compactViewport()) return;
    this.sidebarOpen.set(true);
    this.toolbarMenuOpen.set(false);
  }

  /** Explicitly close the compact sidebar drawer. */
  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /** Toggle the compact toolbar overflow menu. */
  toggleToolbarMenu(): void {
    if (!this.compactViewport()) return;
    this.toolbarMenuOpen.update(v => !v);
    if (this.toolbarMenuOpen()) {
      this.sidebarOpen.set(false);
    }
  }

  /** Close the compact toolbar overflow menu. */
  closeToolbarMenu(): void {
    this.toolbarMenuOpen.set(false);
  }

  /** Open wizard — optionally pre-set to a widget type. */
  openWizard(type: WidgetType | null = null): void {
    this.wizardInitType.set(type);
    this.wizardOpen.set(true);
    this.closeSidebar();
    this.closeToolbarMenu();
  }

  /** Close wizard and reset init type. */
  closeWizard(): void {
    this.wizardOpen.set(false);
    this.wizardInitType.set(null);
  }

  /** Open edit modal for a widget. */
  openEditModal(widget: Widget): void {
    this.editingWidget.set(deepClone(widget));
  }

  /** Close edit modal. */
  closeEditModal(): void {
    this.editingWidget.set(null);
  }

  /** Open templates modal. */
  openTemplates(): void {
    this.showTemplates.set(true);
    this.closeSidebar();
    this.closeToolbarMenu();
  }

  /** Close templates modal. */
  closeTemplates(): void {
    this.showTemplates.set(false);
  }

  /** Open import modal. */
  openImport(): void {
    this.showImport.set(true);
    this.closeSidebar();
    this.closeToolbarMenu();
  }

  /** Close import modal. */
  closeImport(): void {
    this.showImport.set(false);
  }

  /** Open help modal. */
  openHelp(): void {
    this.showHelp.set(true);
    this.closeSidebar();
    this.closeToolbarMenu();
  }

  /** Close help modal. */
  closeHelp(): void {
    this.showHelp.set(false);
  }

  /** Open context menu at cursor position for a widget. */
  openContextMenu(id: string, x: number, y: number): void {
    this.contextMenu.set({ id, x, y });
  }

  /** Close context menu. */
  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  /** Set dashboard title. */
  setDashTitle(title: string): void {
    this.dashTitle.set(title);
  }

  /** Toggle title edit mode. */
  toggleEditTitle(): void {
    this.editingTitle.update(v => !v);
  }

  /**
   * Close all modals at once.
   * Called by Esc key handler.
   */
  closeAllModals(): void {
    this.closeWizard();
    this.closeEditModal();
    this.closeTemplates();
    this.closeImport();
    this.closeHelp();
    this.closeContextMenu();
    this.closeSidebar();
    this.closeToolbarMenu();
    this.selectedId.set(null);
  }

  /**
   * Trigger the save animation flash on a widget.
   * Green border glow for SAVE_ANIMATION_MS (700ms).
   * Called after saveWidget() completes.
   */
  triggerSaveAnimation(id: string): void {
    this.animatingId.set(id);
    setTimeout(
      () => this.animatingId.set(null),
      SAVE_ANIMATION_MS
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  STEP 12 — WIDGET OPERATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Pending scroll target ID.
   * Set when a widget is added or duplicated.
   * Canvas component watches for this and scrolls to the widget
   * after it appears in the DOM.
   *
   * Uses a plain property (not a signal) because scroll is a
   * one-shot side effect, not reactive state.
   * Cleared immediately after scroll fires (edge case C21).
   */
  pendingScrollId: string | null = null;


  // ─────────────────────────────────────────────────────────────
  //  HISTORY HELPERS
  //  Defined before widget ops because all ops call pushHistory
  // ─────────────────────────────────────────────────────────────

  /**
   * Push current widget state onto the history stack.
   * Truncates any forward history (redo states) first.
   * Deep clones the snapshot to prevent mutation (A6 audit).
   *
   * Angular note (A1 audit):
   * histIdx is updated SYNCHRONOUSLY here — no deferred sync
   * needed unlike React's useEffect pattern.
   *
   * Not in history:
   * - zoom changes
   * - lock toggles
   * - scroll position
   * - title changes
   * - modal state
   */
  pushHistory(snapshot: Widget[], label: string): void {
    const currentIdx = this.histIdx();
    const currentHist = this.history();

    // Truncate forward history — redo states are lost
    const truncated = currentHist.slice(0, currentIdx + 1);
    const newEntry: HistorySnapshot = {
      widgets: deepClone(snapshot),
      timestamp: Date.now(),
      label,
      widgetCount: snapshot.length,
    };

    // Cap stack size — trim oldest entries beyond MAX_HISTORY_ENTRIES
    const uncapped = [...truncated, newEntry];
    const capped = uncapped.length > MAX_HISTORY_ENTRIES
      ? uncapped.slice(uncapped.length - MAX_HISTORY_ENTRIES)
      : uncapped;

    this.history.set(capped);

    // Synchronous update — no deferred sync needed (A1 audit)
    this.histIdx.set(capped.length - 1);
  }

  /**
   * Update widgets and push to history in one operation.
   * All widget ops that are undoable call this.
   */
  private updateWidgets(fn: (prev: Widget[]) => Widget[], label: string): void {
    const next = fn(this.widgets());
    this.widgets.set(next);
    this.pushHistory(next, label);
  }

  /**
   * Undo — step back one history entry.
   * Restores widgets to previous state.
   * Does nothing if at oldest state (canUndo = false).
   */
  undo(): void {
    const idx = this.histIdx();
    if (idx <= 0) return;

    const newIdx = idx - 1;
    // Synchronous update (A1 audit)
    this.histIdx.set(newIdx);
    this.widgets.set(deepClone(this.history()[newIdx].widgets));
  }

  /**
   * Redo — step forward one history entry.
   * Restores widgets to next state.
   * Does nothing if at newest state (canRedo = false).
   */
  redo(): void {
    const idx = this.histIdx();
    const hist = this.history();
    if (idx >= hist.length - 1) return;

    const newIdx = idx + 1;
    // Synchronous update (A1 audit)
    this.histIdx.set(newIdx);
    this.widgets.set(deepClone(hist[newIdx].widgets));
  }


  // ─────────────────────────────────────────────────────────────
  //  WIDGET CRUD OPERATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Add a new widget to the canvas.
   *
   * Behavior:
   * - Placed at findFirstFreeSlot() — first gap that fits, falls back to bottom (P1)
   * - New ID generated (ignores any ID in the passed widget)
   * - Auto-scrolls to the new widget after DOM commit
   * - Selects the new widget immediately
   * - Closes wizard after adding
   * - Undoable — goes through pushHistory
   */
  addWidget(widget: Partial<Widget>): void {
    const newId = uid();
    const w = (widget as Widget).w ?? 3;
    const h = (widget as Widget).h ?? 2;
    const slot = findFirstFreeSlot(w, h, this.widgets()); // P1: fill gaps before appending at bottom

    const placed: Widget = {
      ...(widget as Widget),
      id: newId,
      x: slot.x,
      y: slot.y,
    };

    this.updateWidgets(prev => [...prev, placed], `Added "${placed.title}" (${placed.type})`);

    // Select and queue scroll — fires after DOM commit
    this.selectedId.set(newId);
    this.pendingScrollId = newId;

    // Close wizard
    this.closeWizard();
  }

  /**
   * Add a widget at an explicit grid position (drag-from-sidebar drop).
   * Unlike addWidget(), this respects the provided x/y instead of forcing x=0 / getNextY().
   * Returns the placed widget (with its final ID) so the caller can open the edit modal.
   * Does NOT close the wizard or auto-scroll — caller handles UX.
   */
  addWidgetAt(widget: Widget): Widget {
    const placed: Widget = { ...deepClone(widget), id: uid() };
    this.updateWidgets(prev => [...prev, placed], `Dropped "${placed.title}" (${placed.type})`);
    this.selectedId.set(placed.id);
    return placed;
  }

  /**
   * Duplicate a widget.
   *
   * Behavior:
   * - Deep clones the widget (prevents config mutation)
   * - New ID generated
   * - Placed at getNextY() — bottom of canvas
   * - Preserves original x position (M2 audit)
   * - Auto-scrolls to the duplicate
   * - Selects the duplicate
   * - Undoable
   *
   * Angular fix (A3 audit):
   * Unlike React Ctrl+D which didn't scroll/select,
   * ALL duplicate paths (button, context menu, keyboard)
   * go through this method — consistent behavior.
   */
  duplicateWidget(widget: Widget): void {
    const newId = uid();
    const all = this.widgets();
    const { x, y, isAdjacent } = findAdjacentPlacement(widget, widget, all);

    const duplicate: Widget = {
      ...deepClone(widget),
      id: newId,
      x,
      y,
    };

    this.updateWidgets(prev => [...prev, duplicate], `Duplicated "${widget.title}"`);

    // Select the duplicate (A3 audit fix)
    this.selectedId.set(newId);
    // Only scroll when placed at the canvas bottom (fallback).
    // Adjacent placement is already in view — no scroll needed.
    if (!isAdjacent) {
      this.pendingScrollId = newId;
    }
  }

  /**
   * Copy selected widget to clipboard (deep clone).
   * Does not modify the canvas or history.
   */
  copyWidget(widget: Widget): void {
    this.clipboard.set(deepClone(widget));
  }

  /**
   * Paste clipboard widget onto canvas.
   * Same placement logic as duplicateWidget — bottom of canvas, x preserved.
   * No-op when clipboard is empty.
   */
  pasteWidget(): void {
    const source = this.clipboard();
    if (!source) return;

    const newId = uid();
    const nextY = getNextY(this.widgets());

    const pasted: Widget = {
      ...deepClone(source),
      id: newId,
      y: nextY,
    };

    this.updateWidgets(prev => [...prev, pasted], `Pasted "${source.title}"`);
    this.selectedId.set(newId);
    this.pendingScrollId = newId;
  }

  /**
   * Delete a widget by ID.
   *
   * Behavior:
   * - Removes widget from array
   * - Clears ALL stale IDs pointing to deleted widget (A2 audit)
   *   This fixes the React inconsistency where button/context-menu
   *   delete left selectedId stale
   * - Undoable
   */
  deleteWidget(id: string): void {
    const target = this.widgets().find(w => w.id === id);
    const label = target ? `Deleted "${target.title}" (${target.type})` : 'Delete widget';
    this.updateWidgets(prev => prev.filter(w => w.id !== id), label);

    // Angular fix (A2 audit):
    // Always clear stale IDs — unlike React which only cleared
    // selectedId on Del key, not on button/context-menu delete
    if (this.selectedId() === id) this.selectedId.set(null);
    if (this.animatingId() === id) this.animatingId.set(null);
    if (this.editingWidget()?.id === id) this.closeEditModal();
  }

  /**
   * Save widget changes from Edit Modal.
   *
   * Behavior:
   * - Updates widget in array by ID
   * - Silent no-op if widget was deleted while modal was open
   *   (edge case C14 from audit)
   * - Triggers 700ms green flash animation
   * - Undoable
   */
  saveWidget(updated: Widget): void {
    // Silent no-op if widget no longer exists (C14 audit)
    const exists = this.widgets().some(w => w.id === updated.id);
    if (!exists) {
      this.closeEditModal();
      return;
    }

    this.updateWidgets(
      prev => prev.map(w => w.id === updated.id ? { ...updated } : w),
      `Edited "${updated.title}" (${updated.type})`,
    );

    // Trigger green flash animation
    this.triggerSaveAnimation(updated.id);

    // Close edit modal
    this.closeEditModal();
  }

  /**
   * Toggle lock state on a widget.
   *
   * Behavior:
   * - Toggles widget.locked boolean
   * - NOT undoable (intentional — edge case C10 from audit)
   *   Lock is a meta-operation that shouldn't clutter undo stack
   * - Uses direct setWidgets — bypasses pushHistory
   */
  lockWidget(id: string): void {
    // Direct signal update — NOT through updateWidgets
    // Lock toggle is intentionally not in history (C10 audit)
    this.widgets.update(prev =>
      prev.map(w =>
        w.id === id ? { ...w, locked: !w.locked } : w
      )
    );
  }

  /**
   * Clear all widgets from the canvas.
   * Undoable — goes through pushHistory.
   * Contrast with loadTemplate/importLayout which RESET history.
   * Edge case C9 from audit: clearAll IS undoable.
   */
  clearAll(): void {
    const count = this.widgets().length;
    this.updateWidgets(() => [], `Cleared all (${count} widget${count === 1 ? '' : 's'})`);
  }

  /**
   * Apply pack layout — remove empty row gaps.
   * Sorts widgets upward to fill gaps.
   * Undoable — goes through pushHistory.
   */
  applyPackLayout(): void {
    this.updateWidgets(prev => packLayout(prev), 'Pack layout');
  }

  /**
   * Update widget positions in bulk.
   * Called by drag and resize handlers after each mousemove.
   *
   * NOT pushed to history here — history is pushed on mouseup
   * to avoid flooding the stack with every pixel of movement.
   * Edge case C11 from audit.
   */
  setWidgetPositions(resolved: Widget[]): void {
    this.widgets.set(resolved);
  }

  /**
   * Commit drag/resize to history.
   * Called on mouseup after drag or resize completes.
   * Pushes the final resolved layout as one history entry.
   */
  commitDragResize(): void {
    const active = this.widgets().find(w => w.id === this.activeId());
    const label = active ? `Moved "${active.title}"` : 'Move / resize';
    this.pushHistory(this.widgets(), label);
    this.alignmentGuides.set([]);
    this.activeId.set(null);
  }

  // ─────────────────────────────────────────────────────────────
  //  STEP 13 — TEMPLATES + IMPORT / EXPORT
  // ─────────────────────────────────────────────────────────────

  /**
   * Expose templates array for template modal component.
   */
  readonly templates = TEMPLATES;

  /**
   * Load a pre-built template.
   *
   * Behavior (edge case C3 audit):
   * - Replaces widgets entirely
   * - RESETS history stack to single entry
   * - NOT undoable back to before template load
   * - Sets dashTitle to template name
   * - Closes templates modal
   *
   * Angular fix (A1 audit):
   * histIdx reset is SYNCHRONOUS — no deferred sync needed.
   */
  loadTemplate(templateId: string): void {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      console.warn(`loadTemplate: unknown id "${templateId}"`);
      return;
    }

    const built = template.build();

    // Set widgets
    this.widgets.set(built);

    // RESET history — not undoable back (C3 audit)
    this.history.set([{ widgets: deepClone(built), timestamp: Date.now(), label: 'Load template', widgetCount: built.length }]);

    // Synchronous reset (A1 audit)
    this.histIdx.set(0);

    // Update title
    this.dashTitle.set(template.name);

    // Reset display preferences
    this.rowH.set(DEFAULT_ROW_H);

    // Clear selection state
    this.selectedId.set(null);

    this.animatingId.set(null);

    // Close modal
    this.closeTemplates();
    this.closeSidebar();
    this.closeToolbarMenu();
  }

  /**
   * Load the demo layout.
   * Same reset behavior as loadTemplate.
   * Uses the Sales template as the demo.
   */
  loadDemo(): void {
    const demo = buildSalesDemo();

    this.widgets.set(demo);
    this.history.set([{ widgets: deepClone(demo), timestamp: Date.now(), label: 'Load demo', widgetCount: demo.length }]);
    this.histIdx.set(0);
    this.dashTitle.set('My Dashboard');
    this.rowH.set(DEFAULT_ROW_H);
    this.selectedId.set(null);

    this.animatingId.set(null);    // B7 fix: clear any in-flight save animation
    this.closeSidebar();
    this.closeToolbarMenu();
  }

  /**
   * Export dashboard to JSON file.
   * Downloads as `<dashTitle>.json`
   * Format: { title: string, widgets: Widget[] }
   */
  exportLayout(): void {
    const data: DashboardExport = {
      title: this.dashTitle(),
      widgets: this.widgets(),
      rowH: this.rowH(),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `${toFilename(this.dashTitle())}.json`;

    // Trigger browser download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Import dashboard from JSON.
   *
   * Supports two formats (edge case from audit):
   * - { title: string, widgets: Widget[] }  ← current export format
   * - Widget[]                              ← legacy raw array format
   *
   * Behavior:
   * - Regenerates ALL widget IDs with fresh uid() (C19 audit)
   * - RESETS history stack
   * - Sets dashTitle from file or falls back to 'Imported Dashboard'
   * - Closes import modal
   *
   * @param jsonString - Raw JSON string from file reader
   * @returns          - Error message string or null on success
   */
  importLayout(jsonString: string): string | null {
    try {
      const parsed = JSON.parse(jsonString);

      // Support both formats
      const list: Widget[] = Array.isArray(parsed)
        ? parsed
        : (parsed.widgets || []);

      const title: string = Array.isArray(parsed)
        ? 'Imported Dashboard'
        : (parsed.title || 'Imported Dashboard');

      if (!Array.isArray(list)) {
        return 'Invalid format — expected a widgets array';
      }

      // Regenerate all IDs (C19 audit)
      const refreshed: Widget[] = list.map(w => ({
        ...w,
        id: uid(),
      }));

      // Set widgets
      this.widgets.set(refreshed);

      // RESET history (A1 audit — synchronous)
      this.history.set([{ widgets: deepClone(refreshed), timestamp: Date.now(), label: 'Import', widgetCount: refreshed.length }]);
      this.histIdx.set(0);

      // Update title and display preferences
      this.dashTitle.set(title);
      // Restore row height if present in export; fall back to default (backward-compat)
      if (!Array.isArray(parsed) && typeof parsed.rowH === 'number') {
        this.setRowH(parsed.rowH);
      } else {
        this.rowH.set(DEFAULT_ROW_H);
      }

      // Clear selection state
      this.selectedId.set(null);

      this.animatingId.set(null);

      // Close import modal
      this.closeImport();
      this.closeSidebar();
      this.closeToolbarMenu();

      return null; // success

    } catch {
      return 'Could not parse file — make sure it is a valid dashcraft JSON export';
    }
  }

  /**
   * Load a dashboard payload fetched from the API into the canvas.
   *
   * Unlike importLayout(), this method:
   * - Preserves original widget IDs (they are authoritative from the server)
   * - Does NOT close the import modal (not triggered by a file import)
   * - Resets all transient interaction state (selection, drag, clipboard, guides)
   *
   * Used by DashboardPersistenceService.load() when switching between dashboards
   * so the save effect never fires with a mismatched ID + widget dataset.
   *
   * @param payload - { title, widgets, rowH? } from DashboardApiService.get()
   */
  loadLayout(payload: { title: string; widgets: Widget[]; rowH?: number }): void {
    // Set widgets directly — IDs are preserved (unlike importLayout which regenerates)
    this.widgets.set(deepClone(payload.widgets));

    // RESET history — not undoable across dashboard switches
    this.history.set([{
      widgets:     deepClone(payload.widgets),
      timestamp:   Date.now(),
      label:       'Load dashboard',
      widgetCount: payload.widgets.length,
    }]);
    this.histIdx.set(0);

    // Update title and display preferences
    this.dashTitle.set(payload.title || 'Untitled Dashboard');
    if (payload.rowH && ALLOWED_ROW_HEIGHTS.includes(payload.rowH)) {
      this.rowH.set(payload.rowH);
    } else {
      this.rowH.set(DEFAULT_ROW_H);
    }

    // Reset all transient interaction state — Gap 10 fix
    this.selectedId.set(null);
    this.activeId.set(null);
    this.animatingId.set(null);
    this.clipboard.set(null);
    this.alignmentGuides.set([]);
    this.closeAllModals();
  }
}
