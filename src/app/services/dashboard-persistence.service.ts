import {
  Injectable, inject, signal, computed,
  effect, untracked, OnDestroy,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { DashboardService }          from './dashboard.service';
import { AppConfigService }          from './app-config.service';
import { DashboardApiService }       from './api/dashboard-api.service';
import { DashboardRegistryService }  from './dashboard-registry.service';
import { MOCK_DASHBOARD_PAYLOADS }   from '../test-cases/mock-dashboards';
import { Widget } from '../core/interfaces';

// ── Save status ───────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounce window (ms) between the last widget/title change and the HTTP save.
 * Short enough to feel responsive; long enough to batch rapid edits (e.g. drag
 * commits, quick widget adds) into a single request.
 */
const SAVE_DEBOUNCE_MS = 800;

/** How long "Saved" confirmation stays visible before resetting to "idle". */
const SAVED_RESET_MS = 3000;

/** localStorage key that holds the client-generated dashboard UUID. */
const DASHBOARD_ID_KEY = 'dashcraft-dashboard-id';

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * DashboardPersistenceService — bridges in-memory signal state to the backend.
 *
 * Responsibility:
 *   - Watches `DashboardService.widgets()` and `DashboardService.dashTitle()`
 *   - Debounces rapid changes (drag/resize, typing) into a single PUT per burst
 *   - Only calls the API when `AppConfigService.useRealApi()` is true
 *   - Exposes a `saveStatus` signal so the toolbar can show "Saving…" / "Saved" / "Error"
 *   - Provides `load(id)` and `forceSave()` for on-demand operations
 *
 * Dashboard identity:
 *   The dashboard ID is a UUID persisted in localStorage under `dashcraft-dashboard-id`.
 *   On first save, if no server record exists the service calls `create()` and
 *   updates the stored ID with the server-assigned value.
 *
 * Lifecycle:
 *   Instantiate by injecting this service in a long-lived component (Canvas).
 *   The `effect()` and RxJS pipeline are self-managing; call nothing manually for
 *   auto-save to work — it activates the moment widgets or title change.
 */
@Injectable({ providedIn: 'root' })
export class DashboardPersistenceService implements OnDestroy {

  private readonly svc       = inject(DashboardService);
  private readonly configSvc = inject(AppConfigService);
  private readonly api       = inject(DashboardApiService);
  private readonly registry  = inject(DashboardRegistryService);

  // ── Dashboard identity ────────────────────────────────────────────────────

  /** Client-generated UUID, stable across page reloads via localStorage. */
  private readonly _dashboardId = signal<string>(this.initDashboardId());
  readonly dashboardId = this._dashboardId.asReadonly();

  // ── Save status ───────────────────────────────────────────────────────────

  private readonly _saveStatus = signal<SaveStatus>('idle');
  readonly saveStatus = this._saveStatus.asReadonly();

  readonly isSaving = computed(() => this._saveStatus() === 'saving');
  readonly hasSaveError = computed(() => this._saveStatus() === 'error');

  // ── Internal plumbing ─────────────────────────────────────────────────────

  /**
   * Every time widgets or title change, a void is pushed here.
   * The debounced pipeline downstream turns it into a real API call.
   */
  private readonly saveTrigger$ = new Subject<void>();
  private readonly destroy$     = new Subject<void>();
  private saveSub?: Subscription;
  private resetTimer?: ReturnType<typeof setTimeout>;

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor() {
    // Wire debounced auto-save pipeline.
    this.saveTrigger$
      .pipe(debounceTime(SAVE_DEBOUNCE_MS), takeUntil(this.destroy$))
      .subscribe(() => this.executeSave());

    // React to any widget or title change and schedule a save.
    effect(() => {
      // Establish reactive dependencies — reading these signals registers them.
      this.svc.widgets();
      this.svc.dashTitle();

      // Push a save trigger outside the effect's reactive context so Angular
      // doesn't complain about writes during change-detection.
      untracked(() => this.saveTrigger$.next());
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Load a dashboard by ID and replace current canvas state.
   * Preserves original widget IDs (uses loadLayout, not importLayout).
   *
   * @param id          Dashboard UUID to load.
   * @param onNotFound  Optional callback invoked when the server returns 404.
   *                    Use this to redirect to /dashboards in the caller.
   */
  load(id: string, onNotFound?: () => void): void {
    if (!this.configSvc.useRealApi()) {
      // Mock mode: load from MOCK_DASHBOARD_PAYLOADS if available.
      const payload = MOCK_DASHBOARD_PAYLOADS[id];
      if (!payload || !Array.isArray(payload.widgets)) { onNotFound?.(); return; }
      this._dashboardId.set(id);
      this.svc.loadLayout({ title: payload.title, widgets: payload.widgets as Widget[] });
      return;
    }

    this._saveStatus.set('saving'); // reuse "saving" as "loading" indicator
    this.saveSub?.unsubscribe();

    this.saveSub = this.api.get(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: payload => {
          // Guard against malformed API response — treat as not-found.
          if (!payload || !Array.isArray(payload.widgets)) {
            onNotFound?.();
            return;
          }
          this._dashboardId.set(payload.id);
          localStorage.setItem(DASHBOARD_ID_KEY, payload.id);
          // loadLayout preserves original widget IDs (unlike importLayout which
          // regenerates them — C19 fix was for file import only, not API loads).
          this.svc.loadLayout({ title: payload.title, widgets: payload.widgets });
          this.setStatus('saved');
        },
        error: err => {
          const status = (err as { status?: number }).status;
          if (status === 404) {
            onNotFound?.();
          } else {
            this.setStatus('error');
          }
        },
      });
  }

  /**
   * Assign a fresh UUID for a brand-new (unsaved) dashboard session.
   * Called when the builder is opened without a route :id param so that
   * any subsequent auto-save targets a new record, not the previously
   * opened dashboard. C-N1 fix.
   */
  initForNewDashboard(): void {
    const newId = crypto.randomUUID();
    this._dashboardId.set(newId);
    try { localStorage.setItem(DASHBOARD_ID_KEY, newId); } catch { /* quota / private mode */ }
  }

  /**
   * Bypass the debounce and save immediately.
   * Useful for explicit "Save" buttons or before navigation.
   */
  forceSave(): void {
    this.executeSave();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private executeSave(): void {
    // No-op in mock mode — nothing to persist.
    if (!this.configSvc.useRealApi()) return;

    const id      = this._dashboardId();
    const title   = this.svc.dashTitle();
    const widgets = this.svc.widgets();

    this._saveStatus.set('saving');
    this.saveSub?.unsubscribe();

    this.saveSub = this.api.save(id, { title, widgets })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          // Server may have assigned or normalised the ID — honour it.
          const finalId = (result.id && result.id !== id) ? result.id : id;
          if (finalId !== id) {
            this._dashboardId.set(finalId);
            localStorage.setItem(DASHBOARD_ID_KEY, finalId);
          }
          this.registry.upsert({
            id:          finalId,
            title,
            updatedAt:   Date.now(),
            widgetCount: widgets.length,
          });
          this.setStatus('saved');
        },
        error: err => {
          // If the server returns 404 (no record yet), try creating it.
          const status = (err as { status?: number }).status;
          if (status === 404) {
            this.createAndSave(id, title, widgets);
          } else {
            this.setStatus('error');
          }
        },
      });
  }

  /**
   * Called on first save when the server has no record yet (404 from PUT).
   * Sends a POST to create the dashboard, then stores the server-assigned ID.
   */
  private createAndSave(
    clientId: string,
    title:    string,
    widgets:  ReturnType<typeof this.svc.widgets>,
  ): void {
    this.saveSub?.unsubscribe();

    this.saveSub = this.api.create({ id: clientId, title, widgets })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          const finalId = (result.id && result.id !== clientId) ? result.id : clientId;
          if (finalId !== clientId) {
            this._dashboardId.set(finalId);
            localStorage.setItem(DASHBOARD_ID_KEY, finalId);
          }
          this.registry.upsert({
            id:          finalId,
            title,
            updatedAt:   Date.now(),
            widgetCount: widgets.length,
          });
          this.setStatus('saved');
        },
        error: () => this.setStatus('error'),
      });
  }

  /** Updates save status and auto-resets "saved" to "idle" after SAVED_RESET_MS. */
  private setStatus(status: SaveStatus): void {
    this._saveStatus.set(status);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    if (status === 'saved') {
      this.resetTimer = setTimeout(
        () => this._saveStatus.set('idle'),
        SAVED_RESET_MS,
      );
    }
  }

  /** Returns the stored dashboard ID or creates and stores a new UUID. */
  private initDashboardId(): string {
    const stored = localStorage.getItem(DASHBOARD_ID_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(DASHBOARD_ID_KEY, id);
    return id;
  }
}
