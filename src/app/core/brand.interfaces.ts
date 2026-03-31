// ─────────────────────────────────────────────────────────────────────────────
//  DASHCRAFT — Client Brand Interfaces
//  All types used by BrandService and ThemeService for multi-client theming.
// ─────────────────────────────────────────────────────────────────────────────

/** Lightweight entry loaded from /assets/brands/_index.json for the picker. */
export interface BrandEntry {
  clientId:    string;
  displayName: string;
}

/** Color token overrides for one theme variant (dark or light). */
export interface BrandColorTokens {
  // ── Tier 1: identity accents ───────────────────────────────────
  accent?:      string;   // --acc
  accentSoft?:  string;   // --acc2
  success?:     string;   // --grn
  danger?:      string;   // --red
  warning?:     string;   // --amb
  emphasis?:    string;   // --pur

  // ── Tier 2: surface scale (optional deep override) ─────────────
  backgrounds?: [string, string, string, string, string]; // --bg0…bg4
  text?:        [string, string, string];                 // --txt0…txt2
  border?:      string;                                   // --bdr

  // ── Tier 3: data visualization ─────────────────────────────────
  chartPalette?: string[]; // up to 8 values — missing entries keep defaults
}

/** Full brand configuration loaded from /assets/brands/{clientId}.json. */
export interface ClientBrandConfig {
  clientId:    string;
  displayName: string;

  // ── Identity assets ────────────────────────────────────────────
  logoUrl?:    string;   // replaces text logo in toolbar
  faviconUrl?: string;   // applied to <link rel="icon">

  // ── Typography ─────────────────────────────────────────────────
  fontFamily?: string;   // value written to --font-sans
  fontUrl?:    string;   // <link> injected into <head> to load the font

  // ── Shape ──────────────────────────────────────────────────────
  // sharp:   2/4/6/8px  — enterprise/financial look
  // default: 5/8/10/14px — DASHCRAFT baseline (no override)
  // rounded: 8/12/16/20px — consumer/SaaS look
  shape?: 'sharp' | 'default' | 'rounded';

  // ── Color tokens per theme variant ─────────────────────────────
  // If only `dark` is provided it applies to both dark and light themes.
  // If both are provided each activates when the theme signal changes.
  dark?:  BrandColorTokens;
  light?: BrandColorTokens;
}
