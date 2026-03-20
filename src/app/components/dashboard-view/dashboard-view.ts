import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, Subject, takeUntil } from 'rxjs';
import { getTypeBreakdown } from '../../core/catalog';
import { COLS, MIN_CANVAS_W, ROW_H } from '../../core/constants';
import { computeColW, computeCanvasH } from '../../core/layout.utils';
import { DashboardService } from '../../services/dashboard.service';
import { ViewWidgetCard } from "../shared/view-widget-card/view-widget-card";
import { Minimap } from "../minimap/minimap";
import { GlobalFilterBarComponent } from "../shared/global-filter-bar/global-filter-bar";

@Component({
  selector: 'app-dashboard-view',
  imports: [ViewWidgetCard, Minimap, GlobalFilterBarComponent],
  templateUrl: './dashboard-view.html',
  styleUrl: './dashboard-view.scss',
})
export class DashboardView  implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly svc            = inject(DashboardService);
 
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLElement>;
  @ViewChild('mainRef',   { static: true }) mainRef!:   ElementRef<HTMLElement>;
 
  // ── Local view-mode state ─────────────────────────────────────
  // Seed colW immediately from window so first render is correct.
  // ResizeObserver then keeps it accurate as the window resizes.
  colW    = computeColW(typeof window !== 'undefined' ? window.innerWidth : 1200);
  canvasH = 600;
  now     = new Date();
  isFullscreen = false;
 
  readonly COLS  = COLS;
  readonly ROW_H = ROW_H;
 
  private clockTimer?: ReturnType<typeof setInterval>;
  private resizeObserver?: ResizeObserver;
  private onFullscreenChange!: () => void;
  private readonly destroy$ = new Subject<void>();
 
  // ── Derived ───────────────────────────────────────────────────
  get widgets()       { return this.svc.widgets(); }
  get dashTitle()     { return this.svc.dashTitle(); }
  get widgetCount()   { return this.svc.widgetCount(); }
  get lockedCount()   { return this.svc.lockedCount(); }
  get showMinimap()   { return this.svc.showMinimap(); }
  get typeBreakdown() { return getTypeBreakdown(this.widgets); }
 
  get timeStr() {
    return this.now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
 
  get dateStr() {
    return this.now.toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }
 
  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const main = this.mainRef.nativeElement;
 
    // Measure immediately on init — do NOT wait for ResizeObserver's first
    // callback, which fires asynchronously and causes the blank-layout flash.
    this._measure();

    fromEvent(main, 'scroll')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.svc.setScrollTop(main.scrollTop));
 
    // ResizeObserver keeps colW accurate on window resize
    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this._measure());
    });
    this.resizeObserver.observe(canvas);
 
    // Live clock — tick every 60 seconds
    this.clockTimer = setInterval(() => { this.now = new Date(); }, 60_000);
 
    // Fullscreen change listener
    this.onFullscreenChange = () => {
      this.isFullscreen = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }
 
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resizeObserver?.disconnect();
    clearInterval(this.clockTimer);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }
 
  private _measure(): void {
    // offsetWidth of the canvas element — falls back to window width minus
    // any chrome (header/footer are negligible for column math).
    const w = this.canvasRef.nativeElement.offsetWidth || window.innerWidth;
    this.colW    = computeColW(Math.max(w, MIN_CANVAS_W));
    this.canvasH = computeCanvasH(this.widgets);
    this.svc.setCanvasW(w);
    this.svc.setViewportH(this.mainRef.nativeElement.clientHeight);
    this.svc.setScrollTop(this.mainRef.nativeElement.scrollTop);
  }
 
  // ── Keyboard ──────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    // CRITICAL: !document.fullscreenElement guard prevents double-navigation.
    // Browser fires 'fullscreenchange' BEFORE 'keydown' when Esc exits
    // fullscreen, so by the time we see Esc, fullscreenElement is already null.
    if (e.key === 'Escape' && !document.fullscreenElement) {
      this.goBack();
    }
  }
 
  // ── Fullscreen ────────────────────────────────────────────────
  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
 
  // ── Navigation ────────────────────────────────────────────────
  goBack(): void { this.router.navigate(['/builder']); }
 
  trackWidget(_: number, widget: { id: string }): string { return widget.id; }
}
