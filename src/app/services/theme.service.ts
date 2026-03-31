import { Injectable, signal, effect } from '@angular/core';
import { ClientBrandConfig, BrandColorTokens } from '../core/brand.interfaces';

export type Theme = 'dark' | 'light';

// Every CSS custom property that a brand config may override.
// These are removed before re-applying so switching brands/themes is clean.
const BRAND_TOKENS: string[] = [
  '--acc', '--acc2', '--grn', '--red', '--amb', '--pur',
  '--bg0', '--bg1', '--bg2', '--bg3', '--bg4',
  '--txt0', '--txt1', '--txt2',
  '--bdr', '--bdrH', '--bdrA',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4',
  '--chart-5', '--chart-6', '--chart-7', '--chart-8',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl',
  '--font-sans',
];

@Injectable({ providedIn: 'root' })
export class ThemeService {

  readonly theme = signal<Theme>(
    (localStorage.getItem('dashcraft-theme') as Theme) ?? 'dark',
  );

  private readonly _activeBrand = signal<ClientBrandConfig | null>(null);

  /** Tracks font family names already injected to avoid duplicate <link> tags. */
  private readonly _loadedFonts = new Set<string>();

  constructor() {
    // Apply theme immediately — before effect microtask fires — to prevent flash
    document.documentElement.setAttribute('data-theme', this.theme());

    // Re-apply both theme attribute and brand tokens whenever either signal changes.
    // Reading _activeBrand() here makes Angular track it as a dependency,
    // so the effect re-runs on theme toggle AND brand switch.
    effect(() => {
      const t     = this.theme();
      const brand = this._activeBrand();

      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('dashcraft-theme', t);
      this.injectBrandTokens(t, brand);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  toggle(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  /**
   * Called by BrandService after loading a brand JSON.
   * Pass null to clear all overrides and revert to DASHCRAFT defaults.
   * Applies synchronously so APP_INITIALIZER tokens land before first render.
   */
  applyBrand(config: ClientBrandConfig | null): void {
    this._activeBrand.set(config);

    // Synchronous apply — the effect() above fires asynchronously (microtask),
    // but APP_INITIALIZER needs tokens on the DOM before any component mounts.
    this.injectBrandTokens(this.theme(), config);

    // Font and favicon are not CSS tokens — handle separately
    if (config?.fontUrl && config.fontFamily) {
      this.loadFont(config.fontUrl, config.fontFamily);
    }
    if (config?.faviconUrl) {
      this.applyFavicon(config.faviconUrl);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private injectBrandTokens(theme: Theme, config: ClientBrandConfig | null): void {
    const root = document.documentElement;

    // Always wipe previous brand overrides first so switching brands is clean
    this.clearBrandTokens(root);

    if (!config) return;

    // Shape → radius tokens
    this.applyShape(root, config.shape);

    // Font family (URL loading handled in applyBrand / loadFont)
    if (config.fontFamily) {
      root.style.setProperty('--font-sans', `'${config.fontFamily}', sans-serif`);
    }

    // Color tokens — use the theme-specific variant or fall back to dark
    const tokens: BrandColorTokens | undefined = config[theme] ?? config.dark;
    if (!tokens) return;

    const set = (prop: string, val?: string) => {
      if (val) root.style.setProperty(prop, val);
    };

    // Tier 1 — accents
    set('--acc',  tokens.accent);
    set('--acc2', tokens.accentSoft);
    set('--grn',  tokens.success);
    set('--red',  tokens.danger);
    set('--amb',  tokens.warning);
    set('--pur',  tokens.emphasis);

    // --bdrA (active/drag border) is hardcoded in _tokens.scss but should
    // always track the brand accent so drag rings match the brand color.
    if (tokens.accent) set('--bdrA', tokens.accent);

    // Tier 2 — surfaces
    if (tokens.backgrounds) {
      const [bg0, bg1, bg2, bg3, bg4] = tokens.backgrounds;
      set('--bg0', bg0);
      set('--bg1', bg1);
      set('--bg2', bg2);
      set('--bg3', bg3);
      set('--bg4', bg4);
    }

    if (tokens.text) {
      const [txt0, txt1, txt2] = tokens.text;
      set('--txt0', txt0);
      set('--txt1', txt1);
      set('--txt2', txt2);
    }

    if (tokens.border) {
      set('--bdr',  tokens.border);
      set('--bdrH', tokens.border);
    }

    // Tier 3 — chart palette
    tokens.chartPalette?.slice(0, 8).forEach((color, i) => {
      root.style.setProperty(`--chart-${i + 1}`, color);
    });
  }

  private clearBrandTokens(root: HTMLElement): void {
    BRAND_TOKENS.forEach(token => root.style.removeProperty(token));
  }

  private applyShape(root: HTMLElement, shape?: string): void {
    switch (shape) {
      case 'sharp':
        root.style.setProperty('--radius-sm', '2px');
        root.style.setProperty('--radius-md', '4px');
        root.style.setProperty('--radius-lg', '6px');
        root.style.setProperty('--radius-xl', '8px');
        break;
      case 'rounded':
        root.style.setProperty('--radius-sm', '8px');
        root.style.setProperty('--radius-md', '12px');
        root.style.setProperty('--radius-lg', '16px');
        root.style.setProperty('--radius-xl', '20px');
        break;
      // 'default' or undefined: already cleared above, SCSS values take over
    }
  }

  private loadFont(url: string, family: string): void {
    if (this._loadedFonts.has(family)) return;

    const link  = document.createElement('link');
    link.rel    = 'stylesheet';
    link.href   = url;
    document.head.appendChild(link);

    this._loadedFonts.add(family);
  }

  private applyFavicon(url: string): void {
    const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (existing) {
      existing.href = url;
    } else {
      const link  = document.createElement('link');
      link.rel    = 'icon';
      link.href   = url;
      document.head.appendChild(link);
    }
  }
}
