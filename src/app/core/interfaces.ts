// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Core Interfaces & Types
//  Single source of truth for all TypeScript types
//  Every component, service, and utility imports from here
// ═══════════════════════════════════════════════════════════════

import {
  StatQueryConfig, ChartQueryConfig, PieQueryConfig,
  TableQueryConfig, QueryWarning, StatusValueDef, FieldType,
} from './query-types';

// ───────────────────────────────────────────────────────────────
//  ENUMS
// ───────────────────────────────────────────────────────────────

export enum WidgetType {
  Stat      = 'stat',
  Analytics = 'analytics',
  Bar       = 'bar',
  Line      = 'line',
  Pie       = 'pie',
  Table     = 'table',
  Progress  = 'progress',
  Note      = 'note',
  Section   = 'section',
}

export enum ResizeDirection {
  N  = 'n',
  E  = 'e',
  W  = 'w',
  S  = 's',
  NE = 'ne',
  NW = 'nw',
  SW = 'sw',
  SE = 'se',
}

export enum PageState {
  Builder = 'builder',
  View    = 'view',
}

export enum TextAlign {
  Left   = 'left',
  Center = 'center',
  Right  = 'right',
}


// ───────────────────────────────────────────────────────────────
//  GRID SYSTEM
// ───────────────────────────────────────────────────────────────

/**
 * Grid coordinates for every widget on the canvas.
 * x: column index (0–11)
 * y: row index (0–∞, canvas auto-expands)
 * w: width in columns (1–12)
 * h: height in rows (1–20)
 */
export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Result of gridToPixel() conversion.
 * Used for absolute CSS positioning of widget cards.
 */
export interface PixelRect {
  left:   number;
  top:    number;
  width:  number;
  height: number;
}


// ───────────────────────────────────────────────────────────────
//  WIDGET CONFIG — per type
// ───────────────────────────────────────────────────────────────

/**
 * A single color threshold rule for Stat and Analytics widgets.
 * E1: when the live value >= threshold, the accent color is overridden.
 * Rules are evaluated in descending threshold order so the highest
 * matching rule wins. All fields optional on existing widgets.
 */
export interface ColorThreshold {
  /** Numeric value at or above which this color applies */
  threshold: number;
  /** Accent color to use when the rule matches (any valid CSS colour) */
  color: string;
}

/**
 * Stat Card config
 * Single KPI with trend indicator and optional sparkline
 */
export interface StatConfig {
  value:          string;
  subValue:       string;
  trend:          string;
  trendUp:        boolean;
  accent:         string;
  prefix:         string;
  suffix:         string;
  description:    string;
  showSparkline:  boolean;
  sparkData:      number[];
  selectedFields: string[];
  // ── Query integration ──
  queryConfig?:   StatQueryConfig;
  queryWarnings?: QueryWarning[];
  /** E1: optional threshold rules — absent on all existing widgets, no regression */
  colorThresholds?: ColorThreshold[];
}

/**
 * Analytics Card config
 * Metric with sparkline area chart
 */
export interface AnalyticsConfig {
  value:          string;
  changeValue:    string;
  changeLabel:    string;
  trendUp:        boolean;
  accent:         string;
  data:           number[];
  period:         string;
  /**
   * B6 fix: tracks which DATA_SCHEMA.kpi field is selected.
   * Required so Edit Modal fields tab can pre-check the right radio.
   * Single-element array (analytics is single-select).
   */
  selectedFields: string[];
  // ── Query integration ──
  queryConfig?:   StatQueryConfig;
  queryWarnings?: QueryWarning[];
  /** E1: optional threshold rules — absent on all existing widgets, no regression */
  colorThresholds?: ColorThreshold[];
}

/**
 * Single data point for bar/line series
 * n: category label (e.g. "Jan")
 * v: numeric value
 */
export interface DataPoint {
  n: string;
  v: number;
}

/**
 * Single series for bar / line charts
 */
export interface ChartSeries {
  key:   string;
  color: string;
  data:  DataPoint[];
}

/**
 * Value formatting profile for bar and line charts.
 * Controls how numeric values appear on the Y-axis and in tooltips.
 * All fields are optional — when absent the chart uses the existing
 * compact (1k / 2M) default so no existing widget is affected.
 */
export interface NumberFormatProfile {
  /** Display style: compact = 1k/2M, fixed = 1234.56, currency = $1,234.56, percent = 42% */
  notation: 'compact' | 'fixed' | 'currency' | 'percent';
  /** Decimal places to show (default: 0 for compact/percent, 2 for fixed/currency) */
  decimals?: number;
  /** Currency prefix symbol, e.g. '$', '£', '€' (only used when notation = 'currency') */
  currencySymbol?: string;
}

/**
 * A single horizontal reference/target line drawn across the full chart.
 * E3: optional — absent on all existing widgets so no regression is possible.
 */
export interface ReferenceLine {
  /** Display label shown next to the line (e.g. "Target", "Budget") */
  label: string;
  /** Y-axis value at which the line is drawn */
  value: number;
  /** Line colour — any valid CSS colour string */
  color: string;
  /** true = dashed line (default), false = solid line */
  dash?: boolean;
}

/**
 * Bar Chart config
 */
export interface BarConfig {
  accent:         string;
  stacked:        boolean;
  horizontal:     boolean;
  showGrid:       boolean;
  showLegend:     boolean;
  series:         ChartSeries[];
  /**
   * B6 fix: tracks which DATA_SCHEMA.series IDs are selected.
   * Required so Edit Modal fields tab can pre-check the right boxes.
   */
  selectedFields: string[];
  // ── Query integration ──
  queryConfig?:   ChartQueryConfig;
  queryWarnings?: QueryWarning[];
  /** X-axis labels from query result (parallel to series[].data) */
  queryLabels?:   string[];
  /** E2: optional value format — absent = existing compact (1k) behaviour */
  numberFormat?:  NumberFormatProfile;
  /** E3: horizontal reference/target lines drawn as annotations on the chart */
  referenceLines?: ReferenceLine[];
}

/**
 * Line / Area Chart config
 */
export interface LineConfig {
  areaFill:       boolean;
  smooth:         boolean;
  showGrid:       boolean;
  showDots:       boolean;
  showLegend:     boolean;
  series:         ChartSeries[];
  /**
   * B6 fix: tracks which DATA_SCHEMA.series IDs are selected.
   * Required so Edit Modal fields tab can pre-check the right boxes.
   */
  selectedFields: string[];
  // ── Query integration ──
  queryConfig?:   ChartQueryConfig;
  queryWarnings?: QueryWarning[];
  queryLabels?:   string[];
  /** E2: optional value format — absent = existing compact (1k) behaviour */
  numberFormat?:  NumberFormatProfile;
  /** E3: horizontal reference/target lines drawn as annotations on the chart */
  referenceLines?: ReferenceLine[];
}

/**
 * Single segment for pie / donut chart
 */
export interface PieSegment {
  name:  string;
  value: number;
  color: string;
}

/**
 * Pie / Donut Chart config
 */
export interface PieConfig {
  data:           PieSegment[];
  innerRadius:    number;
  showLabels:     boolean;
  showLegend:     boolean;
  /**
   * B6 fix: tracks which DATA_SCHEMA.segments IDs are selected.
   * Required so Edit Modal fields tab can pre-check the right boxes.
   */
  selectedFields: string[];
  // ── Query integration ──
  queryConfig?:   PieQueryConfig;
  queryWarnings?: QueryWarning[];
}

/**
 * Single column definition for data table
 */
export interface TableColumn {
  key:           string;
  label:         string;
  width:         string;
  type?:         FieldType;
  statusValues?: StatusValueDef[];
  /** Present when this column is derived from multiple source fields. */
  derived?:      import('./query-types').DerivedColumnDef;
}

/**
 * Single row for data table — dynamic key/value pairs.
 * Values are unknown to support numbers, booleans and dates
 * returned by the query engine (not just strings).
 */
export interface TableRow {
  [key: string]: unknown;
}

/**
 * Data Table config
 */
export interface TableConfig {
  columns:        TableColumn[];
  rows:           TableRow[];
  striped:        boolean;
  compact:        boolean;
  statusColumn:   boolean;
  /**
   * B6 fix: tracks which DATA_SCHEMA.columns IDs are selected.
   * Required so Edit Modal fields tab can pre-check the right boxes.
   */
  selectedFields: string[];
  // ── Query integration ──
  queryConfig?:   TableQueryConfig;
  queryWarnings?: QueryWarning[];
  /** Total row count from query (used for server-side pagination display) */
  totalRows?:     number;
}

/**
 * A single color rule for progress bars.
 * E6: when value/max >= minPercent the bar uses this color instead of item.color.
 * Rules are evaluated in descending minPercent order so the highest match wins.
 */
export interface ProgressColorRule {
  /** Percentage (0–100) at or above which this color applies */
  minPercent: number;
  /** Bar fill color when the rule matches */
  color: string;
}

/**
 * Single progress bar item
 */
export interface ProgressItem {
  label: string;
  value: number;
  max:   number;
  color: string;
}

/**
 * Progress Bars config
 */
export interface ProgressConfig {
  items:           ProgressItem[];
  showValues:      boolean;
  animated:        boolean;
  /**
   * B6 fix: tracks which DATA_SCHEMA.items IDs are selected.
   * Required so Edit Modal fields tab can pre-check the right boxes.
   */
  selectedFields:  string[];
  // ── Query integration ──
  progressQueries?: StatQueryConfig[];  // one per item
  queryWarnings?:   QueryWarning[];
  /** E6: global color rules applied to all bars — absent on existing widgets, no regression */
  colorRules?: ProgressColorRule[];
}

/**
 * Text / Note config
 */
export interface NoteConfig {
  content:  string;
  accent:   string;
  fontSize: string;
  bgColor:  string;
}

/**
 * Section Label config
 */
export interface SectionConfig {
  label:    string;
  accent:   string;
  showLine: boolean;
  align:    TextAlign;
}

/**
 * Union type of all possible widget configs
 * Used in the Widget interface below
 */
export type WidgetConfig =
  | StatConfig
  | AnalyticsConfig
  | BarConfig
  | LineConfig
  | PieConfig
  | TableConfig
  | ProgressConfig
  | NoteConfig
  | SectionConfig;


// ───────────────────────────────────────────────────────────────
//  WIDGET TYPE
// ───────────────────────────────────────────────────────────────

/**
 * Core Widget object — the main data model
 * Every widget on the canvas is one of these
 */
export interface Widget extends GridPosition {
  id:     string;       // uid() — random 7-char alphanumeric
  type:   WidgetType;   // one of the 9 types
  title:  string;       // display title in header
  locked: boolean;      // drag/resize/delete locked
  config: WidgetConfig; // type-specific configuration
}


// ───────────────────────────────────────────────────────────────
//  CATALOG
// ───────────────────────────────────────────────────────────────

/**
 * Widget type metadata entry in the CATALOG array
 * Used by the sidebar palette and Add Widget Wizard
 */
export interface CatalogItem {
  type:        WidgetType;
  label:       string;
  icon:        string;
  color:       string;
  desc:        string;
  defaultSize: { w: number; h: number };
}


// ───────────────────────────────────────────────────────────────
//  DATA SCHEMA
// ───────────────────────────────────────────────────────────────

/**
 * KPI field in DATA_SCHEMA.kpi
 * Used by stat and analytics widgets
 */
export interface KpiField {
  id:       string;
  label:    string;
  value:    string;
  trend:    string;
  trendUp:  boolean;
  accent:   string;
  spark:    number[];
  category: string;
}

/**
 * Time-series field in DATA_SCHEMA.series
 * Used by bar and line chart widgets
 */
export interface SeriesField {
  id:    string;
  label: string;
  color: string;
  data:  DataPoint[];
}

/**
 * Segment field in DATA_SCHEMA.segments
 * Used by pie / donut chart widgets
 */
export interface SegmentField {
  id:    string;
  name:  string;
  value: number;
  color: string;
}

/**
 * Column field in DATA_SCHEMA.columns
 * Used by table widget
 */
export interface ColumnField {
  id:    string;
  key:   string;
  label: string;
}

/**
 * Progress item field in DATA_SCHEMA.items
 * Used by progress bars widget
 */
export interface ItemField {
  id:    string;
  label: string;
  value: number;
  max:   number;
  color: string;
}

/**
 * Full DATA_SCHEMA structure
 */
export interface DataSchema {
  kpi:      KpiField[];
  series:   SeriesField[];
  segments: SegmentField[];
  columns:  ColumnField[];
  items:    ItemField[];
}

/**
 * Field pool mapping entry for FIELD_POOL_MAP
 */
export interface FieldPoolEntry {
  pool:  keyof DataSchema;
  multi: boolean;
  hint:  string;
}


// ───────────────────────────────────────────────────────────────
//  TEMPLATES
// ───────────────────────────────────────────────────────────────

/**
 * Pre-built dashboard template definition
 */
export interface DashboardTemplate {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  color:       string;
  build:       () => Widget[];
}


// ───────────────────────────────────────────────────────────────
//  IMPORT / EXPORT
// ───────────────────────────────────────────────────────────────

/**
 * JSON export format — full wrapper object
 */
export interface DashboardExport {
  title:   string;
  widgets: Widget[];
}


// ───────────────────────────────────────────────────────────────
//  CONTEXT MENU
// ───────────────────────────────────────────────────────────────

/**
 * Context menu position and target widget id
 */
export interface ContextMenuState {
  id: string;
  x:  number;
  y:  number;
}


// ───────────────────────────────────────────────────────────────
//  DRAG & RESIZE
// ───────────────────────────────────────────────────────────────

/**
 * Drag operation state stored in ref during drag
 */
export interface DragRef {
  id:     string;
  startX: number;
  startY: number;
  origX:  number;
  origY:  number;
  lastX:  number;
  lastY:  number;
}

/**
 * Resize operation state stored in ref during resize
 */
export interface ResizeRef {
  id:     string;
  dir:    ResizeDirection;
  startX: number;
  startY: number;
  origW:  number;
  origH:  number;
  lastW:  number;
  lastH:  number;
}

export interface AlignmentGuide {
  axis: 'x' | 'y';
  pos: number;
  start: number;
  end: number;
}


// ───────────────────────────────────────────────────────────────
//  STATUS BADGE
// ───────────────────────────────────────────────────────────────

/**
 * Status badge appearance definition
 * Used by the table widget's statusColumn feature
 */
export interface StatusStyle {
  bg:    string;
  fg:    string;
  label: string;
}

/**
 * Re-export for backwards compatibility.
 * Prefer StatusValueDef from query-types for new code.
 */
export type { StatusValueDef } from './query-types';


// ───────────────────────────────────────────────────────────────
//  HISTORY
// ───────────────────────────────────────────────────────────────

/**
 * History stack entry — full deep-cloned snapshot of widgets[]
 * Each entry is a complete, independent copy
 */
export type HistoryEntry = Widget[];


// ───────────────────────────────────────────────────────────────
//  DASHBOARD STATE
// ───────────────────────────────────────────────────────────────

/**
 * Complete dashboard service state shape
 * Documents every signal in DashboardService
 */
export interface DashboardState {
  // Core data
  widgets:     Widget[];
  dashTitle:   string;

  // Selection & interaction
  selectedId:  string | null;
  activeId:    string | null;
  frontId:     string | null;
  animatingId: string | null;

  // Canvas
  canvasW:     number;
  zoom:        number;
  scrollTop:   number;
  showMinimap: boolean;
  showAlignmentGuides: boolean;
  alignmentGuides: AlignmentGuide[];

  // History
  history:     HistoryEntry[];
  histIdx:     number;

  // Modal visibility flags
  wizardOpen:     boolean;
  wizardInitType: WidgetType | null;
  editingWidget:  Widget | null;
  showTemplates:  boolean;
  showImport:     boolean;
  showHelp:       boolean;
  contextMenu:    ContextMenuState | null;

  // Sidebar
  sidebarSearch:  string;

  // Title editing
  editingTitle:   boolean;

  // Page state
  pageState:      PageState;
}
