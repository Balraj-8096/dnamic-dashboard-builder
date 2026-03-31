import { Injectable, signal, inject } from '@angular/core';

import { BrandEntry, ClientBrandConfig } from '../core/brand.interfaces';
import { ThemeService }                  from './theme.service';

const STORAGE_KEY    = 'dashcraft-brand';
const BRANDS_BASE    = '/assets/brands';

@Injectable({ providedIn: 'root' })
export class BrandService {

  private readonly themeSvc = inject(ThemeService);

  // ── Public signals ────────────────────────────────────────────────────────

  private readonly _availableBrands = signal<BrandEntry[]>([]);
  private readonly _activeBrandId   = signal<string>('default');

  /** Full list loaded from _index.json — used by the toolbar picker. */
  readonly availableBrands = this._availableBrands.asReadonly();

  /** Currently active clientId — bound to the picker selected value. */
  readonly activeBrandId = this._activeBrandId.asReadonly();

  // ── APP_INITIALIZER entry point ───────────────────────────────────────────

  /**
   * Called once by provideAppInitializer before Angular renders anything.
   * Uses native fetch() — not HttpClient — so it bypasses all interceptors.
   * Failures in the brand load never block the app from starting.
   */
  async init(): Promise<void> {
    const clientId = this.resolveClientId();
    this._activeBrandId.set(clientId);

    // Run independently — brand load failure must not prevent index load, and vice versa
    const [indexResult] = await Promise.allSettled([
      this.fetchJson<BrandEntry[]>(`${BRANDS_BASE}/_index.json`),
      this.fetchAndApply(clientId),
    ]);

    if (indexResult.status === 'fulfilled') {
      this._availableBrands.set(indexResult.value);
    } else {
      console.warn('[BrandService] Could not load brand index', indexResult.reason);
    }
  }

  // ── Runtime brand switching (toolbar dropdown) ────────────────────────────

  async selectBrand(clientId: string): Promise<void> {
    this._activeBrandId.set(clientId);

    if (clientId === 'default') {
      localStorage.removeItem(STORAGE_KEY);
      this.themeSvc.applyBrand(null);
    } else {
      localStorage.setItem(STORAGE_KEY, clientId);
      await this.fetchAndApply(clientId);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Priority chain for determining which brand to load:
   *  1. ?brand= URL param  → persisted to localStorage so /view/:id keeps it
   *  2. localStorage value → survives SPA route changes
   *  3. 'default'          → DASHCRAFT baseline, no token overrides
   */
  private resolveClientId(): string {
    const params  = new URLSearchParams(window.location.search);
    const fromUrl = params.get('brand');

    if (fromUrl) {
      if (fromUrl === 'default') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, fromUrl);
      }
      return fromUrl;
    }

    return localStorage.getItem(STORAGE_KEY) ?? 'default';
  }

  private async fetchAndApply(clientId: string): Promise<void> {
    if (clientId === 'default') {
      this.themeSvc.applyBrand(null);
      return;
    }
    try {
      const config = await this.fetchJson<ClientBrandConfig>(`${BRANDS_BASE}/${clientId}.json`);
      this.themeSvc.applyBrand(config);
    } catch (err) {
      console.warn(`[BrandService] Could not load brand "${clientId}" — reverting to default`, err);
      this.themeSvc.applyBrand(null);
    }
  }

  /** Native fetch — bypasses HttpClient interceptors (auth, logging, error). */
  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json() as Promise<T>;
  }
}
