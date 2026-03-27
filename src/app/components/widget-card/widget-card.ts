import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardService } from '../../services/dashboard.service';
import { AlignmentGuide, PixelRect, ResizeDirection, Widget } from '../../core/interfaces';
import { gridToPixel, resolveDrag, resolveResize, snapToWidgetEdge } from '../../core/layout.utils';
import {
  COLS,
  GAP,
  HDR_H,
  MAX_WIDGET_H,
  SNAP_TO_WIDGET_PX,
  clamp,
} from '../../core/constants';
import { getCatalogItem } from '../../core/catalog';
import { StatWidget } from '../widgets/stat-widget/stat-widget';
import { AnalyticsWidget } from '../widgets/analytics-widget/analytics-widget';
import { BarWidget } from '../widgets/bar-widget/bar-widget';
import { LineWidget } from '../widgets/line-widget/line-widget';
import { PieWidget } from '../widgets/pie-widget/pie-widget';
import { ProgressWidget } from '../widgets/progress-widget/progress-widget';
import { TableWidget } from '../widgets/table-widget/table-widget';
import { NoteWidget } from '../widgets/note-widget/note-widget';
import { SectionWidget } from '../widgets/section-widget/section-widget';

@Component({
  selector: 'app-widget-card',
  imports: [
    CommonModule,
    StatWidget,
    AnalyticsWidget,
    BarWidget,
    LineWidget,
    PieWidget,
    ProgressWidget,
    TableWidget,
    NoteWidget,
    SectionWidget,
  ],
  templateUrl: './widget-card.html',
  styleUrl: './widget-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCard implements OnDestroy {
  @Input({ required: true }) widget!: Widget;

  readonly RD = ResizeDirection;
  readonly svc = inject(DashboardService);
  private readonly cdr = inject(ChangeDetectorRef);

  private static readonly DRAG_THRESHOLD_PX = 4;
  private static readonly TOUCH_DRAG_HOLD_MS = 170;
  private static readonly TOUCH_SCROLL_CANCEL_PX = 10;
  private static readonly AUTO_SCROLL_EDGE_PX = 72;
  private static readonly AUTO_SCROLL_MAX_STEP_PX = 28;
  private static readonly ALIGNMENT_THRESHOLD_PX = 8;

  private dragRef: {
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    latestX: number;
    latestY: number;
    engaged: boolean;
    translateX: number;
    translateY: number;
    previewLayout: Widget[] | null;
    previewRect: PixelRect | null;
    awaitingLongPress: boolean;
    scrollEl: HTMLElement | null;
    startScrollTop: number;
    startScrollLeft: number;
  } | null = null;

  private resizeRef: {
    pointerId: number;
    dir: ResizeDirection;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    latestX: number;
    latestY: number;
    liveRect: PixelRect;
    previewLayout: Widget[] | null;
    previewRect: PixelRect | null;
  } | null = null;

  private dragRafId: number | null = null;
  private resizeRafId: number | null = null;
  private autoScrollRafId: number | null = null;
  private touchDragHoldTimer: number | null = null;

  private dragMoveHandler!: (e: PointerEvent) => void;
  private dragUpHandler!: (e: PointerEvent) => void;
  private dragCancelHandler!: (e: PointerEvent) => void;
  private resizeMoveHandler!: (e: PointerEvent) => void;
  private resizeUpHandler!: (e: PointerEvent) => void;
  private resizeCancelHandler!: (e: PointerEvent) => void;

  get pixelRect(): PixelRect {
    return gridToPixel(this.widget, this.svc.colW(), this.svc.rowH());
  }

  get currentRect(): PixelRect {
    return this.resizeRef?.liveRect ?? this.pixelRect;
  }

  get contentH(): number {
    return this.currentRect.height - HDR_H;
  }

  get isSelected(): boolean {
    return this.svc.selectedId() === this.widget.id;
  }

  get isActive(): boolean {
    return this.svc.activeId() === this.widget.id;
  }

  get isAnimating(): boolean {
    return this.svc.animatingId() === this.widget.id;
  }

  get isLocked(): boolean {
    return this.widget.locked;
  }

  get isSnapTarget(): boolean {
    return this.svc.snapHighlightId() === this.widget.id;
  }

  get isDragging(): boolean {
    return !!this.dragRef?.engaged;
  }

  get isResizing(): boolean {
    return !!this.resizeRef;
  }

  get isInteracting(): boolean {
    return this.isDragging || this.isResizing;
  }

  get catalogItem() {
    return getCatalogItem(this.widget.type);
  }

  get catalogIcon(): string {
    return this.catalogItem?.icon ?? '';
  }

  get catalogColor(): string {
    return this.catalogItem?.color ?? 'var(--acc)';
  }

  get catalogLabel(): string {
    return this.catalogItem?.label ?? '';
  }

  get zIndex(): number {
    if (this.isActive || this.isInteracting) return 200;
    if (this.isSelected) return 150;
    return 1;
  }

  get posStyle(): Record<string, string> {
    const rect = this.currentRect;
    const style: Record<string, string> = {
      position: 'absolute',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: String(this.zIndex),
    };

    if (this.dragRef?.engaged) {
      style['transform'] = `translate3d(${this.dragRef.translateX}px, ${this.dragRef.translateY}px, 0)`;
    }

    return style;
  }

  get previewGhostStyle(): Record<string, string> | null {
    const rect = this.dragRef?.previewRect ?? this.resizeRef?.previewRect ?? null;
    const liveRect = this.getInteractionRect();
    if (!rect || !this.isInteracting) return null;
    if (liveRect && this.sameRect(liveRect, rect)) return null;

    return {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      zIndex: String(Math.max(this.zIndex - 1, 1)),
    };
  }

  get interactionShadowStyle(): Record<string, string> | null {
    const rect = this.getInteractionRect();
    if (!rect) return null;

    return {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      transform: 'translate3d(8px, 12px, 0)',
      zIndex: String(Math.max(this.zIndex - 2, 1)),
    };
  }

  ngOnDestroy(): void {
    this.removeDragListeners();
    this.removeResizeListeners();
    this.clearTouchDragHoldTimer();
    if (this.dragRafId !== null) cancelAnimationFrame(this.dragRafId);
    if (this.resizeRafId !== null) cancelAnimationFrame(this.resizeRafId);
    this.stopAutoScrollLoop();
    this.svc.setAlignmentGuides([]);
  }

  onCardClick(e: MouseEvent): void {
    e.stopPropagation();
    this.svc.select(this.widget.id);
  }

  onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.svc.openContextMenu(this.widget.id, e.clientX, e.clientY);
  }

  onEdit(e: MouseEvent): void {
    e.stopPropagation();
    this.svc.openEditModal(this.widget);
  }

  onDuplicate(e: MouseEvent): void {
    e.stopPropagation();
    this.svc.duplicateWidget(this.widget);
  }

  onLock(e: MouseEvent): void {
    e.stopPropagation();
    this.svc.lockWidget(this.widget.id);
  }


  onDelete(e: MouseEvent): void {
    e.stopPropagation();
    this.svc.deleteWidget(this.widget.id);
  }

  onSurfacePointerDown(e: PointerEvent): void {
    if (!this.isPrimaryPointer(e)) return;
    if (this.shouldIgnoreDragStart(e.target)) return;

    const wasSelected = this.isSelected;

    e.stopPropagation();
    this.svc.select(this.widget.id);
    this.svc.closeContextMenu();

    if (this.widget.locked) return;

    const requiresTouchHold = e.pointerType === 'touch' && !wasSelected;
    const scrollEl = this.getScrollArea();
    if (!requiresTouchHold) {
      e.preventDefault();
    }

    this.dragRef = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      origX: this.widget.x,
      origY: this.widget.y,
      latestX: e.clientX,
      latestY: e.clientY,
      engaged: false,
      translateX: 0,
      translateY: 0,
      previewLayout: null,
      previewRect: null,
      awaitingLongPress: requiresTouchHold,
      scrollEl,
      startScrollTop: scrollEl?.scrollTop ?? 0,
      startScrollLeft: scrollEl?.scrollLeft ?? 0,
    };

    this.dragMoveHandler = (mv: PointerEvent) => this.onDragMove(mv);
    this.dragUpHandler = (up: PointerEvent) => this.onDragUp(up);
    this.dragCancelHandler = (cancel: PointerEvent) => this.onDragUp(cancel);
    document.addEventListener('pointermove', this.dragMoveHandler);
    document.addEventListener('pointerup', this.dragUpHandler);
    document.addEventListener('pointercancel', this.dragCancelHandler);
    this.ensureAutoScrollLoop();

    if (requiresTouchHold) {
      this.touchDragHoldTimer = window.setTimeout(() => {
        if (!this.dragRef || this.dragRef.pointerId !== e.pointerId) return;
        this.dragRef.awaitingLongPress = false;
        this.dragRef.engaged = true;
        this.svc.setActive(this.widget.id);
        this.touchDragHoldTimer = null;
        this.cdr.markForCheck();
      }, WidgetCard.TOUCH_DRAG_HOLD_MS);
    }
  }

  onResizePointerDown(e: PointerEvent, dir: ResizeDirection): void {
    if (!this.isPrimaryPointer(e) || this.widget.locked) return;

    e.preventDefault();
    e.stopPropagation();

    const baseRect = gridToPixel(this.widget, this.svc.colW(), this.svc.rowH());
    this.resizeRef = {
      pointerId: e.pointerId,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      origX: this.widget.x,
      origY: this.widget.y,
      origW: this.widget.w,
      origH: this.widget.h,
      latestX: e.clientX,
      latestY: e.clientY,
      liveRect: baseRect,
      previewLayout: null,
      previewRect: baseRect,
    };

    this.svc.setActive(this.widget.id);

    this.resizeMoveHandler = (mv: PointerEvent) => this.onResizeMove(mv);
    this.resizeUpHandler = (up: PointerEvent) => this.onResizeUp(up);
    this.resizeCancelHandler = (cancel: PointerEvent) => this.onResizeUp(cancel);
    document.addEventListener('pointermove', this.resizeMoveHandler);
    document.addEventListener('pointerup', this.resizeUpHandler);
    document.addEventListener('pointercancel', this.resizeCancelHandler);
  }

  private onDragMove(mv: PointerEvent): void {
    if (!this.dragRef || mv.pointerId !== this.dragRef.pointerId) return;

    if (this.dragRef.awaitingLongPress) {
      const dx = Math.abs(mv.clientX - this.dragRef.startX);
      const dy = Math.abs(mv.clientY - this.dragRef.startY);
      if (dx > WidgetCard.TOUCH_SCROLL_CANCEL_PX || dy > WidgetCard.TOUCH_SCROLL_CANCEL_PX) {
        this.cancelPendingTouchDrag();
      }
      return;
    }

    this.dragRef.latestX = mv.clientX;
    this.dragRef.latestY = mv.clientY;
    this.scheduleDragPreview();
  }

  private onDragUp(up: PointerEvent): void {
    if (this.dragRef && up.pointerId !== this.dragRef.pointerId) return;

    let nextLayout = this.dragRef?.previewLayout ?? null;
    const shouldCommit = !!this.dragRef?.engaged && !!nextLayout && this.layoutChanged(nextLayout);
    // Capture previewRect before clearing dragRef — needed for snap calculation below
    const capturedPreviewRect = this.dragRef?.previewRect ?? null;

    this.clearTouchDragHoldTimer();
    this.dragRef = null;
    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId);
      this.dragRafId = null;
    }
    this.stopAutoScrollLoop();
    this.removeDragListeners();

    if (shouldCommit && nextLayout) {
      // ── Snap-to-widget-edge on pointerup (Feature 3) ────────────
      // Only fires here — never during movement to avoid jitter.
      // If snap is off or no previewRect available, falls through to
      // the original nextLayout unchanged.
      if (this.svc.showSnapToWidget() && capturedPreviewRect) {
        const colW   = this.svc.colW();
        const rowH   = this.svc.rowH();
        const others = this.svc.widgets()
          .filter(w => w.id !== this.widget.id)
          .map(w => ({ rect: gridToPixel(w, colW, rowH), id: w.id }));

        const snap = snapToWidgetEdge(capturedPreviewRect, others, SNAP_TO_WIDGET_PX);

        if (snap.snapLeft !== null || snap.snapTop !== null) {
          const newLeft = snap.snapLeft ?? capturedPreviewRect.left;
          const newTop  = snap.snapTop  ?? capturedPreviewRect.top;
          const snappedX = clamp(
            Math.round((newLeft - GAP) / (colW + GAP)),
            0,
            COLS - this.widget.w
          );
          const snappedY = clamp(
            Math.round((newTop - GAP) / (rowH + GAP)),
            0,
            50
          );

          const snappedLayout = resolveDrag(
            this.widget, snappedX, snappedY, this.svc.widgets()
          );
          // Only accept snap if resolveDrag succeeds (guards against
          // snapping into a locked/pinned widget's space)
          if (snappedLayout) {
            nextLayout = snappedLayout;
            if (snap.targetId) this.svc.triggerSnapHighlight(snap.targetId);
          }
        }
      }

      this.svc.setWidgetPositions(nextLayout);
      this.svc.commitDragResize();
    } else {
      this.svc.setActive(null);
    }

    this.cdr.markForCheck();
  }

  private onResizeMove(mv: PointerEvent): void {
    if (!this.resizeRef || mv.pointerId !== this.resizeRef.pointerId) return;
    this.resizeRef.latestX = mv.clientX;
    this.resizeRef.latestY = mv.clientY;
    this.scheduleResizePreview();
  }

  private onResizeUp(up: PointerEvent): void {
    if (this.resizeRef && up.pointerId !== this.resizeRef.pointerId) return;

    let nextLayout = this.resizeRef?.previewLayout ?? null;
    const shouldCommit = !!nextLayout && this.layoutChanged(nextLayout);
    // Capture previewRect + dir before clearing resizeRef
    const capturedPreviewRect = this.resizeRef?.previewRect ?? null;
    const capturedDir         = this.resizeRef?.dir ?? null;

    this.resizeRef = null;
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }
    this.removeResizeListeners();

    if (shouldCommit && nextLayout) {
      // ── Snap-to-widget-edge on resize pointerup (Feature 3) ─────
      // Snaps the moving edges of the resize to nearby widget edges.
      // For E/SE handles the right edge snaps; for S/SE the bottom edge.
      // Position (left/top) is snapped for N/W handles.
      if (this.svc.showSnapToWidget() && capturedPreviewRect && capturedDir) {
        const colW   = this.svc.colW();
        const rowH   = this.svc.rowH();
        const others = this.svc.widgets()
          .filter(w => w.id !== this.widget.id)
          .map(w => ({ rect: gridToPixel(w, colW, rowH), id: w.id }));

        const snap = snapToWidgetEdge(capturedPreviewRect, others, SNAP_TO_WIDGET_PX);

        if (snap.snapLeft !== null || snap.snapTop !== null) {
          // Derive new grid x/y/w/h from snapped pixel rect edges
          const origX = this.widget.x;
          const origY = this.widget.y;

          // For handles that move the RIGHT edge, compute new w from snapLeft offset
          // snapLeft represents new left of rect; right edge = snapLeft + capturedPreviewRect.width
          const newLeft = snap.snapLeft ?? capturedPreviewRect.left;
          const newTop  = snap.snapTop  ?? capturedPreviewRect.top;

          // For E/W/SE/SW: use snapped left to derive x and w
          let snappedX = capturedDir.includes('w')
            ? clamp(Math.round((newLeft - GAP) / (colW + GAP)), 0, origX + this.widget.w - 1)
            : origX;
          let snappedW = capturedDir.includes('e')
            ? clamp(
                Math.round(((newLeft + capturedPreviewRect.width) - GAP) / (colW + GAP)) - snappedX,
                1,
                COLS - snappedX
              )
            : capturedDir.includes('w')
              ? (origX + this.widget.w) - snappedX
              : this.widget.w;

          // For N/S/SE/SW: use snapped top to derive y and h
          let snappedY = capturedDir.includes('n')
            ? clamp(Math.round((newTop - GAP) / (rowH + GAP)), 0, origY + this.widget.h - 1)
            : origY;
          let snappedH = capturedDir.includes('s')
            ? clamp(
                Math.round(((newTop + capturedPreviewRect.height) - GAP) / (rowH + GAP)) - snappedY,
                1,
                20
              )
            : capturedDir.includes('n')
              ? (origY + this.widget.h) - snappedY
              : this.widget.h;

          // Guard: ensure dimensions are valid
          snappedW = Math.max(1, Math.min(snappedW, COLS - snappedX));
          snappedH = Math.max(1, snappedH);

          const snappedWidget = { ...this.widget, x: snappedX, y: snappedY, w: snappedW, h: snappedH };
          const snappedLayout = resolveResize(
            this.widget, snappedWidget, capturedDir, this.svc.widgets()
          );
          if (snappedLayout) {
            nextLayout = snappedLayout;
            if (snap.targetId) this.svc.triggerSnapHighlight(snap.targetId);
          }
        }
      }

      this.svc.setWidgetPositions(nextLayout);
      this.svc.commitDragResize();
    } else {
      this.svc.setActive(null);
    }

    this.cdr.markForCheck();
  }

  private scheduleDragPreview(): void {
    if (this.dragRafId !== null) return;
    this.dragRafId = requestAnimationFrame(() => {
      this.dragRafId = null;
      this.applyDragPreview();
    });
  }

  private scheduleResizePreview(): void {
    if (this.resizeRafId !== null) return;
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      this.applyResizePreview();
    });
  }

  private applyDragPreview(): void {
    const ref = this.dragRef;
    if (!ref) return;

    const zoom = this.svc.zoom();
    const scrollDx = (ref.scrollEl?.scrollLeft ?? ref.startScrollLeft) - ref.startScrollLeft;
    const scrollDy = (ref.scrollEl?.scrollTop ?? ref.startScrollTop) - ref.startScrollTop;
    const dx = (ref.latestX - ref.startX + scrollDx) / zoom;
    const dy = (ref.latestY - ref.startY + scrollDy) / zoom;

    ref.translateX = dx;
    ref.translateY = dy;

    if (!ref.engaged) {
      const dragThreshold = ref.pointerType === 'touch'
        ? WidgetCard.DRAG_THRESHOLD_PX * 3
        : WidgetCard.DRAG_THRESHOLD_PX;
      const movedFarEnough =
        Math.abs(dx) >= dragThreshold ||
        Math.abs(dy) >= dragThreshold;

      if (!movedFarEnough) {
        this.cdr.markForCheck();
        return;
      }

      ref.engaged = true;
      this.svc.setActive(this.widget.id);
    }

    // C25 fix: clamp translateX so the dragged card stays within canvas X boundaries.
    // translateX is the raw pixel offset used for transform: translate3d — without clamping
    // the card can visually drift past the left/right canvas edges even though snappedX
    // (the grid commit position) is already bounded. Canvas pixel bounds: [GAP, canvasW - GAP].
    const canvasW = this.svc.canvasW();
    const baseRect = this.pixelRect;
    const minTranslateX = GAP - baseRect.left;
    const maxTranslateX = (canvasW - GAP) - (baseRect.left + baseRect.width);
    ref.translateX = clamp(dx, minTranslateX, maxTranslateX);

    const colW = this.svc.colW();
    const snappedX = clamp(
      ref.origX + Math.round(dx / (colW + GAP)),
      0,
      COLS - this.widget.w
    );
    const snappedY = clamp(
      ref.origY + Math.round(dy / (this.svc.rowH() + GAP)),
      0,
      50
    );

    const resolved = resolveDrag(this.widget, snappedX, snappedY, this.svc.widgets());
    ref.previewLayout = resolved;
    ref.previewRect = gridToPixel(
      resolved?.find(w => w.id === this.widget.id) ?? this.widget,
      colW,
      this.svc.rowH()
    );
    // C26 fix: use previewRect (grid-snapped position) for guide detection so that
    // guides appear exactly when and where snap-to-widget will fire on pointerup.
    // Using the raw translateRect here caused guides to track cursor position instead
    // of grid position, making guides appear/disappear without a corresponding snap.
    this.updateAlignmentGuides(ref.previewRect);

    this.cdr.markForCheck();
  }

  private applyResizePreview(): void {
    const ref = this.resizeRef;
    if (!ref) return;

    const colW = this.svc.colW();
    const zoom = this.svc.zoom();
    const dx = (ref.latestX - ref.startX) / zoom;
    const dy = (ref.latestY - ref.startY) / zoom;
    const snappedWidget = this.buildResizePreviewWidget(ref, dx, dy);

    ref.liveRect = this.buildLiveResizeRect(ref, dx, dy);

    const resolved = resolveResize(this.widget, snappedWidget, ref.dir, this.svc.widgets());
    ref.previewLayout = resolved;
    ref.previewRect = gridToPixel(
      resolved?.find(w => w.id === this.widget.id) ?? snappedWidget,
      colW,
      this.svc.rowH()
    );
    // C26 fix: use previewRect (grid-snapped rect) so resize guides match snap position.
    this.updateAlignmentGuides(ref.previewRect);

    this.cdr.markForCheck();
  }

  private removeDragListeners(): void {
    if (this.dragMoveHandler) document.removeEventListener('pointermove', this.dragMoveHandler);
    if (this.dragUpHandler) document.removeEventListener('pointerup', this.dragUpHandler);
    if (this.dragCancelHandler) document.removeEventListener('pointercancel', this.dragCancelHandler);
  }

  private cancelPendingTouchDrag(): void {
    this.clearTouchDragHoldTimer();
    this.dragRef = null;
    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId);
      this.dragRafId = null;
    }
    this.stopAutoScrollLoop();
    this.removeDragListeners();
    this.svc.setActive(null);
    this.cdr.markForCheck();
  }

  private clearTouchDragHoldTimer(): void {
    if (this.touchDragHoldTimer === null) return;
    clearTimeout(this.touchDragHoldTimer);
    this.touchDragHoldTimer = null;
  }

  private ensureAutoScrollLoop(): void {
    if (this.autoScrollRafId !== null) return;
    this.autoScrollRafId = requestAnimationFrame(() => this.runAutoScrollLoop());
  }

  private stopAutoScrollLoop(): void {
    if (this.autoScrollRafId === null) return;
    cancelAnimationFrame(this.autoScrollRafId);
    this.autoScrollRafId = null;
  }

  private runAutoScrollLoop(): void {
    this.autoScrollRafId = null;

    const ref = this.dragRef;
    if (!ref) return;

    if (ref.engaged && this.applyDragAutoScroll(ref)) {
      this.scheduleDragPreview();
    }

    this.autoScrollRafId = requestAnimationFrame(() => this.runAutoScrollLoop());
  }

  private applyDragAutoScroll(ref: NonNullable<WidgetCard['dragRef']>): boolean {
    const scrollEl = ref.scrollEl;
    if (!scrollEl) return false;

    const bounds = scrollEl.getBoundingClientRect();
    const edge = WidgetCard.AUTO_SCROLL_EDGE_PX;
    const maxStep = WidgetCard.AUTO_SCROLL_MAX_STEP_PX;

    let nextTop = scrollEl.scrollTop;
    let nextLeft = scrollEl.scrollLeft;

    if (ref.latestY < bounds.top + edge) {
      const intensity = clamp((bounds.top + edge - ref.latestY) / edge, 0, 1);
      nextTop = Math.max(0, scrollEl.scrollTop - Math.ceil(maxStep * intensity));
    } else if (ref.latestY > bounds.bottom - edge) {
      const intensity = clamp((ref.latestY - (bounds.bottom - edge)) / edge, 0, 1);
      const maxTop = scrollEl.scrollHeight - scrollEl.clientHeight;
      nextTop = Math.min(maxTop, scrollEl.scrollTop + Math.ceil(maxStep * intensity));
    }

    if (ref.latestX < bounds.left + edge) {
      const intensity = clamp((bounds.left + edge - ref.latestX) / edge, 0, 1);
      nextLeft = Math.max(0, scrollEl.scrollLeft - Math.ceil(maxStep * intensity));
    } else if (ref.latestX > bounds.right - edge) {
      const intensity = clamp((ref.latestX - (bounds.right - edge)) / edge, 0, 1);
      const maxLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
      nextLeft = Math.min(maxLeft, scrollEl.scrollLeft + Math.ceil(maxStep * intensity));
    }

    if (nextTop === scrollEl.scrollTop && nextLeft === scrollEl.scrollLeft) {
      return false;
    }

    scrollEl.scrollTop = nextTop;
    scrollEl.scrollLeft = nextLeft;
    return true;
  }

  private removeResizeListeners(): void {
    if (this.resizeMoveHandler) document.removeEventListener('pointermove', this.resizeMoveHandler);
    if (this.resizeUpHandler) document.removeEventListener('pointerup', this.resizeUpHandler);
    if (this.resizeCancelHandler) document.removeEventListener('pointercancel', this.resizeCancelHandler);
  }

  private gridWidthPx(cols: number): number {
    return cols * (this.svc.colW() + GAP) - GAP;
  }

  private gridHeightPx(rows: number): number {
    return rows * this.svc.rowH() + (rows - 1) * GAP;
  }

  private buildResizePreviewWidget(
    ref: NonNullable<WidgetCard['resizeRef']>,
    dx: number,
    dy: number
  ): Widget {
    const dcols = Math.round(dx / (this.svc.colW() + GAP));
    const drows = Math.round(dy / (this.svc.rowH() + GAP));
    const right = ref.origX + ref.origW;
    const bottom = ref.origY + ref.origH;

    let x = ref.origX;
    let y = ref.origY;
    let w = ref.origW;
    let h = ref.origH;

    if (ref.dir.includes('w')) {
      x = clamp(ref.origX + dcols, Math.max(0, right - COLS), right - 1);
      w = right - x;
    } else if (ref.dir.includes('e')) {
      w = clamp(ref.origW + dcols, 1, COLS - ref.origX);
    }

    if (ref.dir.includes('n')) {
      y = clamp(ref.origY + drows, Math.max(0, bottom - MAX_WIDGET_H), bottom - 1);
      h = bottom - y;
    } else if (ref.dir.includes('s')) {
      h = clamp(ref.origH + drows, 1, MAX_WIDGET_H);
    }

    return {
      ...this.widget,
      x,
      y,
      w,
      h,
    };
  }

  private buildLiveResizeRect(
    ref: NonNullable<WidgetCard['resizeRef']>,
    dx: number,
    dy: number
  ): PixelRect {
    const baseRect = gridToPixel(this.widget, this.svc.colW(), this.svc.rowH());
    const right = baseRect.left + baseRect.width;
    const bottom = baseRect.top + baseRect.height;
    const minWidth = this.gridWidthPx(1);
    const minHeight = this.gridHeightPx(1);
    const maxWidth = ref.dir.includes('w')
      ? this.gridWidthPx(ref.origX + ref.origW)
      : this.gridWidthPx(COLS - ref.origX);
    const maxHeight = ref.dir.includes('n')
      ? this.gridHeightPx(MAX_WIDGET_H)
      : this.gridHeightPx(MAX_WIDGET_H);

    let left = baseRect.left;
    let top = baseRect.top;
    let width = baseRect.width;
    let height = baseRect.height;

    if (ref.dir.includes('w')) {
      left = clamp(baseRect.left + dx, right - maxWidth, right - minWidth);
      width = right - left;
    } else if (ref.dir.includes('e')) {
      width = clamp(baseRect.width + dx, minWidth, maxWidth);
    }

    if (ref.dir.includes('n')) {
      top = clamp(baseRect.top + dy, bottom - maxHeight, bottom - minHeight);
      height = bottom - top;
    } else if (ref.dir.includes('s')) {
      height = clamp(baseRect.height + dy, minHeight, maxHeight);
    }

    return { left, top, width, height };
  }

  private getInteractionRect(): PixelRect | null {
    if (this.dragRef?.engaged) {
      return this.translateRect(this.pixelRect, this.dragRef.translateX, this.dragRef.translateY);
    }

    return this.resizeRef?.liveRect ?? null;
  }

  private translateRect(rect: PixelRect, dx: number, dy: number): PixelRect {
    return {
      left: rect.left + dx,
      top: rect.top + dy,
      width: rect.width,
      height: rect.height,
    };
  }

  private sameRect(a: PixelRect, b: PixelRect): boolean {
    return (
      Math.abs(a.left - b.left) < 0.5 &&
      Math.abs(a.top - b.top) < 0.5 &&
      Math.abs(a.width - b.width) < 0.5 &&
      Math.abs(a.height - b.height) < 0.5
    );
  }

  private updateAlignmentGuides(source: PixelRect): void {
    if (!this.svc.showAlignmentGuides()) {
      this.svc.setAlignmentGuides([]);
      return;
    }

    this.svc.setAlignmentGuides(this.buildAlignmentGuides(source));
  }

  private buildAlignmentGuides(source: PixelRect): AlignmentGuide[] {
    const others = this.svc.widgets()
      .filter(widget => widget.id !== this.widget.id)
      .map(widget => gridToPixel(widget, this.svc.colW(), this.svc.rowH()));

    if (!others.length) return [];

    const guides: AlignmentGuide[] = [];
    const vertical = this.findClosestAlignmentGuide(source, others, 'x');
    const horizontal = this.findClosestAlignmentGuide(source, others, 'y');

    if (vertical) guides.push(vertical);
    if (horizontal) guides.push(horizontal);

    return guides;
  }

  private findClosestAlignmentGuide(
    source: PixelRect,
    others: PixelRect[],
    axis: 'x' | 'y'
  ): AlignmentGuide | null {
    const threshold = WidgetCard.ALIGNMENT_THRESHOLD_PX;
    const sourcePoints = axis === 'x'
      ? [source.left, source.left + source.width / 2, source.left + source.width]
      : [source.top, source.top + source.height / 2, source.top + source.height];

    let bestGuide: AlignmentGuide | null = null;
    let bestDelta = threshold + 1;

    for (const other of others) {
      const otherPoints = axis === 'x'
        ? [other.left, other.left + other.width / 2, other.left + other.width]
        : [other.top, other.top + other.height / 2, other.top + other.height];

      for (const sourcePoint of sourcePoints) {
        for (const otherPoint of otherPoints) {
          const delta = Math.abs(sourcePoint - otherPoint);
          if (delta > threshold || delta >= bestDelta) continue;

          const start = axis === 'x'
            ? Math.min(source.top, other.top)
            : Math.min(source.left, other.left);
          const end = axis === 'x'
            ? Math.max(source.top + source.height, other.top + other.height)
            : Math.max(source.left + source.width, other.left + other.width);

          bestGuide = {
            axis,
            pos: otherPoint,
            start,
            end,
          };
          bestDelta = delta;
        }
      }
    }

    return bestGuide;
  }

  private layoutChanged(next: Widget[]): boolean {
    const current = this.svc.widgets();
    if (current.length !== next.length) return true;

    return next.some((widget, index) => {
      const prev = current[index];
      return !prev ||
        prev.id !== widget.id ||
        prev.x !== widget.x ||
        prev.y !== widget.y ||
        prev.w !== widget.w ||
        prev.h !== widget.h;
    });
  }

  private shouldIgnoreDragStart(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;

    return !!el.closest(
      'button, input, textarea, select, option, a, .action-btn, .resize-handle, [data-no-drag], [contenteditable="true"]'
    );
  }

  private isPrimaryPointer(e: PointerEvent): boolean {
    return e.isPrimary && (e.pointerType !== 'mouse' || e.button === 0);
  }

  private getScrollArea(): HTMLElement | null {
    return document.querySelector('.scroll-area');
  }

}
