// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Layout Utilities
//  Pure grid math functions — zero Angular dependencies
//
//  Built incrementally:
//  ├── Step 8: collides(), hasCollision()
//  ├── Step 9: resolveLayout()
//  └── Step 10: gridToPixel(), packLayout(), computeCanvasH()
//
//  All functions are pure — same input always gives same output
//  No side effects, no service calls, fully unit-testable
// ═══════════════════════════════════════════════════════════════

import { Widget, PixelRect } from './interfaces';
import {
  COLS,
  DEFAULT_ROW_H,
  GAP,
  MAX_LAYOUT_PASSES,
  MAX_PACK_ITERATIONS,
} from './constants';


// ───────────────────────────────────────────────────────────────
//  STEP 8 — COLLISION DETECTION
// ───────────────────────────────────────────────────────────────

/**
 * AABB (Axis-Aligned Bounding Box) overlap test.
 * Returns true if widget A and widget B occupy any
 * overlapping grid cells.
 *
 * Uses strict less-than — widgets that share only an edge
 * are NOT considered colliding. This matches CSS layout
 * where two adjacent widgets share a boundary pixel.
 *
 * Math:
 *   Overlap on X axis: a.x < b.x + b.w  AND  a.x + a.w > b.x
 *   Overlap on Y axis: a.y < b.y + b.h  AND  a.y + a.h > b.y
 *   Both axes must overlap simultaneously for a collision.
 *
 * @param a - First widget (or any object with x, y, w, h)
 * @param b - Second widget (or any object with x, y, w, h)
 * @returns true if the two widgets overlap
 *
 * @example
 * // Two widgets at same position — collision
 * collides({x:0, y:0, w:3, h:2}, {x:0, y:0, w:3, h:2}) // true
 *
 * // Adjacent widgets — NO collision (share edge only)
 * collides({x:0, y:0, w:3, h:2}, {x:3, y:0, w:3, h:2}) // false
 *
 * // Partial overlap — collision
 * collides({x:0, y:0, w:3, h:2}, {x:2, y:1, w:3, h:2}) // true
 *
 * // Same row, no overlap
 * collides({x:0, y:0, w:3, h:2}, {x:5, y:0, w:3, h:2}) // false
 *
 * // One above other — NO collision
 * collides({x:0, y:0, w:3, h:2}, {x:0, y:2, w:3, h:2}) // false
 */
export function collides(
  a: Pick<Widget, 'x' | 'y' | 'w' | 'h'>,
  b: Pick<Widget, 'x' | 'y' | 'w' | 'h'>
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}


/**
 * Check if a candidate widget collides with ANY widget
 * in the provided array, excluding itself by ID.
 *
 * Used by:
 * ├── Arrow nudge — blocks move on collision (no push)
 * ├── packLayout — finds lowest Y with no collision
 * └── resolveLayout — checks candidate positions
 *
 * Edge case C17: Arrow nudge uses hasCollision directly,
 * NOT resolveLayout. This means nudging into an occupied
 * cell is silently blocked — no push happens.
 *
 * @param candidate - Widget being tested for placement
 * @param all       - Full widget array to test against
 * @returns true if candidate overlaps any other widget
 *
 * @example
 * const widgets = [
 *   { id:'a', x:0, y:0, w:3, h:2 },
 *   { id:'b', x:3, y:0, w:3, h:2 },
 * ];
 *
 * // Testing widget 'a' — skips itself, checks 'b'
 * hasCollision(
 *   { id:'a', x:0, y:0, w:3, h:2 },
 *   widgets
 * ) // false — 'a' doesn't overlap 'b'
 *
 * // Testing a widget moving into 'b' space
 * hasCollision(
 *   { id:'a', x:3, y:0, w:3, h:2 },
 *   widgets
 * ) // true — overlaps 'b'
 */
export function hasCollision(
  candidate: Pick<Widget, 'id' | 'x' | 'y' | 'w' | 'h'>,
  all: Pick<Widget, 'id' | 'x' | 'y' | 'w' | 'h'>[]
): boolean {
  return all.some(
    w => w.id !== candidate.id && collides(candidate, w)
  );
}


/**
 * Check if a widget would collide with any LOCKED widget
 * in the provided array, excluding itself.
 *
 * Used by resolveLayout() as the first check —
 * if proposed position hits a locked widget, return null
 * immediately (hard block — no push possible).
 *
 * @param candidate - Widget being tested
 * @param all       - Full widget array
 * @returns true if candidate overlaps any locked widget
 */
export function collidesWithLocked(
  candidate: Pick<Widget, 'id' | 'x' | 'y' | 'w' | 'h'>,
  all: (Pick<Widget, 'id' | 'x' | 'y' | 'w' | 'h'> & { locked: boolean })[]
): boolean {
  return all.some(
    w => w.id !== candidate.id &&
         w.locked === true &&
         collides(candidate, w)
  );
}

// ───────────────────────────────────────────────────────────────
//  STEP 9 — RESOLVE LAYOUT (PUSH ALGORITHM)
// ───────────────────────────────────────────────────────────────

/**
 * Smart push-layout resolver.
 *
 * When the active widget is dragged or resized into occupied space,
 * instead of blocking the move, this function automatically
 * displaces colliding widgets to make room.
 *
 * ── Direction priority ──────────────────────────────────────────
 * For each collision, the displaced widget tries positions in order:
 *   1. RIGHT of anchor: x = anchor.x + anchor.w
 *      (only if x + mover.w ≤ COLS — must fit within grid)
 *   2. LEFT of anchor:  x = anchor.x - mover.w
 *      (only if x ≥ 0 — must not go off left edge)
 *   3. DOWN from anchor: y = anchor.y + anchor.h
 *      (always valid — canvas grows downward infinitely)
 *
 * Why right/left before down?
 * Without this, every push goes straight down → tall sparse canvas.
 * Trying sideways first keeps the layout compact and horizontal.
 *
 * ── Anchor vs Mover ─────────────────────────────────────────────
 * The ACTIVE widget (being dragged) is always the anchor.
 * LOCKED widgets are always anchors — nothing can push them.
 * When two free widgets collide with each other:
 *   → 'b' (higher index in layout array) is always the mover.
 *   This tie-breaking is consistent but order-dependent (M5 audit).
 *
 * ── Hard block ──────────────────────────────────────────────────
 * If the proposed position overlaps ANY locked widget → return null.
 * The caller's fallback chain then tries x-only, y-only, or no move.
 *
 * ── Pass limit ──────────────────────────────────────────────────
 * Runs up to MAX_LAYOUT_PASSES (60) iterations.
 * If limit is hit without full resolution → returns partially
 * resolved layout (not null). Visible overlap only on pathological
 * dense-locked layouts (M4 from audit).
 *
 * @param proposed - The active widget at its new proposed position
 * @param all      - Full current widget array
 * @returns        - Fully resolved layout array, or null if
 *                   a locked widget hard-blocks the move
 */
export function resolveLayout(
  proposed: Widget,
  all:      Widget[]
): Widget[] | null {

  // ── Hard block check ──────────────────────────────────────────
  // If proposed position overlaps any locked OR pinned widget → null
  // Caller will try fallback positions (x-only, y-only, no move)
  const lockedBlock = all.some(
    w => w.id !== proposed.id &&
         (w.locked === true || w.pinned === true) &&
         collides(proposed, w)
  );
  if (lockedBlock) return null;

  // ── Place active widget at proposed position ───────────────────
  // Everything else stays where it is — we'll resolve collisions
  let layout: Widget[] = all.map(w =>
    w.id === proposed.id
      ? { ...proposed }
      : { ...w }
  );

  // ── Resolution passes ─────────────────────────────────────────
  // Each pass scans all widget pairs for collisions and resolves them.
  // Continues until no collisions remain or MAX_LAYOUT_PASSES hit.
  for (let pass = 0; pass < MAX_LAYOUT_PASSES; pass++) {
    let changed = false;

    for (let i = 0; i < layout.length; i++) {
      for (let j = 0; j < layout.length; j++) {

        // Skip self-comparison
        if (i === j) continue;

        const a = layout[i];
        const b = layout[j];

        // No collision between this pair — skip
        if (!collides(a, b)) continue;

        // ── Determine anchor vs mover ──────────────────────────
        // Active widget, locked widgets, and PINNED widgets are anchors
        // (they cannot be displaced by push).
        // locked  = edit protection (no drag/resize/delete)
        // pinned  = layout anchor   (not pushed by resolve/pack)
        const isAnchor = (w: Widget): boolean =>
          w.id === proposed.id || w.locked === true || w.pinned === true;

        // Both immovable — cannot resolve this pair, skip
        if (isAnchor(a) && isAnchor(b)) continue;

        // Prefer moving 'b' when both are free widgets (M5 audit)
        // This tie-breaking is consistent: higher array index moves
        const mover:  Widget = isAnchor(a) ? b : isAnchor(b) ? a : b;
        const anchor: Widget = isAnchor(a) ? a : isAnchor(b) ? b : a;

        // Mover itself is an anchor — cannot move it, skip
        if (isAnchor(mover)) continue;

        // ── Build candidate positions ──────────────────────────
        // All other widgets except the mover itself
        const others = layout.filter(w => w.id !== mover.id);

        // Candidate 1 — RIGHT of anchor
        const tryRightX   = anchor.x + anchor.w;
        const fitsRight    = tryRightX + mover.w <= COLS;
        const candRight: Widget | null = fitsRight
          ? { ...mover, x: tryRightX }
          : null;

        // Candidate 2 — LEFT of anchor
        const tryLeftX    = anchor.x - mover.w;
        const fitsLeft     = tryLeftX >= 0;
        const candLeft: Widget | null = fitsLeft
          ? { ...mover, x: tryLeftX }
          : null;

        // Candidate 3 — DOWN from anchor (always valid)
        const candDown: Widget = {
          ...mover,
          y: anchor.y + anchor.h,
        };

        // ── Pick first candidate with no collision ─────────────
        // Priority: right → left → down
        let chosen: Widget;

        if (
          candRight &&
          !others.some(w => collides(w, candRight))
        ) {
          chosen = candRight;
        } else if (
          candLeft &&
          !others.some(w => collides(w, candLeft))
        ) {
          chosen = candLeft;
        } else {
          // Down is always accepted —
          // even if it collides with something else,
          // the next pass will resolve that cascade
          chosen = candDown;
        }

        // ── Apply the chosen position ──────────────────────────
        layout = layout.map(w =>
          w.id === mover.id
            ? { ...w, x: chosen.x, y: chosen.y }
            : w
        );
        changed = true;
      }
    }

    // All pairs resolved — exit early
    if (!changed) break;
  }

  return layout;
}


/**
 * Three-tier drag fallback chain.
 *
 * Called on every mousemove during drag.
 * Tries increasingly constrained moves before giving up:
 *
 *   Tier 1 — Full move:   proposed (new x AND y)
 *   Tier 2 — X-only slide: keep y, only move x
 *   Tier 3 — Y-only slide: keep x, only move y
 *   Tier 4 — No change:   return current layout unchanged
 *
 * Returns null only when ALL tiers are blocked by locked widgets.
 * The canvas stays unchanged when null is returned.
 *
 * @param active   - The widget being dragged (current state)
 * @param newX     - Proposed new column (clamped, grid units)
 * @param newY     - Proposed new row (clamped, grid units)
 * @param all      - Full current widget array
 * @returns        - Resolved layout, or null if fully blocked
 */
export function resolveDrag(
  active: Widget,
  newX:   number,
  newY:   number,
  all:    Widget[]
): Widget[] | null {

  // Tier 1 — Full move (new x and y)
  const proposed  = { ...active, x: newX, y: newY };
  const resolved  = resolveLayout(proposed, all);
  if (resolved) return resolved;

  // Tier 2 — X-only slide (keep current y)
  const slideX    = { ...active, x: newX };
  const resolvedX = resolveLayout(slideX, all);
  if (resolvedX) return resolvedX;

  // Tier 3 — Y-only slide (keep current x)
  const slideY    = { ...active, y: newY };
  const resolvedY = resolveLayout(slideY, all);
  if (resolvedY) return resolvedY;

  // Tier 4 — All blocked by locked widgets — no change
  return null;
}


/**
 * Three-tier resize fallback chain.
 *
 * Called on every mousemove during resize.
 * Tries progressively constrained resize before giving up:
 *
 *   Tier 1 — Full resize:   new x/y/w/h
 *   Tier 2 — Width-only:    new x/w, keep y/h
 *   Tier 3 — Height-only:   new y/h, keep x/w
 *   Tier 4 — No change:     return current layout unchanged
 *
 * @param active - The widget being resized (current state)
 * @param proposed - Proposed widget bounds (clamped, grid units)
 * @param dir    - Resize direction ('n' | 'e' | 's' | 'w' | corners)
 * @param all    - Full current widget array
 * @returns      - Resolved layout, or null if fully blocked
 */
export function resolveResize(
  active: Widget,
  proposed: Widget,
  dir:    string,
  all:    Widget[]
): Widget[] | null {

  // Tier 1 — Full resize (new x/y/w/h)
  const resolved = resolveLayout(proposed, all);
  if (resolved) return resolved;

  // Tier 2 — Width-only (only for handles that affect width)
  if (dir.includes('e') || dir.includes('w')) {
    const wOnly     = { ...active, x: proposed.x, w: proposed.w };
    const resolvedW = resolveLayout(wOnly, all);
    if (resolvedW) return resolvedW;
  }

  // Tier 3 — Height-only (only for handles that affect height)
  if (dir.includes('n') || dir.includes('s')) {
    const hOnly     = { ...active, y: proposed.y, h: proposed.h };
    const resolvedH = resolveLayout(hOnly, all);
    if (resolvedH) return resolvedH;
  }

  // Tier 4 — All blocked — no change
  return null;
}

// ───────────────────────────────────────────────────────────────
//  STEP 10 — LAYOUT HELPERS
// ───────────────────────────────────────────────────────────────

/**
 * Convert grid coordinates to absolute CSS pixel values.
 * Used by every widget card for absolute positioning on canvas.
 *
 * Formula:
 *   left   = x * (colW + GAP) + GAP
 *   top    = y * (ROW_H + GAP) + GAP
 *   width  = w * (colW + GAP) - GAP
 *   height = h * ROW_H + (h - 1) * GAP
 *
 * Why width uses (colW + GAP) - GAP:
 *   Each column unit = colW + GAP (column + right gap)
 *   But the last column doesn't get a right gap
 *   So width = w columns × (colW + GAP) - 1 gap
 *
 * Why height uses ROW_H + (h-1) * GAP:
 *   Each row = ROW_H px tall
 *   Gaps between rows = (h - 1) gaps
 *   So height = h * ROW_H + (h-1) * GAP
 *
 * @param widget - Any object with x, y, w, h grid coordinates
 * @param colW   - Computed column width in pixels
 * @returns      - CSS pixel rect for absolute positioning
 *
 * @example
 * // Canvas 1200px wide, colW = (1200 - 10*13) / 12 = 89.17px
 * gridToPixel({ x:0, y:0, w:3, h:2 }, 89.17)
 * // → { left: 10, top: 10, width: 277.5, height: 170 }
 */
export function gridToPixel(
  widget: Pick<Widget, 'x' | 'y' | 'w' | 'h'>,
  colW:   number,
  rowH:   number = DEFAULT_ROW_H
): PixelRect {
  return {
    left:   widget.x * (colW + GAP) + GAP,
    top:    widget.y * (rowH + GAP) + GAP,
    width:  widget.w * (colW + GAP) - GAP,
    height: widget.h * rowH + (widget.h - 1) * GAP,
  };
}


/**
 * Compute the dynamic column width from canvas container width.
 * Re-computed whenever the canvas is resized via ResizeObserver.
 *
 * Formula:
 *   colW = (canvasW - GAP * (COLS + 1)) / COLS
 *
 * Why GAP * (COLS + 1):
 *   12 columns need 13 gaps (one before each column + one after last)
 *   Total gap space = GAP * 13
 *   Remaining space for columns = canvasW - (GAP * 13)
 *   Each column = remaining / 12
 *
 * @param canvasW - Canvas container width in pixels
 * @returns       - Column width in pixels
 *
 * @example
 * computeColW(1210) // → (1210 - 130) / 12 = 90px
 */
export function computeColW(canvasW: number): number {
  return (canvasW - GAP * (COLS + 1)) / COLS;
}


/**
 * Compute the minimum canvas height to fit all widgets.
 * Canvas auto-expands as widgets are added below.
 *
 * Uses the bottom edge of the lowest widget:
 *   bottom = (y + h) * (ROW_H + GAP)
 *
 * Adds 60px padding at the bottom for breathing room.
 * Minimum height is always 600px even on empty canvas.
 *
 * @param widgets - Current widget array
 * @returns       - Canvas height in pixels
 *
 * @example
 * // Widget at y=5, h=3 → bottom row = y+h = 8
 * computeCanvasH([{ y:5, h:3 }])
 * // → Math.max(600, 8 * (80+10) + 120) = Math.max(600, 840) = 840
 */
export function computeCanvasH(
  widgets: Pick<Widget, 'y' | 'h'>[],
  rowH:    number = DEFAULT_ROW_H
): number {
  if (!widgets.length) return 600;
  const maxBottom = Math.max(
    ...widgets.map(w => (w.y + w.h) * (rowH + GAP))
  );
  // B1 fix: 120px padding matches React source (was 60px — too tight)
  return Math.max(600, maxBottom + 120);
}


/**
 * Pack layout — remove empty row gaps by compacting upward.
 *
 * Algorithm (greedy top-packing):
 *   1. Sort widgets by y (top to bottom), then x (left to right)
 *   2. For each widget, find the lowest y where it fits
 *      without colliding with already-placed widgets
 *   3. Place it there
 *
 * Guards:
 *   - Degenerate widgets (w=0 or h=0) are skipped and kept
 *     at their original position (edge case C7 from audit)
 *   - MAX_PACK_ITERATIONS (200) safety cap prevents infinite
 *     loop on pathological layouts (Bug fix #10 from React source)
 *
 * When to use:
 *   After deleting widgets, after heavy drag sessions,
 *   after importing a layout with gaps.
 *
 * Note: Pack is UNDOABLE — it goes through pushHistory.
 *
 * @param widgets - Current widget array
 * @returns       - New widget array with gaps removed
 *
 * @example
 * // Widget at y=5 with empty rows 0-4
 * packLayout([{ ...widget, y:5 }])
 * // → widget moved to y=0
 */
export function packLayout(widgets: Widget[]): Widget[] {

  // ── Anchor pre-pass ────────────────────────────────────────────
  // Locked (and backward-compat pinned) widgets are layout anchors —
  // pack must not move them. Pre-populate `placed` with all anchor
  // widgets at their current positions so the compaction loop treats
  // them as immovable obstacles.
  const anchors = widgets.filter(w => w.locked === true || w.pinned === true);
  const free    = widgets.filter(w => w.locked !== true && w.pinned !== true);

  // Sort free widgets by y then x — process top-to-bottom, left-to-right
  const sorted = [...free].sort((a, b) =>
    a.y !== b.y ? a.y - b.y : a.x - b.x
  );

  // Seed placed with all anchor widgets at their fixed positions
  const placed: Widget[] = [...anchors];

  for (const widget of sorted) {

    // Guard: skip degenerate widgets (w=0 or h=0)
    // Keep at original position — do not attempt to pack
    if (!widget.w || !widget.h) {
      placed.push(widget);
      continue;
    }

    // Find lowest y where this widget fits without collision
    let y       = 0;
    let safety  = 0;

    while (safety < MAX_PACK_ITERATIONS) {
      const candidate = { ...widget, y };

      if (!hasCollision(candidate, placed)) {
        // Found a valid position — place it
        placed.push(candidate);
        break;
      }

      y++;
      safety++;
    }

    // Safety cap hit — keep at original position
    // This prevents infinite loop on impossible layouts
    if (safety >= MAX_PACK_ITERATIONS) {
      placed.push(widget);
    }
  }

  return placed;
}


/**
 * Nudge a widget one grid cell in a direction via keyboard.
 *
 * Rules (edge case C17 from audit):
 *   - Uses hasCollision directly — NOT resolveLayout
 *   - Collision = silently blocked, no push happens
 *   - Locked widgets cannot be nudged
 *   - Clamped to grid boundaries (0 to COLS-w, 0 to MAX_Y)
 *
 * @param widget     - Widget to nudge
 * @param dx         - Column delta (-1, 0, or +1)
 * @param dy         - Row delta (-1, 0, or +1)
 * @param all        - Full widget array
 * @param maxY       - Maximum allowed y value (default 50)
 * @returns          - Updated widget array, or original if blocked
 */
export function nudgeWidget(
  widget:  Widget,
  dx:      number,
  dy:      number,
  all:     Widget[],
  maxY     = 50
): Widget[] {

  // Locked widgets cannot be nudged
  if (widget.locked) return all;

  const nx = Math.max(0, Math.min(COLS - widget.w, widget.x + dx));
  const ny = Math.max(0, Math.min(maxY, widget.y + dy));

  const proposed = { ...widget, x: nx, y: ny };

  // Collision check — block silently, no push
  if (hasCollision(proposed, all)) return all;

  // Apply nudge
  return all.map(w =>
    w.id === widget.id ? proposed : w
  );
}


// ───────────────────────────────────────────────────────────────
//  SNAP-TO-WIDGET-EDGE  (Feature 3)
// ───────────────────────────────────────────────────────────────

/**
 * Result returned by snapToWidgetEdge().
 * snapLeft / snapTop are the NEW pixel left / top for the dragged
 * widget after alignment, or null if no snap fired on that axis.
 * targetId is the widget whose edge triggered the snap (used for
 * the brief highlight animation on the snap target).
 */
export interface SnapResult {
  snapLeft: number | null;
  snapTop:  number | null;
  targetId: string | null;
}

/**
 * Snap-to-widget-edge — fires once on pointerup (NOT during drag).
 *
 * Checks all four edges (left, right, top, bottom) of the dragged
 * widget's landing rect against the same four edges of every other
 * widget's pixel rect. When any pair is within `threshold` pixels,
 * the dragged widget's position is adjusted to align them exactly.
 *
 * Returns the new pixel left/top for the dragged widget, plus the
 * ID of the widget that triggered the snap. The caller converts
 * those pixel values back to grid coordinates, re-runs resolveDrag,
 * and commits the snapped layout if resolveDrag succeeds.
 *
 * If multiple edges are within threshold, the closest pair wins
 * independently on each axis.
 *
 * Pinned widgets are naturally the "best" snap targets because they
 * are already in a stable position on the grid.
 *
 * @param dragged   - Pixel rect of the widget at its landing position
 * @param others    - Pixel rects of all other widgets plus their IDs
 * @param threshold - Max distance in px that triggers a snap
 * @returns SnapResult with new pixel position and target widget ID
 */
export function snapToWidgetEdge(
  dragged:   PixelRect,
  others:    Array<{ rect: PixelRect; id: string }>,
  threshold: number
): SnapResult {
  // Source edge points on X and Y axes
  const srcLeft   = dragged.left;
  const srcRight  = dragged.left + dragged.width;
  const srcTop    = dragged.top;
  const srcBottom = dragged.top  + dragged.height;

  let snapLeft:  number | null = null;
  let snapTop:   number | null = null;
  let targetId:  string | null = null;
  let bestDeltaX = threshold + 1;
  let bestDeltaY = threshold + 1;
  let bestTargetX: string | null = null;
  let bestTargetY: string | null = null;

  for (const { rect: other, id } of others) {
    const tgtEdgesX = [other.left, other.left + other.width];
    const tgtEdgesY = [other.top,  other.top  + other.height];

    // ── X-axis snap ─────────────────────────────────────────────
    for (const srcEdge of [srcLeft, srcRight]) {
      for (const tgtEdge of tgtEdgesX) {
        const delta = Math.abs(srcEdge - tgtEdge);
        if (delta > threshold || delta >= bestDeltaX) continue;
        bestDeltaX = delta;
        // Shift the entire rect so this source edge aligns with the target
        snapLeft = dragged.left - (srcEdge - tgtEdge);
        bestTargetX = id;
      }
    }

    // ── Y-axis snap ─────────────────────────────────────────────
    for (const srcEdge of [srcTop, srcBottom]) {
      for (const tgtEdge of tgtEdgesY) {
        const delta = Math.abs(srcEdge - tgtEdge);
        if (delta > threshold || delta >= bestDeltaY) continue;
        bestDeltaY = delta;
        snapTop = dragged.top - (srcEdge - tgtEdge);
        bestTargetY = id;
      }
    }
  }

  // targetId: prefer X-snap target; fall back to Y-snap target
  targetId = bestTargetX ?? bestTargetY;

  return { snapLeft, snapTop, targetId };
}


/**
 * Find the next available Y position for adding a new widget.
 * New widgets are always placed at the bottom of the canvas.
 *
 * @param widgets - Current widget array
 * @returns       - Next available row index
 *
 * @example
 * // Widgets occupy rows 0-4
 * getNextY([{ y:3, h:2 }]) // → 5
 * getNextY([])              // → 0 (empty canvas)
 */
export function getNextY(
  widgets: Pick<Widget, 'y' | 'h'>[]
): number {
  if (!widgets.length) return 0;
  return Math.max(...widgets.map(w => w.y + w.h));
}


/**
 * Find the first free grid slot that fits a widget of size (w × h).
 *
 * Scans the existing canvas area row-by-row (top → bottom),
 * left-to-right within each row, returning the first position
 * where the candidate rectangle does not overlap any existing widget.
 * Falls back to { x:0, y:getNextY() } when no gap is found.
 *
 * This ensures new widgets fill empty space before expanding the
 * canvas downward.
 *
 * @param w       - Widget width in grid columns
 * @param h       - Widget height in grid rows
 * @param widgets - Current widget array
 * @returns       - Best available { x, y } grid position
 *
 * @example
 * // Canvas has one 3×2 widget at (0,0); placing another 3×2
 * findFirstFreeSlot(3, 2, [{ x:0, y:0, w:3, h:2 }])
 * // → { x:3, y:0 }  (gap to the right on same row)
 */
export function findFirstFreeSlot(
  w:       number,
  h:       number,
  widgets: Pick<Widget, 'x' | 'y' | 'w' | 'h'>[]
): { x: number; y: number } {
  const maxY = getNextY(widgets);

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= COLS - w; x++) {
      const candidate = { x, y, w, h };
      if (!widgets.some(existing => collides(candidate, existing))) {
        return { x, y };
      }
    }
  }

  // No gap found inside the current canvas — append at bottom
  return { x: 0, y: maxY };
}


/**
 * Find the best placement position for a duplicate of `source`.
 *
 * Priority (first free slot wins):
 *   1. Right  — same row, immediately to the right (if fits in COLS)
 *   2. Below  — same column, immediately below
 *   3. Left   — same row, immediately to the left (if x >= 0)
 *   4. Bottom — getNextY() fallback (original behaviour)
 *
 * A slot is "free" when the candidate rectangle does not collide
 * with any existing widget in `all` (the duplicate itself is not
 * yet in `all`, so no self-exclusion needed).
 *
 * @param source - The widget being duplicated
 * @param dupe   - The candidate duplicate (same w/h, needs x/y set)
 * @param all    - Current widget array (source is included)
 * @returns      - { x, y } grid position for the duplicate
 */
export function findAdjacentPlacement(
  source: Pick<Widget, 'x' | 'y' | 'w' | 'h'>,
  dupe:   Pick<Widget, 'w' | 'h'>,
  all:    Pick<Widget, 'id' | 'x' | 'y' | 'w' | 'h'>[]
): { x: number; y: number; isAdjacent: boolean } {
  const candidates: Array<{ x: number; y: number }> = [
    // 1. Right
    { x: source.x + source.w,  y: source.y },
    // 2. Below
    { x: source.x,              y: source.y + source.h },
    // 3. Left
    { x: source.x - dupe.w,    y: source.y },
  ];

  for (const { x, y } of candidates) {
    if (x < 0 || x + dupe.w > COLS || y < 0) continue;
    const candidate = { id: '__dupe__', x, y, w: dupe.w, h: dupe.h };
    if (!all.some(w => collides(candidate, w))) {
      return { x, y, isAdjacent: true };
    }
  }

  // 4. Bottom fallback — original behaviour
  return { x: source.x, y: getNextY(all), isAdjacent: false };
}
