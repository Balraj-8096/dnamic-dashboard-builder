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
import { gridToPixel, resolveDrag, resolveResize } from '../../core/layout.utils';
import {
  COLS,
  GAP,
  HDR_H,
  MAX_WIDGET_H,
  ROW_H,
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
  private touchDragHoldTimer: number | null = null;

  private dragMoveHandler!: (e: PointerEvent) => void;
  private dragUpHandler!: (e: PointerEvent) => void;
  private dragCancelHandler!: (e: PointerEvent) => void;
  private resizeMoveHandler!: (e: PointerEvent) => void;
  private resizeUpHandler!: (e: PointerEvent) => void;
  private resizeCancelHandler!: (e: PointerEvent) => void;

  get pixelRect(): PixelRect {
    return gridToPixel(this.widget, this.svc.colW());
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

  get isFront(): boolean {
    return this.svc.frontId() === this.widget.id;
  }

  get isAnimating(): boolean {
    return this.svc.animatingId() === this.widget.id;
  }

  get isLocked(): boolean {
    return this.widget.locked;
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
    if (this.isFront) return 100;
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

  onBringFront(e: MouseEvent): void {
    e.stopPropagation();
    this.svc.bringFront(this.widget.id);
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
    };

    this.dragMoveHandler = (mv: PointerEvent) => this.onDragMove(mv);
    this.dragUpHandler = (up: PointerEvent) => this.onDragUp(up);
    this.dragCancelHandler = (cancel: PointerEvent) => this.onDragUp(cancel);
    document.addEventListener('pointermove', this.dragMoveHandler);
    document.addEventListener('pointerup', this.dragUpHandler);
    document.addEventListener('pointercancel', this.dragCancelHandler);

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

    const baseRect = gridToPixel(this.widget, this.svc.colW());
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

    const nextLayout = this.dragRef?.previewLayout ?? null;
    const shouldCommit = !!this.dragRef?.engaged && !!nextLayout && this.layoutChanged(nextLayout);

    this.clearTouchDragHoldTimer();
    this.dragRef = null;
    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId);
      this.dragRafId = null;
    }
    this.removeDragListeners();

    if (shouldCommit && nextLayout) {
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

    const nextLayout = this.resizeRef?.previewLayout ?? null;
    const shouldCommit = !!nextLayout && this.layoutChanged(nextLayout);

    this.resizeRef = null;
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }
    this.removeResizeListeners();

    if (shouldCommit && nextLayout) {
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
    const dx = (ref.latestX - ref.startX) / zoom;
    const dy = (ref.latestY - ref.startY) / zoom;

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

    const colW = this.svc.colW();
    const snappedX = clamp(
      ref.origX + Math.round(dx / (colW + GAP)),
      0,
      COLS - this.widget.w
    );
    const snappedY = clamp(
      ref.origY + Math.round(dy / (ROW_H + GAP)),
      0,
      50
    );

    const resolved = resolveDrag(this.widget, snappedX, snappedY, this.svc.widgets());
    ref.previewLayout = resolved;
    ref.previewRect = gridToPixel(
      resolved?.find(w => w.id === this.widget.id) ?? this.widget,
      colW
    );
    this.updateAlignmentGuides(
      this.translateRect(this.pixelRect, ref.translateX, ref.translateY)
    );

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
      colW
    );
    this.updateAlignmentGuides(ref.liveRect);

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
    this.removeDragListeners();
    this.svc.setActive(null);
    this.cdr.markForCheck();
  }

  private clearTouchDragHoldTimer(): void {
    if (this.touchDragHoldTimer === null) return;
    clearTimeout(this.touchDragHoldTimer);
    this.touchDragHoldTimer = null;
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
    return rows * ROW_H + (rows - 1) * GAP;
  }

  private buildResizePreviewWidget(
    ref: NonNullable<WidgetCard['resizeRef']>,
    dx: number,
    dy: number
  ): Widget {
    const dcols = Math.round(dx / (this.svc.colW() + GAP));
    const drows = Math.round(dy / (ROW_H + GAP));
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
    const baseRect = gridToPixel(this.widget, this.svc.colW());
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
      .map(widget => gridToPixel(widget, this.svc.colW()));

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

}
