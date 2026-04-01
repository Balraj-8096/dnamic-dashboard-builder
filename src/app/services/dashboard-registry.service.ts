import { Injectable, signal, computed } from '@angular/core';

import { DashboardRecord } from '../core/interfaces';

// ── localStorage keys ──────────────────────────────────────────────────────────

const REGISTRY_KEY         = 'dashcraft-dashboard-registry';
const ACTIVE_DASHBOARD_KEY = 'dashcraft-active-dashboard-id';

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * DashboardRegistryService — lightweight client-side registry of all dashboard
 * metadata records.  Does NOT store widget arrays; those live in the backend
 * (real-API mode) or per-dashboard localStorage keys (mock mode).
 *
 * Responsibilities:
 *   - Persist a `DashboardRecord[]` list to localStorage under
 *     `dashcraft-dashboard-registry` so the DashboardList page can render
 *     immediately without an API round-trip.
 *   - Track which dashboard is currently open in the builder
 *     (`activeDashboardId`) so the list page can highlight it.
 *   - Provide CRUD helpers used by DashboardList and Canvas:
 *       create(id, title)  — add a new record
 *       upsert(record)     — add-or-update (called on every save to keep
 *                            `updatedAt` and `widgetCount` fresh)
 *       rename(id, title)  — update title only
 *       remove(id)         — delete record
 *       setActive(id)      — record which dashboard is open in the builder
 *
 * Backward-compat migration:
 *   On first load, if `dashcraft-dashboard-id` exists but the registry is
 *   empty, a stub record is seeded so existing single-dashboard users don't
 *   lose their dashboard reference.
 *
 * localStorage safety:
 *   All localStorage access is wrapped in try/catch via safeGet/safeSet/
 *   safeRemove helpers.  This prevents crashes in:
 *     - Safari Private mode (throws SecurityError on access)
 *     - Browser quota-exceeded scenarios
 *     - SSR contexts where localStorage is not defined
 *   In all these cases the service degrades gracefully to in-memory-only state.
 */
@Injectable({ providedIn: 'root' })
export class DashboardRegistryService {

  // ── Signals ───────────────────────────────────────────────────────────────

  private readonly _records = signal<DashboardRecord[]>(this.loadRecords());

  /** Active dashboard ID — the one currently open in /builder. */
  readonly activeDashboardId = signal<string | null>(
    this.safeGet(ACTIVE_DASHBOARD_KEY)
  );

  /** Public read-only view of the registry. */
  readonly records = this._records.asReadonly();

  /** Convenience: total count of known dashboards. */
  readonly count = computed(() => this._records().length);

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register a newly created dashboard.
   * Calling this more than once with the same id is a no-op (use upsert to
   * update an existing record).
   */
  create(id: string, title: string): void {
    if (this._records().some(r => r.id === id)) return;
    this._records.update(list => [
      ...list,
      { id, title, updatedAt: Date.now(), widgetCount: 0 },
    ]);
    this.persist();
  }

  /**
   * Add or update a record.  Called after every successful save so that
   * the list page always shows current title / widget count / timestamp.
   */
  upsert(record: DashboardRecord): void {
    this._records.update(list => {
      const idx = list.findIndex(r => r.id === record.id);
      if (idx === -1) return [...list, record];
      const next = [...list];
      next[idx] = record;
      return next;
    });
    this.persist();
  }

  /** Update the display title of an existing record. */
  rename(id: string, title: string): void {
    this._records.update(list =>
      list.map(r => r.id === id ? { ...r, title } : r)
    );
    this.persist();
  }

  /** Remove a record by id.  Safe to call for non-existent ids. */
  remove(id: string): void {
    this._records.update(list => list.filter(r => r.id !== id));
    if (this.activeDashboardId() === id) this.setActive(null);
    this.persist();
  }

  /**
   * Record which dashboard is currently open in the builder.
   * Persisted so a page reload at /builder/:id still highlights the card.
   */
  setActive(id: string | null): void {
    this.activeDashboardId.set(id);
    if (id) {
      this.safeSet(ACTIVE_DASHBOARD_KEY, id);
    } else {
      this.safeRemove(ACTIVE_DASHBOARD_KEY);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private loadRecords(): DashboardRecord[] {
    const raw = this.safeGet(REGISTRY_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DashboardRecord[];
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Corrupted JSON — fall through to migration path
      }
    }

    // Backward-compat: if the app has an existing single-dashboard session,
    // seed a stub record so the existing dashboard appears in the list.
    const legacyId = this.safeGet('dashcraft-dashboard-id');
    if (legacyId) {
      const stub: DashboardRecord = {
        id:          legacyId,
        title:       'My Dashboard',
        updatedAt:   Date.now(),
        widgetCount: 0,
      };
      return [stub];
    }

    return [];
  }

  private persist(): void {
    this.safeSet(REGISTRY_KEY, JSON.stringify(this._records()));
  }

  // ── localStorage wrappers ─────────────────────────────────────────────────
  // All three methods absorb any localStorage error (quota exceeded, Safari
  // private mode SecurityError, SSR ReferenceError) and degrade gracefully.

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or access denied — in-memory state still valid.
    }
  }

  private safeRemove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore — in-memory state already updated.
    }
  }
}
