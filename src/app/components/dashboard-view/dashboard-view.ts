import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { fromEvent, Subject, takeUntil } from 'rxjs';

import { getTypeBreakdown } from '../../core/catalog';
import { COLS, MIN_CANVAS_W } from '../../core/constants';
import { computeColW, computeCanvasH } from '../../core/layout.utils';
import { Widget } from '../../core/interfaces';
import { DashboardService } from '../../services/dashboard.service';
import { AppConfigService } from '../../services/app-config.service';
import { DashboardApiService } from '../../services/api/dashboard-api.service';
import { ViewWidgetCard } from '../shared/view-widget-card/view-widget-card';
import { Minimap } from '../minimap/minimap';
import { GlobalFilterBarComponent } from '../shared/global-filter-bar/global-filter-bar';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-dashboard-view',
  imports: [ViewWidgetCard, Minimap, GlobalFilterBarComponent],
  templateUrl: './dashboard-view.html',
  styleUrl: './dashboard-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardView implements OnInit, OnDestroy {
  private readonly router    = inject(Router);
  private readonly route     = inject(ActivatedRoute);
  readonly svc               = inject(DashboardService);
  private readonly configSvc = inject(AppConfigService);
  private readonly api       = inject(DashboardApiService);
  private readonly cdr       = inject(ChangeDetectorRef);

  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLElement>;
  @ViewChild('mainRef',   { static: true }) mainRef!:   ElementRef<HTMLElement>;

  // ── Remote-load signals ───────────────────────────────────────
  private readonly _loadState     = signal<LoadState>('idle');
  private readonly _remoteTitle   = signal<string>('');
  private readonly _remoteWidgets = signal<Widget[]>([]);

  /** 'live' = read DashboardService signals (builder session)
   *  'remote' = loaded from API by route :id param             */
  private readonly _viewMode = signal<'live' | 'remote'>('live');

  readonly loadState    = this._loadState.asReadonly();
  readonly isRemoteMode = computed(() => this._viewMode() === 'remote');

  // ── Display-layer computed signals ────────────────────────────
  readonly displayWidgets = computed<Widget[]>(() =>
    this._viewMode() === 'remote' ? this._remoteWidgets() : this.svc.widgets()
  );

  readonly displayTitle = computed(() =>
    this._viewMode() === 'remote' ? this._remoteTitle() : this.svc.dashTitle()
  );

  readonly typeBreakdown = computed(() => getTypeBreakdown(this.displayWidgets()));
  readonly widgetCount   = computed(() => this.displayWidgets().length);
  readonly lockedCount   = computed(() => this.displayWidgets().filter(w => w.locked).length);

  // ── Local UI state ────────────────────────────────────────────
  colW    = computeColW(typeof window !== 'undefined' ? window.innerWidth : 1200);
  canvasH = 600;
  now     = new Date();
  isFullscreen = false;

  readonly COLS = COLS;
  get rowH():       number  { return this.svc.rowH(); }
  get showMinimap(): boolean { return this.svc.showMinimap(); }

  get timeStr(): string {
    return this.now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  get dateStr(): string {
    return this.now.toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  private clockTimer?: ReturnType<typeof setInterval>;
  private resizeObserver?: ResizeObserver;
  private onFullscreenChange!: () => void;
  private readonly destroy$ = new Subject<void>();

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const main   = this.mainRef.nativeElement;

    this._measure();

    fromEvent(main, 'scroll')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.svc.setScrollTop(main.scrollTop));

    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this._measure());
    });
    this.resizeObserver.observe(canvas);

    this.clockTimer = setInterval(() => {
      this.now = new Date();
      this.cdr.markForCheck();
    }, 60_000);

    this.onFullscreenChange = () => {
      this.isFullscreen = !!document.fullscreenElement;
      this.cdr.markForCheck();
    };
    document.addEventListener('fullscreenchange', this.onFullscreenChange);

    // Esc key — exit fullscreen first, then go back on next press
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntil(this.destroy$))
      .subscribe(e => {
        if (e.key === 'Escape' && !document.fullscreenElement) {
          this.goBack();
        }
      });

    // Route param: if :id is present and API mode is active, load remotely
    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.configSvc.useRealApi()) {
      this.loadFromApi(id);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resizeObserver?.disconnect();
    clearInterval(this.clockTimer);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }

  // ── API load ──────────────────────────────────────────────────
  private loadFromApi(id: string): void {
    this._viewMode.set('remote');
    this._loadState.set('loading');

    this.api.get(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: payload => {
          this._remoteTitle.set(payload.title);
          this._remoteWidgets.set(payload.widgets);
          this._loadState.set('loaded');
          // Re-measure now that remote widgets are available
          requestAnimationFrame(() => this._measure());
        },
        error: () => {
          this._loadState.set('error');
        },
      });
  }

  // ── Internal ──────────────────────────────────────────────────
  private _measure(): void {
    const w         = this.canvasRef.nativeElement.offsetWidth || window.innerWidth;
    const viewportH = this.mainRef.nativeElement.clientHeight;
    this.colW       = computeColW(Math.max(w, MIN_CANVAS_W));
    this.canvasH    = computeCanvasH(this.displayWidgets(), this.svc.rowH(), viewportH);
    this.svc.setCanvasW(w);
    this.svc.setViewportH(viewportH);
    this.svc.setScrollTop(this.mainRef.nativeElement.scrollTop);
    this.cdr.markForCheck();
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
  goBack(): void { this.router.navigate(['/dashboards']); }

  trackWidget(_: number, widget: { id: string }): string { return widget.id; }
}
