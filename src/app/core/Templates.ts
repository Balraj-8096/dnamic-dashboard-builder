// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Dashboard Templates
//
//  Product templates are defined in ProductTemplates.ts.
//  The demo layout (Load Demo) is defined here and showcases
//  all 9 widget types with live EPX query data.
//
//  Loading a template or demo:
//  ├── Replaces widgets[] entirely
//  ├── RESETS history stack to [templateWidgets]    (C3 audit)
//  ├── NOT undoable back to before template load
//  └── Sets dashTitle to template name
// ═══════════════════════════════════════════════════════════════

import { Widget, WidgetType, TextAlign } from './interfaces';
import { FACTORIES }                     from './factories';
import {
  AggregationFunction, DateInterval, SortDirection,
  FilterOperator, FilterGroup, DerivedColumnDef,
} from './query-types';

export { PRODUCT_TEMPLATES as TEMPLATES } from './ProductTemplates';


// ───────────────────────────────────────────────────────────────
//  DEMO LAYOUT — Load Demo button
//  Showcases all 9 widget types with live EPX query data.
//  B5 fix: distinct from any product template.
// ───────────────────────────────────────────────────────────────

export function buildSalesDemo(): Widget[] {
  return [

    // ── Section header ─────────────────────────────────────────
    {
      ...FACTORIES[WidgetType.Section](0, 0),
      title: 'Section',
      config: { label: 'DASHCRAFT Demo — EPX Clinical', accent: '#3b82f6', showLine: true, align: TextAlign.Left },
    },

    // ── Row 1 — 4 stat cards with live queries ─────────────────
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: 'Total Appointments',
      config: {
        value: '–', subValue: 'COUNT query', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'Live COUNT of all appointment rows',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 1),
      title: 'Completed',
      config: {
        value: '–', subValue: 'status = completed', trend: '', trendUp: true,
        accent: '#10b981', prefix: '', suffix: '',
        description: 'Appointments with status = completed',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'completed' }],
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 1),
      title: 'Total Revenue',
      config: {
        value: '–', subValue: 'SUM(price)', trend: '', trendUp: true,
        accent: '#a78bfa', prefix: '£', suffix: '',
        description: 'SUM of all consultation fees',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 1),
      title: 'Active Patients',
      config: {
        value: '–', subValue: 'patient.status = active', trend: '', trendUp: true,
        accent: '#06b6d4', prefix: '', suffix: '',
        description: 'COUNT of patients with status = active',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['patient'],
          agg: { entity: 'patient', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'patient', field: 'status', operator: FilterOperator.Eq, value: 'active' }],
          periodLabel: 'Current',
        },
      },
    },

    // ── Row 3 — analytics + pie ────────────────────────────────
    {
      ...FACTORIES[WidgetType.Analytics](0, 3),
      w: 4, h: 3,
      title: 'Appointment Trend',
      config: {
        value: '–', changeValue: '', changeLabel: 'vs previous period',
        trendUp: true, accent: '#3b82f6', data: [], period: '',
        selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          periodLabel: 'Monthly trend',
          trend: { entity: 'appointment', field: 'start_date', interval: DateInterval.Month, periods: 12 },
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Bar](4, 3),
      w: 5, h: 3,
      title: 'Appointments by Month',
      config: {
        accent: '#3b82f6', stacked: false, horizontal: false,
        showGrid: true, showLegend: false, series: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          dateAxis: { entity: 'appointment', field: 'start_date', interval: DateInterval.Month },
          valueAgg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          dateRangeField: { entity: 'appointment', field: 'start_date' },
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Pie](9, 3),
      w: 3, h: 3,
      title: 'By Payor Type',
      config: {
        innerRadius: 50, showLabels: false, showLegend: true, data: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          groupBy: { entity: 'appointment_patient', field: 'payor_type' },
          valueAgg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
        },
      },
    },

    // ── Row 6 — line + progress + note ────────────────────────
    {
      ...FACTORIES[WidgetType.Line](0, 6),
      w: 4, h: 3,
      title: 'Monthly Revenue',
      config: {
        areaFill: true, smooth: true, showGrid: true, showDots: false, showLegend: false,
        series: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          dateAxis: { entity: 'appointment', field: 'start_date', interval: DateInterval.Month },
          valueAgg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Progress](4, 6),
      w: 4, h: 3,
      title: 'Appointment Status',
      config: {
        showValues: true, animated: true, selectedFields: [],
        items: [
          { label: 'Completed', value: 0, max: 50, color: '#10b981' },
          { label: 'Confirmed', value: 0, max: 50, color: '#22c55e' },
          { label: 'Cancelled', value: 0, max: 50, color: '#6b7280' },
          { label: 'No Shows',  value: 0, max: 50, color: '#ef4444' },
        ],
        progressQueries: [
          {
            product: 'epx', entities: ['appointment', 'appointment_patient'],
            agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
            filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'completed' }],
          },
          {
            product: 'epx', entities: ['appointment', 'appointment_patient'],
            agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
            filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'confirmed' }],
          },
          {
            product: 'epx', entities: ['appointment', 'appointment_patient'],
            agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
            filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'cancelled' }],
          },
          {
            product: 'epx', entities: ['appointment', 'appointment_patient'],
            agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
            filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'no_show' }],
          },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Note](8, 6),
      w: 4, h: 3,
      title: 'Welcome to DASHCRAFT',
      config: {
        accent: '#3b82f6',
        fontSize: '13px',
        bgColor: '',
        content: `**Welcome to DASHCRAFT**

This demo uses live EPX clinical data queries.

**Getting started:**
• Drag widgets from the sidebar to the canvas
• Click any widget to select and configure it
• Use **Browse Templates** for pre-built dashboards
• Press **Ctrl+1…9** to add widgets by type

All widgets on this canvas are fully editable.`,
      },
    },

    // ── Row 9 — table with derived column ─────────────────────
    {
      ...FACTORIES[WidgetType.Table](0, 9),
      w: 12, h: 3,
      title: 'Recent Appointments',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient', 'patient', 'contact'],
          columns: [
            { entity: 'appointment',         field: 'identifier'  },
            { entity: 'appointment',         field: 'start_date'  },
            { entity: 'appointment',         field: 'status'      },
            { entity: 'appointment_patient', field: 'payor_type'  },
            { entity: 'appointment_patient', field: 'price'       },
          ],
          derivedColumns: [
            {
              key: '__derived_demo_name', label: 'Patient Name', mode: 'concat',
              sources: [
                { entity: 'contact', field: 'firstname' },
                { entity: 'contact', field: 'lastname'  },
              ],
              separator: ' ',
            } as DerivedColumnDef,
          ],
          sort:     { entity: 'appointment', field: 'start_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },
  ];
}
