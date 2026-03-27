// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Widget FACTORIES
//  Default widget builders for all 9 types
//
//  Used by:
//  ├── Add Widget Wizard — creates widget on Step 3 confirm
//  ├── Templates — each template calls FACTORIES then overrides
//  ├── Demo loader — loadDemo() calls FACTORIES directly
//  └── Keyboard Ctrl+1–9 — opens wizard pre-filled with type
//
//  Every factory:
//  ├── Generates a fresh uid() — every widget is unique
//  ├── Accepts (x, y) grid position from the caller
//  ├── Returns a complete Widget object ready to render
//  └── Uses realistic pre-filled data (not empty placeholders)
//
//  Direct port from React FACTORIES object
// ═══════════════════════════════════════════════════════════════

import { Widget, WidgetType, WidgetConfig, TextAlign, StatConfig, AnalyticsConfig, BarConfig, LineConfig, PieConfig, TableConfig, ProgressConfig, NoteConfig, SectionConfig } from './interfaces';
import { uid } from './constants';


// ───────────────────────────────────────────────────────────────
//  INDIVIDUAL FACTORY FUNCTIONS
// ───────────────────────────────────────────────────────────────

/**
 * Stat Card factory
 * Single KPI with trend indicator and sparkline
 * Default size: 3 wide × 2 tall
 */
export function createStat(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Stat,
        x, y,
        w: 3,
        h: 2,
        title: 'Total Revenue',
        locked: false,
        config: {
            value: '$124,580',
            subValue: 'vs last month',
            trend: '+18.4%',
            trendUp: true,
            accent: '#3b82f6',
            prefix: '',
            suffix: '',
            description: 'Monthly recurring revenue from all sources',
            showSparkline: true,
            sparkData: [30, 42, 38, 55, 48, 64, 58, 72, 68, 84],
            selectedFields: [],
        },
    };
}

/**
 * Analytics Card factory
 * Metric with area sparkline chart
 * Default size: 3 wide × 2 tall
 */
export function createAnalytics(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Analytics,
        x, y,
        w: 3,
        h: 2,
        title: 'Active Users',
        locked: false,
        config: {
            value: '8,291',
            changeValue: '+12.5%',
            changeLabel: 'vs last week',
            trendUp: true,
            accent: '#22c55e',
            data: [18, 25, 32, 28, 42, 38, 51, 45, 60, 54, 68, 72],
            period: 'Last 12 weeks',
            selectedFields: [],
        },
    };
}

/**
 * Bar Chart factory
 * Multi-series bar chart
 * Default size: 5 wide × 3 tall
 */
export function createBar(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Bar,
        x, y,
        w: 5,
        h: 3,
        title: 'Monthly Sales',
        locked: false,
        config: {
            accent: '#3b82f6',
            stacked: false,
            horizontal: false,
            showGrid: true,
            showLegend: false,
            series: [
                {
                    key: 'Revenue',
                    color: '#3b82f6',
                    data: [
                        { n: 'Jan', v: 42000 },
                        { n: 'Feb', v: 38000 },
                        { n: 'Mar', v: 61000 },
                        { n: 'Apr', v: 79000 },
                        { n: 'May', v: 53000 },
                        { n: 'Jun', v: 92000 },
                    ],
                },
                {
                    key: 'Expenses',
                    color: '#ef4444',
                    data: [
                        { n: 'Jan', v: 28000 },
                        { n: 'Feb', v: 24000 },
                        { n: 'Mar', v: 35000 },
                        { n: 'Apr', v: 41000 },
                        { n: 'May', v: 29000 },
                        { n: 'Jun', v: 48000 },
                    ],
                },
            ],
            selectedFields: [],
        },
    };
}

/**
 * Line / Area Chart factory
 * Multi-series line or area chart
 * Default size: 5 wide × 3 tall
 */
export function createLine(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Line,
        x, y,
        w: 5,
        h: 3,
        title: 'Weekly Visitors',
        locked: false,
        config: {
            areaFill: true,
            smooth: true,
            showGrid: true,
            showDots: false,
            showLegend: false,
            series: [
                {
                    key: 'Visitors',
                    color: '#06b6d4',
                    data: [
                        { n: 'Mon', v: 2100 },
                        { n: 'Tue', v: 4800 },
                        { n: 'Wed', v: 3300 },
                        { n: 'Thu', v: 7400 },
                        { n: 'Fri', v: 5200 },
                        { n: 'Sat', v: 8500 },
                        { n: 'Sun', v: 6900 },
                    ],
                },
                {
                    key: 'Conversions',
                    color: '#22c55e',
                    data: [
                        { n: 'Mon', v: 840 },
                        { n: 'Tue', v: 1920 },
                        { n: 'Wed', v: 1320 },
                        { n: 'Thu', v: 2960 },
                        { n: 'Fri', v: 2080 },
                        { n: 'Sat', v: 3400 },
                        { n: 'Sun', v: 2760 },
                    ],
                },
            ],
            selectedFields: [],
        },
    };
}

/**
 * Pie / Donut Chart factory
 * Part-to-whole distribution chart
 * Default size: 4 wide × 3 tall
 */
export function createPie(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Pie,
        x, y,
        w: 4,
        h: 3,
        title: 'Traffic Sources',
        locked: false,
        config: {
            innerRadius: 55,
            showLabels: false,
            showLegend: true,
            data: [
                { name: 'Organic Search', value: 4200, color: '#3b82f6' },
                { name: 'Direct', value: 3100, color: '#22c55e' },
                { name: 'Referral', value: 1800, color: '#f59e0b' },
                { name: 'Social Media', value: 1200, color: '#a78bfa' },
                { name: 'Email', value: 900, color: '#f97316' },
            ],
            selectedFields: [],
        },
    };
}

/**
 * Data Table factory
 * Tabular data with status badges
 * Default size: 7 wide × 3 tall
 */
export function createTable(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Table,
        x, y,
        w: 7,
        h: 3,
        title: 'Recent Transactions',
        locked: false,
        config: {
            striped: true,
            compact: false,
            statusColumn: true,
            columns: [
                { key: 'id', label: 'Order ID', width: 'auto' },
                { key: 'customer', label: 'Customer', width: 'auto' },
                { key: 'product', label: 'Product', width: 'auto' },
                { key: 'amount', label: 'Amount', width: 'auto' },
                { key: 'date', label: 'Date', width: 'auto' },
                { key: 'status', label: 'Status', width: 'auto' },
            ],
            rows: [
                { id: '#10481', customer: 'Alice Brennan', product: 'Pro Plan', amount: '$299.00', date: 'Dec 14', status: 'paid' },
                { id: '#10480', customer: 'Bob Kessler', product: 'Starter', amount: '$49.00', date: 'Dec 14', status: 'pending' },
                { id: '#10479', customer: 'Carol Marsh', product: 'Enterprise', amount: '$899.00', date: 'Dec 13', status: 'paid' },
                { id: '#10478', customer: 'Dave Lin', product: 'Pro Plan', amount: '$299.00', date: 'Dec 13', status: 'failed' },
                { id: '#10477', customer: 'Eve Stanton', product: 'Starter', amount: '$49.00', date: 'Dec 12', status: 'paid' },
                { id: '#10476', customer: 'Frank Ohara', product: 'Pro Plan', amount: '$299.00', date: 'Dec 12', status: 'paid' },
            ],
            selectedFields: [],
        },
    };
}

/**
 * Progress Bars factory
 * Multi-metric progress display
 * Default size: 4 wide × 3 tall
 */
export function createProgress(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Progress,
        x, y,
        w: 4,
        h: 3,
        title: 'Goal Completion',
        locked: false,
        config: {
            showValues: true,
            animated: true,
            items: [
                { label: 'Sales Target', value: 78, max: 100, color: '#3b82f6' },
                { label: 'New Customers', value: 56, max: 100, color: '#22c55e' },
                { label: 'Support Tickets', value: 91, max: 100, color: '#f59e0b' },
                { label: 'NPS Score', value: 64, max: 100, color: '#a78bfa' },
                { label: 'Uptime', value: 99, max: 100, color: '#06b6d4' },
            ],
            selectedFields: [],
        },
    };
}

/**
 * Text / Note factory
 * Free-text annotation block
 * Default size: 3 wide × 2 tall
 */
export function createNote(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Note,
        x, y,
        w: 3,
        h: 2,
        title: 'Notes',
        locked: false,
        config: {
            content: 'Add important context, reminders or annotations here.\n\nThis widget is great for team notes, action items or dashboard descriptions.',
            accent: '#94a3b8',
            fontSize: '13',
            bgColor: '#0d1219',
        },
    };
}

/**
 * Section Label factory
 * Full-width visual divider with title
 * Default size: 12 wide × 1 tall
 * Always spans full canvas width
 */
export function createSection(x: number, y: number): Widget {
    return {
        id: uid(),
        type: WidgetType.Section,
        x, y,
        w: 12,
        h: 1,
        title: 'Section',
        locked: false,
        config: {
            label: 'New Section',
            accent: '#3b82f6',
            showLine: true,
            align: TextAlign.Left,
        },
    };
}


// ───────────────────────────────────────────────────────────────
//  FACTORIES MAP
//  Single entry point — call FACTORIES[type](x, y)
// ───────────────────────────────────────────────────────────────

/**
 * Master factory map
 * Maps widget type string → factory function
 *
 * Usage:
 *   const widget = FACTORIES['stat'](0, 0);
 *   const widget = FACTORIES[catalogItem.type](x, y);
 */
export const FACTORIES: Record<WidgetType, (x: number, y: number) => Widget> = {
    [WidgetType.Stat]:      createStat,
    [WidgetType.Analytics]: createAnalytics,
    [WidgetType.Bar]:       createBar,
    [WidgetType.Line]:      createLine,
    [WidgetType.Pie]:       createPie,
    [WidgetType.Table]:     createTable,
    [WidgetType.Progress]:  createProgress,
    [WidgetType.Note]:      createNote,
    [WidgetType.Section]:   createSection,
};


// ───────────────────────────────────────────────────────────────
//  BLANK CONFIGS
//  Minimal starting configs for the Add Widget Wizard.
//  Keeps display/behaviour settings but has no pre-filled data,
//  so users configure the widget from scratch.
//
//  Templates and demo still use FACTORIES (full data included).
//  The wizard uses BLANK_CONFIGS so users see an empty canvas.
// ───────────────────────────────────────────────────────────────

export const BLANK_CONFIGS: Record<WidgetType, WidgetConfig> = {

  [WidgetType.Stat]: {
    value: '', subValue: '', trend: '', trendUp: true,
    accent: '#3b82f6', prefix: '', suffix: '', description: '',
    showSparkline: true, sparkData: [], selectedFields: [],
  } satisfies StatConfig,

  [WidgetType.Analytics]: {
    value: '', changeValue: '', changeLabel: '', trendUp: true,
    accent: '#22c55e', data: [], period: '', selectedFields: [],
  } satisfies AnalyticsConfig,

  [WidgetType.Bar]: {
    accent: '#3b82f6', stacked: false, horizontal: false,
    showGrid: true, showLegend: false, series: [], selectedFields: [],
  } satisfies BarConfig,

  [WidgetType.Line]: {
    areaFill: true, smooth: true, showGrid: true,
    showDots: false, showLegend: false, series: [], selectedFields: [],
  } satisfies LineConfig,

  [WidgetType.Pie]: {
    innerRadius: 55, showLabels: false, showLegend: true,
    data: [], selectedFields: [],
  } satisfies PieConfig,

  [WidgetType.Table]: {
    striped: true, compact: false, statusColumn: false,
    columns: [], rows: [], selectedFields: [],
  } satisfies TableConfig,

  [WidgetType.Progress]: {
    showValues: true, animated: true, items: [], selectedFields: [],
  } satisfies ProgressConfig,

  [WidgetType.Note]: {
    content: '', accent: '#94a3b8', fontSize: '13', bgColor: '#0d1219',
  } satisfies NoteConfig,

  [WidgetType.Section]: {
    label: '', accent: '#3b82f6', showLine: true, align: TextAlign.Left,
  } satisfies SectionConfig,

};


// ───────────────────────────────────────────────────────────────
//  FACTORY HELPER
// ───────────────────────────────────────────────────────────────

/**
 * Create a widget of any type at a given grid position
 * Safe wrapper around FACTORIES map with fallback
 *
 * @param type - Widget type string
 * @param x    - Grid column position
 * @param y    - Grid row position
 * @returns    - Complete Widget object or null if type unknown
 *
 * @example
 * createWidget('bar', 0, 3)
 * // → full bar chart widget at column 0, row 3
 */
export function createWidget(
    type: WidgetType,
    x: number,
    y: number
): Widget | null {
    const factory = FACTORIES[type];
    if (!factory) {
        console.warn(`createWidget: unknown type "${type}"`);
        return null;
    }
    return factory(x, y);
}