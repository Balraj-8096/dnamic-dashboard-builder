import { Component, inject } from '@angular/core';
import { getCatalogColor } from '../../core/catalog';
import { MINIMAP_W, clamp } from '../../core/constants';
import { gridToPixel } from '../../core/layout.utils';
import { DashboardService } from '../../services/dashboard.service';

const MINIMAP_MAX_H = 120; // cap SVG height to keep minimap compact
@Component({
  selector: 'app-minimap',
  imports: [],
  templateUrl: './minimap.html',
  styleUrl: './minimap.scss',
})
export class Minimap {
  readonly svc = inject(DashboardService);

  readonly W = MINIMAP_W;

  // ── Derived geometry ─────────────────────────────────────────
  get scale(): number {
    const canvasW = Math.max(this.svc.canvasW(), 1);
    const canvasH = Math.max(this.svc.canvasH(), 1);
    return Math.min(this.W / canvasW, MINIMAP_MAX_H / canvasH);
  }

  get minimapContentW(): number {
    return Math.max(1, Math.round(this.svc.canvasW() * this.scale));
  }

  get offsetX(): number {
    return Math.round((this.W - this.minimapContentW) / 2);
  }

  get minimapH(): number {
    return Math.max(1, Math.round(this.svc.canvasH() * this.scale));
  }

  // ── Widget rects ─────────────────────────────────────────────
  get widgetRects() {
    const scale = this.scale;
    const colW = this.svc.colW();
    const offsetX = this.offsetX;
    return this.svc.widgets().map(w => {
      const p = gridToPixel(w, colW);
      const color = getCatalogColor(w.type);
      return {
        id: w.id,
        x: offsetX + p.left * scale,
        y: p.top * scale,
        width: p.width * scale,
        height: p.height * scale,
        fill: color + '44',
        stroke: color + '88',
      };
    });
  }

  // ── Viewport rect (uses signal — bug fix #11, NOT read from DOM) ──
  get viewportRect() {
    const scale = this.scale;
    const viewportH = this.svc.viewportH();
    const scrollTop = this.svc.scrollTop();
    const vpH = Math.min(Math.round(viewportH * scale), this.minimapH);
    const maxVpY = Math.max(0, this.minimapH - vpH);
    const vpY = clamp(Math.round(scrollTop * scale), 0, maxVpY);
    return { x: this.offsetX, y: vpY, width: this.minimapContentW, height: vpH };
  }

  // ── Click to jump ─────────────────────────────────────────────
  onMinimapClick(e: MouseEvent): void {
    const host = e.currentTarget as HTMLElement;
    const svg = host.querySelector('.minimap-svg') as SVGSVGElement | null;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clickY = clamp(e.clientY - rect.top, 0, rect.height);
    // Convert minimap Y → canvas Y, center the viewport
    const canvasY = clickY / this.scale;
    const viewportH = this.svc.viewportH();
    const maxScrollTop = Math.max(0, this.svc.canvasH() - viewportH);
    const target = clamp(canvasY - viewportH / 2, 0, maxScrollTop);
    this.svc.setScrollTop(target);
    // Sync the actual scroll on the main scroll container
    // (canvas component owns the DOM element; we fire a synthetic scroll via signal)
    // The canvas scroll-listener will update svc.scrollTop on the next scroll event.
    // For immediate jump we also scroll the main area if accessible:
    const main = document.querySelector('.scroll-area, .view-main') as HTMLElement | null;
    if (main) main.scrollTop = target;
  }
}
