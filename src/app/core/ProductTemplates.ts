// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Product Dashboard Templates  (v2)
//
//  Templates pre-wired with live queryConfig objects.
//  Every widget uses real queries so Dev Tools shows live data.
//
//  Catalogue:
//  ├── EPX Clinical        — all 9 widget types, 3 sections
//  ├── Accounting          — all 9 widget types, 3 sections
//  ├── Prescriptions       — all 9 widget types, 3 sections
//  ├── Widget Gallery      — one of each type (EPX data)
//  ├── Aggregation Showcase— COUNT / COUNT_DISTINCT / SUM / AVG / MIN / MAX
//  ├── Filter Operators    — eq, neq, gt, gte, lt, lte, is_null,
//  │                         is_not_null, in, not_in, contains
//  └── AND / OR Filter Groups — single-group & two-group combos
// ═══════════════════════════════════════════════════════════════

import { DashboardTemplate, Widget, WidgetType, TextAlign } from './interfaces';
import { FACTORIES }                                        from './factories';
import {
  AggregationFunction, DateInterval, SortDirection,
  FilterOperator, FilterGroup, DerivedColumnDef,
} from './query-types';


// ───────────────────────────────────────────────────────────────
//  SHARED HELPERS
// ───────────────────────────────────────────────────────────────

/** Short-hand for a section header */
function section(x: number, y: number, label: string, accent: string): Widget {
  return {
    ...FACTORIES[WidgetType.Section](x, y),
    title: 'Section',
    config: { label, accent, showLine: true, align: TextAlign.Left },
  };
}


// ───────────────────────────────────────────────────────────────
//  EPX CLINICAL
// ───────────────────────────────────────────────────────────────

function buildEpx(): Widget[] {
  return [

    // ── Section 1: Clinical Overview ───────────────────────────
    section(0, 0, 'EPX Clinical Overview', '#3b82f6'),

    // Row 1 — 4 KPI stat cards
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: 'Total Appointments',
      config: {
        value: '–', subValue: 'all time', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'Total appointments in the system',
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
        value: '–', subValue: 'appointments', trend: '', trendUp: true,
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
      title: 'No Shows',
      config: {
        value: '–', subValue: 'DNA appointments', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '', suffix: '',
        description: 'Appointments with status = no_show',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'no_show' }],
          periodLabel: 'All time',
        },
        // Color Thresholds: accent shifts amber at 3+, red at 6+
        colorThresholds: [
          { threshold: 6, color: '#ef4444' },
          { threshold: 3, color: '#f59e0b' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 1),
      title: 'Total Revenue',
      config: {
        value: '–', subValue: 'consultation fees', trend: '', trendUp: true,
        accent: '#a78bfa', prefix: '£', suffix: '',
        description: 'SUM of all appointment prices',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
          periodLabel: 'All time',
        },
        // Color Thresholds: accent shifts green once revenue exceeds target
        colorThresholds: [
          { threshold: 3000, color: '#10b981' },
          { threshold: 1500, color: '#f59e0b' },
        ],
      },
    },

    // Row 3 — bar chart + pie chart
    {
      ...FACTORIES[WidgetType.Bar](0, 3),
      w: 7, h: 3,
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
        // Reference Lines: monthly target + warning threshold
        referenceLines: [
          { label: 'Monthly Target', value: 5, color: '#22c55e', dash: true  },
          { label: 'Min Threshold',  value: 2, color: '#f59e0b', dash: false },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Pie](7, 3),
      w: 5, h: 3,
      title: 'By Payor Type',
      config: {
        innerRadius: 50, showLabels: false, showLegend: true, data: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          groupBy: { entity: 'appointment_patient', field: 'payor_type' },
          valueAgg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
          dateRangeField: { entity: 'appointment', field: 'start_date' },
        },
      },
    },

    // Row 6 — analytics trend + progress status + note
    {
      ...FACTORIES[WidgetType.Analytics](0, 6),
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
        // Color Thresholds: accent shifts green once volume hits target
        colorThresholds: [
          { threshold: 30, color: '#10b981' },
          { threshold: 20, color: '#3b82f6' },
          { threshold: 10, color: '#f59e0b' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Progress](4, 6),
      w: 4, h: 3,
      title: 'Status Breakdown',
      config: {
        showValues: true, animated: true, selectedFields: [],
        items: [
          { label: 'Completed', value: 0, max: 50, color: '#10b981' },
          { label: 'Confirmed', value: 0, max: 50, color: '#22c55e' },
          { label: 'Cancelled', value: 0, max: 50, color: '#6b7280' },
          { label: 'No Shows',  value: 0, max: 50, color: '#ef4444' },
        ],
        // Color Rules: bar fill shifts by fill-percentage (value/max)
        colorRules: [
          { minPercent: 70, color: '#10b981' },
          { minPercent: 40, color: '#f59e0b' },
          { minPercent: 0,  color: '#ef4444' },
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
      title: 'Dashboard Guide',
      config: {
        accent: '#3b82f6',
        fontSize: '13px',
        bgColor: '',
        content: `**EPX Clinical Overview**

Track appointment activity, revenue, and patient attendance across all sites.

• Use the **date picker** on each widget to filter by period
• The **By Payor Type** pie shows revenue split by funding source
• Status Breakdown bars compare each status against a target of 50
• Open the **Filter** panel to narrow by site, type, or date range`,
      },
    },

    // ── Section 2: Patient Analytics ───────────────────────────
    section(0, 9, 'Patient Analytics', '#3b82f6'),

    // Row 10 — 4 more stats
    {
      ...FACTORIES[WidgetType.Stat](0, 10),
      title: 'Active Patients',
      config: {
        value: '–', subValue: 'registered patients', trend: '', trendUp: true,
        accent: '#06b6d4', prefix: '', suffix: '',
        description: 'Patients with status = active',
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
    {
      ...FACTORIES[WidgetType.Stat](3, 10),
      title: 'Remote Appointments',
      config: {
        value: '–', subValue: 'video consultations', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '', suffix: '',
        description: 'Appointments via video (is_remote = true)',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'is_remote', operator: FilterOperator.Eq, value: 'true' }],
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 10),
      title: 'Avg Consultation Fee',
      config: {
        value: '–', subValue: 'per appointment', trend: '', trendUp: true,
        accent: '#f59e0b', prefix: '£', suffix: '',
        description: 'AVG(price) across all appointment rows',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Avg },
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 10),
      title: 'Invoiced Appointments',
      config: {
        value: '–', subValue: 'billed to payor', trend: '', trendUp: true,
        accent: '#a78bfa', prefix: '', suffix: '',
        description: 'Appointments where invoiced = true',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'invoiced', operator: FilterOperator.Eq, value: 'true' }],
          periodLabel: 'All time',
        },
      },
    },

    // Row 12 — line + horizontal bar
    {
      ...FACTORIES[WidgetType.Line](0, 12),
      w: 6, h: 3,
      title: 'Monthly Appointment Trend',
      config: {
        areaFill: true, smooth: true, showGrid: true, showDots: false, showLegend: false,
        series: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          dateAxis: { entity: 'appointment', field: 'start_date', interval: DateInterval.Month },
          valueAgg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          dateRangeField: { entity: 'appointment', field: 'start_date' },
        },
        // Reference Lines: target and historical average
        referenceLines: [
          { label: 'Target',   value: 5, color: '#22c55e', dash: true  },
          { label: 'Avg',      value: 3, color: '#f59e0b', dash: false },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Bar](6, 12),
      w: 6, h: 3,
      title: 'Revenue by Appointment Type',
      config: {
        accent: '#3b82f6', stacked: false, horizontal: true,
        showGrid: true, showLegend: false, series: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          groupBy: { entity: 'appointment', field: 'appointment_type' },
          valueAgg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
        },
      },
    },

    // ── Section 3: Patient Records ─────────────────────────────
    section(0, 15, 'Patient Records', '#3b82f6'),

    // Row 16 — recent appointments table (derived Full Name)
    {
      ...FACTORIES[WidgetType.Table](0, 16),
      w: 12, h: 3,
      title: 'Recent Appointments',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient', 'patient', 'contact'],
          columns: [
            { entity: 'appointment',         field: 'identifier'       },
            { entity: 'appointment',         field: 'start_date'       },
            { entity: 'appointment',         field: 'appointment_type' },
            { entity: 'appointment',         field: 'status'           },
            { entity: 'appointment_patient', field: 'payor_type'       },
            { entity: 'appointment_patient', field: 'price'            },
          ],
          derivedColumns: [
            {
              key:       '__derived_appt_fullname',
              label:     'Patient Name',
              mode:      'concat',
              sources:   [
                { entity: 'contact', field: 'title'     },
                { entity: 'contact', field: 'firstname' },
                { entity: 'contact', field: 'lastname'  },
              ],
              separator: ' ',
            } as DerivedColumnDef,
          ],
          filterGroups: [
            {
              id:    'epx-status',
              logic: 'OR',
              conditions: [
                { entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'completed' },
                { entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'confirmed' },
              ],
            } as FilterGroup,
          ],
          sort:     { entity: 'appointment', field: 'start_date', direction: SortDirection.Desc },
          pageSize: 20,
          dateRangeField: { entity: 'appointment', field: 'start_date' },
        },
      },
    },

    // Row 19 — patient contact list
    {
      ...FACTORIES[WidgetType.Table](0, 19),
      w: 12, h: 3,
      title: 'Patient Contact List',
      config: {
        striped: true, compact: true, statusColumn: false,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['patient', 'contact', 'contact_address', 'address'],
          columns: [
            { entity: 'patient',  field: 'mrn'           },
            { entity: 'patient',  field: 'date_of_birth' },
            { entity: 'patient',  field: 'sex'           },
            { entity: 'patient',  field: 'status'        },
            { entity: 'address',  field: 'address1'      },
            { entity: 'address',  field: 'postcode'      },
          ],
          derivedColumns: [
            {
              key:       '__derived_patient_fullname',
              label:     'Full Name',
              mode:      'concat',
              sources:   [
                { entity: 'contact', field: 'title'     },
                { entity: 'contact', field: 'firstname' },
                { entity: 'contact', field: 'lastname'  },
              ],
              separator: ' ',
            } as DerivedColumnDef,
          ],
          filterGroups: [
            {
              id:    'epx-patient-active',
              logic: 'AND',
              conditions: [
                { entity: 'patient', field: 'status', operator: FilterOperator.Eq, value: 'active' },
              ],
            } as FilterGroup,
          ],
          sort:     { entity: 'contact', field: 'lastname', direction: SortDirection.Asc },
          pageSize: 20,
        },
      },
    },
  ];
}


// ───────────────────────────────────────────────────────────────
//  ACCOUNTING
// ───────────────────────────────────────────────────────────────

function buildAccounting(): Widget[] {
  return [

    // ── Section 1: Invoice Overview ────────────────────────────
    section(0, 0, 'Accounting Overview', '#10b981'),

    // Row 1 — 4 KPI stats
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: 'Total Invoices',
      config: {
        value: '–', subValue: 'all invoices', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'Total invoice count',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 1),
      title: 'Total Revenue',
      config: {
        value: '–', subValue: 'invoiced amount', trend: '', trendUp: true,
        accent: '#10b981', prefix: '£', suffix: '',
        description: 'SUM of total_amount (excl. void invoices)',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          agg: { entity: 'invoice', field: 'total_amount', function: AggregationFunction.Sum },
          filters: [{ entity: 'invoice', field: 'is_void', operator: FilterOperator.Eq, value: 'false' }],
          periodLabel: 'All time',
        },
        // Color Thresholds: green above revenue target, amber approaching it
        colorThresholds: [
          { threshold: 8000, color: '#10b981' },
          { threshold: 4000, color: '#f59e0b' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 1),
      title: 'Overdue Invoices',
      config: {
        value: '–', subValue: 'need attention', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '', suffix: '',
        description: 'Invoices with status = overdue',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'overdue' }],
          periodLabel: 'All time',
        },
        // Color Thresholds: accent escalates from amber to red as overdue count grows
        colorThresholds: [
          { threshold: 8,  color: '#ef4444' },
          { threshold: 4,  color: '#f59e0b' },
          { threshold: 1,  color: '#f97316' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 1),
      title: 'Payments Received',
      config: {
        value: '–', subValue: 'cleared payments', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '£', suffix: '',
        description: 'SUM of cleared payment amounts',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice', 'payment_allocation', 'payment'],
          agg: { entity: 'payment', field: 'amount', function: AggregationFunction.Sum },
          filters: [{ entity: 'payment', field: 'status', operator: FilterOperator.Eq, value: 'cleared' }],
          periodLabel: 'All time',
        },
      },
    },

    // Row 3 — bar + pie
    {
      ...FACTORIES[WidgetType.Bar](0, 3),
      w: 7, h: 3,
      title: 'Revenue by Month',
      config: {
        accent: '#10b981', stacked: false, horizontal: false,
        showGrid: true, showLegend: false, series: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          dateAxis: { entity: 'invoice', field: 'invoice_date', interval: DateInterval.Month },
          valueAgg: { entity: 'invoice', field: 'total_amount', function: AggregationFunction.Sum },
          dateRangeField: { entity: 'invoice', field: 'invoice_date' },
        },
        // Reference Lines: monthly revenue target and break-even
        referenceLines: [
          { label: 'Monthly Target', value: 2000, color: '#22c55e', dash: true  },
          { label: 'Break-even',     value:  800, color: '#f59e0b', dash: false },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Pie](7, 3),
      w: 5, h: 3,
      title: 'Invoices by Status',
      config: {
        innerRadius: 50, showLabels: false, showLegend: true, data: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          groupBy: { entity: 'invoice', field: 'status' },
          valueAgg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          dateRangeField: { entity: 'invoice', field: 'invoice_date' },
        },
      },
    },

    // Row 6 — analytics + progress + note
    {
      ...FACTORIES[WidgetType.Analytics](0, 6),
      w: 4, h: 3,
      title: 'Invoice Trend',
      config: {
        value: '–', changeValue: '', changeLabel: 'vs previous period',
        trendUp: true, accent: '#10b981', data: [], period: '',
        selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          periodLabel: 'Monthly trend',
          trend: { entity: 'invoice', field: 'invoice_date', interval: DateInterval.Month, periods: 12 },
        },
        // Color Thresholds: green once invoice volume hits target
        colorThresholds: [
          { threshold: 15, color: '#10b981' },
          { threshold: 8,  color: '#3b82f6' },
          { threshold: 3,  color: '#f59e0b' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Progress](4, 6),
      w: 4, h: 3,
      title: 'Invoice Status',
      config: {
        showValues: true, animated: true, selectedFields: [],
        items: [
          { label: 'Paid',    value: 0, max: 50, color: '#22c55e' },
          { label: 'Sent',    value: 0, max: 50, color: '#3b82f6' },
          { label: 'Overdue', value: 0, max: 50, color: '#ef4444' },
          { label: 'Partial', value: 0, max: 50, color: '#f59e0b' },
        ],
        // Color Rules: high fill = green, mid = amber, low = red
        colorRules: [
          { minPercent: 60, color: '#22c55e' },
          { minPercent: 30, color: '#f59e0b' },
          { minPercent: 0,  color: '#ef4444' },
        ],
        progressQueries: [
          {
            product: 'accounting', entities: ['invoice'],
            agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'paid' }],
          },
          {
            product: 'accounting', entities: ['invoice'],
            agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'sent' }],
          },
          {
            product: 'accounting', entities: ['invoice'],
            agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'overdue' }],
          },
          {
            product: 'accounting', entities: ['invoice'],
            agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'partial' }],
          },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Note](8, 6),
      w: 4, h: 3,
      title: 'Dashboard Guide',
      config: {
        accent: '#10b981',
        fontSize: '13px',
        bgColor: '',
        content: `**Accounting Overview**

Monitor invoice lifecycle, revenue collection, and claim status.

• **Invoice status values:** draft → sent → paid / overdue / partial / void
• **Overdue** invoices need immediate follow-up
• Use the Payments section below to track cash-flow by method
• **Gross Value** derived column = net_amount + tax_amount`,
      },
    },

    // ── Section 2: Payments & Claims ───────────────────────────
    section(0, 9, 'Payments & Claims', '#10b981'),

    // Row 10 — 4 more stats
    {
      ...FACTORIES[WidgetType.Stat](0, 10),
      title: 'Paid Invoices',
      config: {
        value: '–', subValue: 'fully settled', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '', suffix: '',
        description: 'Invoices with status = paid',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'paid' }],
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 10),
      title: 'Sent Invoices',
      config: {
        value: '–', subValue: 'awaiting payment', trend: '', trendUp: false,
        accent: '#f59e0b', prefix: '', suffix: '',
        description: 'Invoices with status = sent (not yet paid)',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'sent' }],
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 10),
      title: 'Accepted Claims',
      config: {
        value: '–', subValue: 'by insurers', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'Claims with status = accepted',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice', 'claim'],
          agg: { entity: 'claim', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'claim', field: 'status', operator: FilterOperator.Eq, value: 'accepted' }],
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 10),
      title: 'Approved Amount',
      config: {
        value: '–', subValue: 'accepted claims', trend: '', trendUp: true,
        accent: '#10b981', prefix: '£', suffix: '',
        description: 'SUM of approved_amount from accepted claims',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice', 'claim'],
          agg: { entity: 'claim', field: 'approved_amount', function: AggregationFunction.Sum },
          filters: [{ entity: 'claim', field: 'status', operator: FilterOperator.Eq, value: 'accepted' }],
          periodLabel: 'All time',
        },
        // Color Thresholds: green once approved amount hits collection target
        colorThresholds: [
          { threshold: 5000, color: '#10b981' },
          { threshold: 2000, color: '#f59e0b' },
        ],
      },
    },

    // Row 12 — line + horizontal bar
    {
      ...FACTORIES[WidgetType.Line](0, 12),
      w: 6, h: 3,
      title: 'Monthly Revenue Trend',
      config: {
        areaFill: true, smooth: true, showGrid: true, showDots: false, showLegend: false,
        series: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          dateAxis: { entity: 'invoice', field: 'invoice_date', interval: DateInterval.Month },
          valueAgg: { entity: 'invoice', field: 'total_amount', function: AggregationFunction.Sum },
          dateRangeField: { entity: 'invoice', field: 'invoice_date' },
        },
        // Reference Lines: monthly target and last-year average
        referenceLines: [
          { label: 'Annual Target /12', value: 2000, color: '#22c55e', dash: true  },
          { label: 'Prior Year Avg',    value: 1200, color: '#6b7280', dash: false },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Bar](6, 12),
      w: 6, h: 3,
      title: 'Revenue by Invoice Type',
      config: {
        accent: '#10b981', stacked: false, horizontal: true,
        showGrid: true, showLegend: false, series: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          groupBy: { entity: 'invoice', field: 'invoice_type' },
          valueAgg: { entity: 'invoice', field: 'total_amount', function: AggregationFunction.Sum },
        },
      },
    },

    // ── Section 3: Invoice & Payment Records ───────────────────
    section(0, 15, 'Invoice & Payment Records', '#10b981'),

    // Row 16 — recent invoices with derived Gross Value
    {
      ...FACTORIES[WidgetType.Table](0, 16),
      w: 12, h: 3,
      title: 'Recent Invoices',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice'],
          columns: [
            { entity: 'invoice', field: 'invoice_number' },
            { entity: 'invoice', field: 'invoice_date'   },
            { entity: 'invoice', field: 'invoice_type'   },
            { entity: 'invoice', field: 'status'         },
            { entity: 'invoice', field: 'net_amount'     },
            { entity: 'invoice', field: 'tax_amount'     },
            { entity: 'invoice', field: 'currency_code'  },
          ],
          derivedColumns: [
            {
              key:     '__derived_gross_value',
              label:   'Gross Value',
              mode:    'sum',
              sources: [
                { entity: 'invoice', field: 'net_amount' },
                { entity: 'invoice', field: 'tax_amount' },
              ],
            } as DerivedColumnDef,
          ],
          filterGroups: [
            {
              id:    'acc-status-active',
              logic: 'OR',
              conditions: [
                { entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'sent'    },
                { entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'overdue' },
              ],
            } as FilterGroup,
            {
              id:    'acc-not-void',
              logic: 'AND',
              conditions: [
                { entity: 'invoice', field: 'is_void', operator: FilterOperator.Eq, value: 'false' },
              ],
            } as FilterGroup,
          ],
          sort:     { entity: 'invoice', field: 'invoice_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },

    // Row 19 — payments table + claims table
    {
      ...FACTORIES[WidgetType.Table](0, 19),
      w: 6, h: 3,
      title: 'Recent Payments',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice', 'payment_allocation', 'payment'],
          columns: [
            { entity: 'payment', field: 'payment_date'   },
            { entity: 'payment', field: 'payment_method' },
            { entity: 'payment', field: 'amount'         },
            { entity: 'payment', field: 'status'         },
            { entity: 'payment', field: 'reference'      },
          ],
          sort:     { entity: 'payment', field: 'payment_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Table](6, 19),
      w: 6, h: 3,
      title: 'Claims Overview',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'accounting',
          entities: ['invoice', 'claim', 'payer'],
          columns: [
            { entity: 'claim', field: 'claim_number'   },
            { entity: 'claim', field: 'submitted_date' },
            { entity: 'claim', field: 'status'         },
            { entity: 'claim', field: 'claimed_amount' },
            { entity: 'claim', field: 'approved_amount'},
            { entity: 'payer', field: 'name'           },
          ],
          derivedColumns: [
            {
              key:     '__derived_claim_variance',
              label:   'Variance',
              mode:    'subtract',
              sources: [
                { entity: 'claim', field: 'claimed_amount'  },
                { entity: 'claim', field: 'approved_amount' },
              ],
            } as DerivedColumnDef,
          ],
          filterGroups: [
            {
              id:    'acc-claim-active',
              logic: 'OR',
              conditions: [
                { entity: 'claim', field: 'status', operator: FilterOperator.Eq, value: 'submitted' },
                { entity: 'claim', field: 'status', operator: FilterOperator.Eq, value: 'accepted'  },
              ],
            } as FilterGroup,
          ],
          sort:     { entity: 'claim', field: 'submitted_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },
  ];
}


// ───────────────────────────────────────────────────────────────
//  PRESCRIPTIONS
// ───────────────────────────────────────────────────────────────

function buildPrescriptions(): Widget[] {
  return [

    // ── Section 1: Prescription Overview ───────────────────────
    section(0, 0, 'Prescriptions Overview', '#a78bfa'),

    // Row 1 — 4 KPI stats
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: 'Total Prescriptions',
      config: {
        value: '–', subValue: 'all time', trend: '', trendUp: true,
        accent: '#a78bfa', prefix: '', suffix: '',
        description: 'Total prescriptions issued',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 1),
      title: 'Active Prescriptions',
      config: {
        value: '–', subValue: 'currently active', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'Prescriptions with status = active',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'active' }],
          periodLabel: 'Current',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 1),
      title: 'Controlled Substances',
      config: {
        value: '–', subValue: 'prescriptions', trend: '', trendUp: false,
        accent: '#f97316', prefix: '', suffix: '',
        description: 'Prescriptions for controlled medications',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription', 'prescription_item', 'medication'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'medication', field: 'is_controlled', operator: FilterOperator.Eq, value: 'true' }],
          periodLabel: 'All time',
        },
        // Color Thresholds: escalates as controlled-substance volume grows
        colorThresholds: [
          { threshold: 10, color: '#ef4444' },
          { threshold:  5, color: '#f97316' },
          { threshold:  2, color: '#f59e0b' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 1),
      title: 'Repeat Prescriptions',
      config: {
        value: '–', subValue: 'repeat scripts', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '', suffix: '',
        description: 'Prescriptions where is_repeat = true',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'prescription', field: 'is_repeat', operator: FilterOperator.Eq, value: 'true' }],
          periodLabel: 'All time',
        },
      },
    },

    // Row 3 — bar + pie
    {
      ...FACTORIES[WidgetType.Bar](0, 3),
      w: 7, h: 3,
      title: 'Prescriptions by Month',
      config: {
        accent: '#a78bfa', stacked: false, horizontal: false,
        showGrid: true, showLegend: false, series: [], selectedFields: [],
        // Reference Lines: monthly volume targets
        referenceLines: [
          { label: 'Monthly Target', value: 8,  color: '#22c55e', dash: true  },
          { label: 'Min Threshold',  value: 3,  color: '#f59e0b', dash: false },
        ],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription'],
          dateAxis: { entity: 'prescription', field: 'prescribed_date', interval: DateInterval.Month },
          valueAgg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          dateRangeField: { entity: 'prescription', field: 'prescribed_date' },
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Pie](7, 3),
      w: 5, h: 3,
      title: 'By Drug Class',
      config: {
        innerRadius: 50, showLabels: false, showLegend: true, data: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription', 'prescription_item', 'medication'],
          groupBy: { entity: 'medication', field: 'drug_class' },
          valueAgg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          topN: 8,
          dateRangeField: { entity: 'prescription', field: 'prescribed_date' },
        },
      },
    },

    // Row 6 — analytics + progress + note
    {
      ...FACTORIES[WidgetType.Analytics](0, 6),
      w: 4, h: 3,
      title: 'Prescription Trend',
      config: {
        value: '–', changeValue: '', changeLabel: 'vs previous period',
        trendUp: true, accent: '#a78bfa', data: [], period: '',
        selectedFields: [],
        // Color Thresholds: accent shifts with prescription volume
        colorThresholds: [
          { threshold: 20, color: '#10b981' },
          { threshold: 10, color: '#3b82f6' },
          { threshold:  5, color: '#f59e0b' },
        ],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          periodLabel: 'Monthly trend',
          trend: { entity: 'prescription', field: 'prescribed_date', interval: DateInterval.Month, periods: 12 },
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Progress](4, 6),
      w: 4, h: 3,
      title: 'Prescription Status',
      config: {
        showValues: true, animated: true, selectedFields: [],
        items: [
          { label: 'Active',    value: 0, max: 50, color: '#3b82f6' },
          { label: 'Dispensed', value: 0, max: 50, color: '#10b981' },
          { label: 'Partial',   value: 0, max: 50, color: '#f59e0b' },
          { label: 'Expired',   value: 0, max: 50, color: '#f97316' },
        ],
        // Color Rules: bar fill shifts by completion percentage
        colorRules: [
          { minPercent: 60, color: '#10b981' },
          { minPercent: 30, color: '#f59e0b' },
          { minPercent: 0,  color: '#ef4444' },
        ],
        progressQueries: [
          {
            product: 'prescriptions', entities: ['prescription'],
            agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'active' }],
          },
          {
            product: 'prescriptions', entities: ['prescription'],
            agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'dispensed' }],
          },
          {
            product: 'prescriptions', entities: ['prescription'],
            agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'partial' }],
          },
          {
            product: 'prescriptions', entities: ['prescription'],
            agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
            filters: [{ entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'expired' }],
          },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Note](8, 6),
      w: 4, h: 3,
      title: 'Dashboard Guide',
      config: {
        accent: '#a78bfa',
        fontSize: '13px',
        bgColor: '',
        content: `**Prescriptions Overview**

Monitor prescription activity, controlled substances, and dispensing rates.

• **Status values:** active → dispensed / partial / expired / cancelled
• **Controlled substances** require additional regulatory oversight
• The **Drug Class** pie uses Top-8 grouping — rare classes roll into "Other"
• **Prescriber Name** is a derived column (firstname + lastname)`,
      },
    },

    // ── Section 2: Dispensing Activity ─────────────────────────
    section(0, 9, 'Dispensing & Prescribers', '#a78bfa'),

    // Row 10 — 4 more stats
    {
      ...FACTORIES[WidgetType.Stat](0, 10),
      title: 'Total Dispenses',
      config: {
        value: '–', subValue: 'items dispensed', trend: '', trendUp: true,
        accent: '#06b6d4', prefix: '', suffix: '',
        description: 'Total number of dispense records',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription', 'dispense'],
          agg: { entity: 'dispense', field: 'id', function: AggregationFunction.Count },
          periodLabel: 'All time',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 10),
      title: 'Expired Prescriptions',
      config: {
        value: '–', subValue: 'past expiry', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '', suffix: '',
        description: 'Prescriptions with status = expired',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'expired' }],
          periodLabel: 'All time',
        },
        // Color Thresholds: escalates as expired volume rises
        colorThresholds: [
          { threshold: 8,  color: '#ef4444' },
          { threshold: 4,  color: '#f97316' },
          { threshold: 1,  color: '#f59e0b' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 10),
      title: 'Emergency Priority',
      config: {
        value: '–', subValue: 'urgent scripts', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '', suffix: '',
        description: 'Prescriptions with priority = emergency',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'prescription', field: 'priority', operator: FilterOperator.Eq, value: 'emergency' }],
          periodLabel: 'All time',
        },
        // Color Thresholds: red escalation as emergency count grows
        colorThresholds: [
          { threshold: 5,  color: '#ef4444' },
          { threshold: 2,  color: '#f97316' },
          { threshold: 1,  color: '#f59e0b' },
        ],
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 10),
      title: 'Active Prescribers',
      config: {
        value: '–', subValue: 'licensed clinicians', trend: '', trendUp: true,
        accent: '#a78bfa', prefix: '', suffix: '',
        description: 'Prescribers with is_active = true',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescriber'],
          agg: { entity: 'prescriber', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'prescriber', field: 'is_active', operator: FilterOperator.Eq, value: 'true' }],
          periodLabel: 'Current',
        },
      },
    },

    // Row 12 — line + horizontal bar
    {
      ...FACTORIES[WidgetType.Line](0, 12),
      w: 6, h: 3,
      title: 'Dispenses by Month',
      config: {
        areaFill: true, smooth: true, showGrid: true, showDots: false, showLegend: false,
        series: [], selectedFields: [],
        // Reference Lines: dispensing performance bands
        referenceLines: [
          { label: 'Target',   value: 10, color: '#22c55e', dash: true  },
          { label: 'Baseline', value:  4, color: '#6b7280', dash: false },
        ],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription', 'dispense'],
          dateAxis: { entity: 'dispense', field: 'dispensed_date', interval: DateInterval.Month },
          valueAgg: { entity: 'dispense', field: 'id', function: AggregationFunction.Count },
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Bar](6, 12),
      w: 6, h: 3,
      title: 'Prescriptions by Prescriber Type',
      config: {
        accent: '#a78bfa', stacked: false, horizontal: true,
        showGrid: true, showLegend: false, series: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription', 'prescriber'],
          groupBy: { entity: 'prescriber', field: 'prescriber_type' },
          valueAgg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
        },
      },
    },

    // ── Section 3: Prescription Records ────────────────────────
    section(0, 15, 'Prescription Records', '#a78bfa'),

    // Row 16 — recent prescriptions with derived Prescriber & Medication
    {
      ...FACTORIES[WidgetType.Table](0, 16),
      w: 12, h: 3,
      title: 'Recent Prescriptions',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription', 'prescription_item', 'medication', 'prescriber'],
          columns: [
            { entity: 'prescription',      field: 'prescription_number' },
            { entity: 'prescription',      field: 'prescribed_date'     },
            { entity: 'prescription',      field: 'status'              },
            { entity: 'prescription',      field: 'priority'            },
            { entity: 'medication',        field: 'drug_class'          },
            { entity: 'medication',        field: 'is_controlled'       },
            { entity: 'prescription_item', field: 'quantity'            },
          ],
          derivedColumns: [
            {
              key:       '__derived_rx_prescriber',
              label:     'Prescriber',
              mode:      'concat',
              sources:   [
                { entity: 'prescriber', field: 'firstname' },
                { entity: 'prescriber', field: 'lastname'  },
              ],
              separator: ' ',
            } as DerivedColumnDef,
            {
              key:       '__derived_rx_medication',
              label:     'Medication',
              mode:      'concat',
              sources:   [
                { entity: 'medication', field: 'name'     },
                { entity: 'medication', field: 'strength' },
              ],
              separator: ' ',
            } as DerivedColumnDef,
          ],
          filterGroups: [
            {
              id:    'rx-status',
              logic: 'OR',
              conditions: [
                { entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'active'    },
                { entity: 'prescription', field: 'status', operator: FilterOperator.Eq, value: 'dispensed' },
              ],
            } as FilterGroup,
          ],
          sort:     { entity: 'prescription', field: 'prescribed_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },

    // Row 19 — dispenses + prescriber directory
    {
      ...FACTORIES[WidgetType.Table](0, 19),
      w: 6, h: 3,
      title: 'Recent Dispenses',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescription', 'dispense'],
          columns: [
            { entity: 'prescription', field: 'prescription_number' },
            { entity: 'dispense',     field: 'dispensed_date'      },
            { entity: 'dispense',     field: 'dispensed_quantity'  },
            { entity: 'dispense',     field: 'status'              },
            { entity: 'dispense',     field: 'site_id'             },
          ],
          sort:     { entity: 'dispense', field: 'dispensed_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Table](6, 19),
      w: 6, h: 3,
      title: 'Prescriber Directory',
      config: {
        striped: true, compact: true, statusColumn: false,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions',
          entities: ['prescriber'],
          columns: [
            { entity: 'prescriber', field: 'firstname'        },
            { entity: 'prescriber', field: 'lastname'         },
            { entity: 'prescriber', field: 'prescriber_type'  },
            { entity: 'prescriber', field: 'specialty'        },
            { entity: 'prescriber', field: 'site_id'          },
            { entity: 'prescriber', field: 'is_active'        },
          ],
          sort:     { entity: 'prescriber', field: 'lastname', direction: SortDirection.Asc },
          pageSize: 20,
        },
      },
    },
  ];
}


// ───────────────────────────────────────────────────────────────
//  WIDGET GALLERY  — one of each of the 9 widget types
// ───────────────────────────────────────────────────────────────

function buildWidgetGallery(): Widget[] {
  return [
    section(0, 0, 'Widget Gallery — One of Each Type', '#6366f1'),

    // Row 1: Stat (3×2)
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: '① Stat Card',
      config: {
        value: '–', subValue: 'COUNT appointments',
        trend: '', trendUp: true, accent: '#6366f1', prefix: '', suffix: '',
        description: 'Stat card with live COUNT query',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          periodLabel: 'All time',
        },
      },
    },

    // Analytics (3×2) — same row
    {
      ...FACTORIES[WidgetType.Analytics](3, 1),
      title: '② Analytics Card',
      config: {
        value: '–', changeValue: '', changeLabel: 'vs previous period',
        trendUp: true, accent: '#8b5cf6', data: [], period: '',
        selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
          periodLabel: 'Monthly revenue',
          trend: { entity: 'appointment', field: 'start_date', interval: DateInterval.Month, periods: 12 },
        },
      },
    },

    // Progress (3×2)
    {
      ...FACTORIES[WidgetType.Progress](6, 1),
      title: '③ Progress Bars',
      config: {
        showValues: true, animated: true, selectedFields: [],
        items: [
          { label: 'Completed', value: 0, max: 50, color: '#10b981' },
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
            filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'no_show' }],
          },
        ],
      },
    },

    // Note (3×2)
    {
      ...FACTORIES[WidgetType.Note](9, 1),
      title: '④ Note Widget',
      config: {
        accent: '#6366f1',
        fontSize: '13px',
        bgColor: '',
        content: `**④ Note Widget**

Free-text Markdown notes. Great for:
• Dashboard documentation
• Data caveats and warnings
• Team instructions

Supports **bold**, *italic*, and \`code\`.`,
      },
    },

    // Row 3: Bar (5×3), Pie (4×3), Line (shown below)
    {
      ...FACTORIES[WidgetType.Bar](0, 3),
      w: 5, h: 3,
      title: '⑤ Bar Chart',
      config: {
        accent: '#6366f1', stacked: false, horizontal: false,
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
      ...FACTORIES[WidgetType.Pie](5, 3),
      w: 4, h: 3,
      title: '⑥ Pie / Donut Chart',
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
    {
      ...FACTORIES[WidgetType.Line](9, 3),
      w: 3, h: 3,
      title: '⑦ Line / Area Chart',
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

    // Row 6: Section
    section(0, 6, 'Data Tables & Section Labels', '#6366f1'),

    // Row 7: Table (12×3)
    {
      ...FACTORIES[WidgetType.Table](0, 7),
      w: 12, h: 3,
      title: '⑧ Data Table',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient', 'patient', 'contact'],
          columns: [
            { entity: 'appointment',         field: 'identifier'   },
            { entity: 'appointment',         field: 'start_date'   },
            { entity: 'appointment',         field: 'status'       },
            { entity: 'appointment_patient', field: 'payor_type'   },
            { entity: 'appointment_patient', field: 'price'        },
          ],
          derivedColumns: [
            {
              key: '__derived_gallery_name', label: 'Patient Name', mode: 'concat',
              sources: [
                { entity: 'contact', field: 'firstname' },
                { entity: 'contact', field: 'lastname'  },
              ],
              separator: ' ',
            } as DerivedColumnDef,
          ],
          sort: { entity: 'appointment', field: 'start_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },
  ];
}


// ───────────────────────────────────────────────────────────────
//  AGGREGATION FUNCTIONS SHOWCASE
//  Demonstrates: COUNT, COUNT_DISTINCT, SUM, AVG, MIN, MAX
//  on all three products. Each widget is annotated.
// ───────────────────────────────────────────────────────────────

function buildAggregations(): Widget[] {
  return [
    section(0, 0, 'Aggregation Functions — EPX Clinical', '#6366f1'),

    // [COUNT] total rows
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: 'COUNT — Total Appointments',
      config: {
        value: '–', subValue: 'COUNT(appointment_id)', trend: '', trendUp: true,
        accent: '#6366f1', prefix: '', suffix: '',
        description: 'COUNT: counts every row in the join result',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          periodLabel: 'All records',
        },
      },
    },
    // [COUNT_DISTINCT] unique patients
    {
      ...FACTORIES[WidgetType.Stat](3, 1),
      title: 'COUNT DISTINCT — Unique Patients',
      config: {
        value: '–', subValue: 'COUNT_DISTINCT(patient_id)', trend: '', trendUp: true,
        accent: '#8b5cf6', prefix: '', suffix: '',
        description: 'COUNT_DISTINCT: deduplicates patient_id — fewer than total rows',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'patient_id', function: AggregationFunction.CountDistinct },
          periodLabel: 'All records',
        },
      },
    },
    // [SUM]
    {
      ...FACTORIES[WidgetType.Stat](6, 1),
      title: 'SUM — Total Revenue',
      config: {
        value: '–', subValue: 'SUM(price)', trend: '', trendUp: true,
        accent: '#10b981', prefix: '£', suffix: '',
        description: 'SUM: adds all price values across joined rows',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
          periodLabel: 'All records',
        },
      },
    },
    // [AVG]
    {
      ...FACTORIES[WidgetType.Stat](9, 1),
      title: 'AVG — Mean Fee',
      config: {
        value: '–', subValue: 'AVG(price)', trend: '', trendUp: true,
        accent: '#f59e0b', prefix: '£', suffix: '',
        description: 'AVG: arithmetic mean — includes £0 for dna/cancelled rows',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Avg },
          periodLabel: 'All records',
        },
      },
    },

    // Row 2 — MIN, MAX, AVG(nullable), MIN(duration)
    {
      ...FACTORIES[WidgetType.Stat](0, 3),
      title: 'MIN — Lowest Price',
      config: {
        value: '–', subValue: 'MIN(price)', trend: '', trendUp: true,
        accent: '#06b6d4', prefix: '£', suffix: '',
        description: 'MIN: smallest price value (£0.00 for dna/cancelled)',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Min },
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 3),
      title: 'MAX — Highest Price',
      config: {
        value: '–', subValue: 'MAX(price)', trend: '', trendUp: true,
        accent: '#ef4444', prefix: '£', suffix: '',
        description: 'MAX: largest price value in the dataset',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Max },
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 3),
      title: 'AVG Rating (nulls skipped)',
      config: {
        value: '–', subValue: 'AVG(rating)', trend: '', trendUp: true,
        accent: '#f97316', prefix: '', suffix: ' / 5',
        description: 'AVG on nullable field: NULL ratings are excluded automatically',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'rating', function: AggregationFunction.Avg },
          periodLabel: 'Rated appointments',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 3),
      title: 'MIN Duration',
      config: {
        value: '–', subValue: 'MIN(duration_minutes)', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '', suffix: ' min',
        description: 'MIN on appointment.duration_minutes — shortest slot',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment'],
          agg: { entity: 'appointment', field: 'duration_minutes', function: AggregationFunction.Min },
          periodLabel: 'All records',
        },
      },
    },

    // Row 5 — Charts using COUNT and SUM in groupBy context
    {
      ...FACTORIES[WidgetType.Bar](0, 5),
      w: 7, h: 3,
      title: 'COUNT by Month — Bar Chart',
      config: {
        accent: '#6366f1', stacked: false, horizontal: false,
        showGrid: true, showLegend: false, series: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          dateAxis: { entity: 'appointment', field: 'start_date', interval: DateInterval.Month },
          valueAgg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Pie](7, 5),
      w: 5, h: 3,
      title: 'SUM Revenue by Payor — Pie',
      config: {
        innerRadius: 50, showLabels: false, showLegend: true, data: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          groupBy: { entity: 'appointment_patient', field: 'payor_type' },
          valueAgg: { entity: 'appointment_patient', field: 'price', function: AggregationFunction.Sum },
        },
      },
    },

    // ── Accounting aggregations ─────────────────────────────────
    section(0, 8, 'Aggregation Functions — Accounting', '#10b981'),

    {
      ...FACTORIES[WidgetType.Stat](0, 9),
      title: 'COUNT — Total Invoices',
      config: {
        value: '–', subValue: 'COUNT(invoice.id)', trend: '', trendUp: true,
        accent: '#10b981', prefix: '', suffix: '',
        description: 'COUNT: total invoice rows',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 9),
      title: 'SUM — Total Invoice Amount',
      config: {
        value: '–', subValue: 'SUM(total_amount)', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '£', suffix: '',
        description: 'SUM(total_amount) on all non-void invoices',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice'],
          agg: { entity: 'invoice', field: 'total_amount', function: AggregationFunction.Sum },
          filters: [{ entity: 'invoice', field: 'is_void', operator: FilterOperator.Eq, value: 'false' }],
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 9),
      title: 'AVG — Invoice Amount',
      config: {
        value: '–', subValue: 'AVG(total_amount)', trend: '', trendUp: true,
        accent: '#f59e0b', prefix: '£', suffix: '',
        description: 'AVG(total_amount) across all invoices',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice'],
          agg: { entity: 'invoice', field: 'total_amount', function: AggregationFunction.Avg },
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 9),
      title: 'SUM Write-offs (nullable)',
      config: {
        value: '–', subValue: 'SUM(write_off_amount)', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '£', suffix: '',
        description: 'SUM on nullable write_off_amount — NULL rows contribute zero',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice'],
          agg: { entity: 'invoice', field: 'write_off_amount', function: AggregationFunction.Sum },
          periodLabel: 'All records',
        },
      },
    },

    // ── Prescriptions aggregations ─────────────────────────────
    section(0, 11, 'Aggregation Functions — Prescriptions', '#a78bfa'),

    {
      ...FACTORIES[WidgetType.Stat](0, 12),
      title: 'COUNT — Total Prescriptions',
      config: {
        value: '–', subValue: 'COUNT(prescription.id)', trend: '', trendUp: true,
        accent: '#a78bfa', prefix: '', suffix: '',
        description: 'COUNT: total prescription rows',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 12),
      title: 'COUNT DISTINCT — Unique Prescribers',
      config: {
        value: '–', subValue: 'COUNT_DISTINCT(prescriber_id)', trend: '', trendUp: true,
        accent: '#8b5cf6', prefix: '', suffix: '',
        description: 'COUNT_DISTINCT: unique prescribers with at least one prescription',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription'],
          agg: { entity: 'prescription', field: 'prescriber_id', function: AggregationFunction.CountDistinct },
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 12),
      title: 'SUM — Quantity Dispensed',
      config: {
        value: '–', subValue: 'SUM(dispensed_quantity)', trend: '', trendUp: true,
        accent: '#06b6d4', prefix: '', suffix: ' units',
        description: 'SUM(dispensed_quantity) across all dispense records',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription', 'dispense'],
          agg: { entity: 'dispense', field: 'dispensed_quantity', function: AggregationFunction.Sum },
          periodLabel: 'All records',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 12),
      title: 'AVG Repeat Count (dilution)',
      config: {
        value: '–', subValue: 'AVG(repeat_count)', trend: '', trendUp: false,
        accent: '#f97316', prefix: '', suffix: ' repeats',
        description: 'AVG(repeat_count) includes is_repeat=false rows (value=0) — dilutes the average',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription'],
          agg: { entity: 'prescription', field: 'repeat_count', function: AggregationFunction.Avg },
          periodLabel: 'All — includes non-repeat rows',
        },
      },
    },
  ];
}


// ───────────────────────────────────────────────────────────────
//  FILTER OPERATORS SHOWCASE
//  One widget per operator: eq, neq, gt, gte, lt, lte,
//  is_null, is_not_null, in, not_in, contains
// ───────────────────────────────────────────────────────────────

function buildFilterOps(): Widget[] {
  return [
    section(0, 0, 'Filter Operators — EQ / NEQ / GT / GTE / LT / LTE', '#ec4899'),

    // EQ — exact match
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: 'EQ — Completed',
      config: {
        value: '–', subValue: 'status = "completed"', trend: '', trendUp: true,
        accent: '#10b981', prefix: '', suffix: '',
        description: 'EQ: appointment.status equals "completed"',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'completed' }],
          periodLabel: 'EQ filter',
        },
      },
    },
    // NEQ — exclude a value
    {
      ...FACTORIES[WidgetType.Stat](3, 1),
      title: 'NEQ — Not Cancelled',
      config: {
        value: '–', subValue: 'status ≠ "cancelled"', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'NEQ: appointment.status not equal to "cancelled"',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'status', operator: FilterOperator.Neq, value: 'cancelled' }],
          periodLabel: 'NEQ filter',
        },
      },
    },
    // GT — price above threshold
    {
      ...FACTORIES[WidgetType.Stat](6, 1),
      title: 'GT — Price > £75',
      config: {
        value: '–', subValue: 'price > 75', trend: '', trendUp: true,
        accent: '#f59e0b', prefix: '', suffix: '',
        description: 'GT: appointment_patient.price greater than 75',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment_patient', field: 'price', operator: FilterOperator.Gt, value: '75' }],
          periodLabel: 'GT filter',
        },
      },
    },
    // LT — short appointments
    {
      ...FACTORIES[WidgetType.Stat](9, 1),
      title: 'LT — Duration < 45 min',
      config: {
        value: '–', subValue: 'duration_minutes < 45', trend: '', trendUp: true,
        accent: '#a78bfa', prefix: '', suffix: '',
        description: 'LT: appointment.duration_minutes less than 45',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment'],
          agg: { entity: 'appointment', field: 'id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'duration_minutes', operator: FilterOperator.Lt, value: '45' }],
          periodLabel: 'LT filter',
        },
      },
    },

    // Row 3 — GTE, LTE, IS_NULL, IS_NOT_NULL
    {
      ...FACTORIES[WidgetType.Stat](0, 3),
      title: 'GTE — Price ≥ £100',
      config: {
        value: '–', subValue: 'price ≥ 100', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '', suffix: '',
        description: 'GTE: price greater than or equal to 100',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment_patient', field: 'price', operator: FilterOperator.Gte, value: '100' }],
          periodLabel: 'GTE filter',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 3),
      title: 'LTE — Rating ≤ 2',
      config: {
        value: '–', subValue: 'rating ≤ 2', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '', suffix: '',
        description: 'LTE: rating less than or equal to 2 (low satisfaction)',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment_patient', field: 'rating', operator: FilterOperator.Lte, value: '2' }],
          periodLabel: 'LTE filter',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 3),
      title: 'IS NULL — No Rating',
      config: {
        value: '–', subValue: 'rating IS NULL', trend: '', trendUp: false,
        accent: '#6b7280', prefix: '', suffix: '',
        description: 'IS_NULL: appointments where rating has not been submitted',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment_patient', field: 'rating', operator: FilterOperator.IsNull }],
          periodLabel: 'IS_NULL filter',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 3),
      title: 'IS NOT NULL — Rated',
      config: {
        value: '–', subValue: 'rating IS NOT NULL', trend: '', trendUp: true,
        accent: '#10b981', prefix: '', suffix: '',
        description: 'IS_NOT_NULL: appointments where rating has been submitted',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment_patient', field: 'rating', operator: FilterOperator.IsNotNull }],
          periodLabel: 'IS_NOT_NULL filter',
        },
      },
    },

    section(0, 5, 'Filter Operators — IN / NOT_IN / CONTAINS', '#ec4899'),

    // IN — multiple values
    {
      ...FACTORIES[WidgetType.Stat](0, 6),
      title: 'IN — Consultation or Procedure',
      config: {
        value: '–', subValue: 'appointment_type IN [...]', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'IN: appointment_type in ["consultation", "procedure"]',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'appointment_type', operator: FilterOperator.In, value: 'consultation,procedure' }],
          periodLabel: 'IN filter',
        },
      },
    },
    // NOT_IN
    {
      ...FACTORIES[WidgetType.Stat](3, 6),
      title: 'NOT IN — Exclude Follow-up & Screening',
      config: {
        value: '–', subValue: 'type NOT IN [...]', trend: '', trendUp: true,
        accent: '#8b5cf6', prefix: '', suffix: '',
        description: 'NOT_IN: appointment_type not in ["follow_up", "screening"]',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'appointment_type', operator: FilterOperator.NotIn, value: 'follow_up,screening' }],
          periodLabel: 'NOT_IN filter',
        },
      },
    },
    // CONTAINS — text search
    {
      ...FACTORIES[WidgetType.Stat](6, 6),
      title: 'CONTAINS — Identifier "APT"',
      config: {
        value: '–', subValue: 'identifier CONTAINS "APT"', trend: '', trendUp: true,
        accent: '#06b6d4', prefix: '', suffix: '',
        description: 'CONTAINS: appointment.identifier contains the substring "APT"',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'identifier', operator: FilterOperator.Contains, value: 'APT' }],
          periodLabel: 'CONTAINS filter',
        },
      },
    },
    // Analytics card showing IN filter driving a chart
    {
      ...FACTORIES[WidgetType.Analytics](9, 6),
      title: 'IN filter — Trend',
      config: {
        value: '–', changeValue: '', changeLabel: 'vs previous period',
        trendUp: true, accent: '#ec4899', data: [], period: '',
        selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filters: [{ entity: 'appointment', field: 'appointment_type', operator: FilterOperator.In, value: 'consultation,procedure' }],
          periodLabel: 'Consultation + Procedure trend',
          trend: { entity: 'appointment', field: 'start_date', interval: DateInterval.Month, periods: 12 },
        },
      },
    },

    // Table showing filters applied
    {
      ...FACTORIES[WidgetType.Table](0, 8),
      w: 12, h: 3,
      title: 'IS_NOT_NULL Rating — Appointments with Feedback',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          columns: [
            { entity: 'appointment',         field: 'identifier'  },
            { entity: 'appointment',         field: 'start_date'  },
            { entity: 'appointment',         field: 'status'      },
            { entity: 'appointment_patient', field: 'payor_type'  },
            { entity: 'appointment_patient', field: 'rating'      },
            { entity: 'appointment_patient', field: 'price'       },
          ],
          filterGroups: [
            {
              id: 'filter-ops-notnull', logic: 'AND',
              conditions: [
                { entity: 'appointment_patient', field: 'rating', operator: FilterOperator.IsNotNull },
              ],
            } as FilterGroup,
          ],
          sort: { entity: 'appointment_patient', field: 'rating', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },
  ];
}


// ───────────────────────────────────────────────────────────────
//  AND / OR FILTER GROUPS SHOWCASE
//  Shows: single AND group, single OR group, and two-group
//  combinations on all three products.
// ───────────────────────────────────────────────────────────────

function buildFilterGroups(): Widget[] {
  return [
    // ── EPX ────────────────────────────────────────────────────
    section(0, 0, 'AND / OR Filter Groups — EPX', '#3b82f6'),

    // Single AND group
    {
      ...FACTORIES[WidgetType.Stat](0, 1),
      title: 'AND — Completed + Invoiced',
      config: {
        value: '–', subValue: 'AND group', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'Single AND group: status=completed AND invoiced=true',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'and-group-1', logic: 'AND',
              conditions: [
                { entity: 'appointment', field: 'status',   operator: FilterOperator.Eq, value: 'completed' },
                { entity: 'appointment', field: 'invoiced', operator: FilterOperator.Eq, value: 'true'      },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'AND group',
        },
      },
    },
    // Single OR group
    {
      ...FACTORIES[WidgetType.Stat](3, 1),
      title: 'OR — Completed or Confirmed',
      config: {
        value: '–', subValue: 'OR group', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '', suffix: '',
        description: 'Single OR group: status=completed OR status=confirmed',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'or-group-1', logic: 'OR',
              conditions: [
                { entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'completed' },
                { entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'confirmed' },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR group',
        },
      },
    },
    // Two-group: OR status then AND invoiced
    {
      ...FACTORIES[WidgetType.Stat](6, 1),
      title: 'OR + AND — Active & Billed',
      config: {
        value: '–', subValue: 'two filter groups', trend: '', trendUp: true,
        accent: '#f59e0b', prefix: '', suffix: '',
        description: 'Two groups: (completed OR confirmed) AND invoiced=true',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'two-group-or', logic: 'OR',
              conditions: [
                { entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'completed' },
                { entity: 'appointment', field: 'status', operator: FilterOperator.Eq, value: 'confirmed' },
              ],
            } as FilterGroup,
            {
              id: 'two-group-and', logic: 'AND',
              conditions: [
                { entity: 'appointment', field: 'invoiced', operator: FilterOperator.Eq, value: 'true' },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR+AND groups',
        },
      },
    },
    // OR payor type
    {
      ...FACTORIES[WidgetType.Stat](9, 1),
      title: 'OR — Insurance or NHS',
      config: {
        value: '–', subValue: 'payor_type OR group', trend: '', trendUp: true,
        accent: '#06b6d4', prefix: '', suffix: '',
        description: 'OR group: payor_type=insurance OR payor_type=nhs',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'epx', entities: ['appointment', 'appointment_patient'],
          agg: { entity: 'appointment_patient', field: 'appointment_id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'or-payor', logic: 'OR',
              conditions: [
                { entity: 'appointment_patient', field: 'payor_type', operator: FilterOperator.Eq, value: 'insurance' },
                { entity: 'appointment_patient', field: 'payor_type', operator: FilterOperator.Eq, value: 'nhs'       },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR group',
        },
      },
    },

    // Table with two-group filter
    {
      ...FACTORIES[WidgetType.Table](0, 3),
      w: 12, h: 3,
      title: 'Completed + Invoiced Appointments — AND Group',
      config: {
        striped: true, compact: false, statusColumn: true,
        columns: [], rows: [], selectedFields: [],
        queryConfig: {
          product: 'epx',
          entities: ['appointment', 'appointment_patient'],
          columns: [
            { entity: 'appointment',         field: 'identifier'  },
            { entity: 'appointment',         field: 'start_date'  },
            { entity: 'appointment',         field: 'status'      },
            { entity: 'appointment_patient', field: 'payor_type'  },
            { entity: 'appointment_patient', field: 'price'       },
          ],
          filterGroups: [
            {
              id: 'tbl-and-group', logic: 'AND',
              conditions: [
                { entity: 'appointment', field: 'status',   operator: FilterOperator.Eq, value: 'completed' },
                { entity: 'appointment', field: 'invoiced', operator: FilterOperator.Eq, value: 'true'      },
              ],
            } as FilterGroup,
          ],
          sort: { entity: 'appointment', field: 'start_date', direction: SortDirection.Desc },
          pageSize: 20,
        },
      },
    },

    // ── Accounting filter groups ────────────────────────────────
    section(0, 6, 'AND / OR Filter Groups — Accounting', '#10b981'),

    {
      ...FACTORIES[WidgetType.Stat](0, 7),
      title: 'OR — Sent or Overdue',
      config: {
        value: '–', subValue: 'OR group', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '', suffix: '',
        description: 'OR group: status=sent OR status=overdue',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'acc-or-status', logic: 'OR',
              conditions: [
                { entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'sent'    },
                { entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'overdue' },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR group',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 7),
      title: 'AND — Overdue, Not Void',
      config: {
        value: '–', subValue: 'AND group', trend: '', trendUp: false,
        accent: '#f97316', prefix: '', suffix: '',
        description: 'AND group: status=overdue AND is_void=false',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice'],
          agg: { entity: 'invoice', field: 'id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'acc-and-overdue', logic: 'AND',
              conditions: [
                { entity: 'invoice', field: 'status',  operator: FilterOperator.Eq, value: 'overdue' },
                { entity: 'invoice', field: 'is_void', operator: FilterOperator.Eq, value: 'false'   },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'AND group',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 7),
      title: 'OR — Accepted or Paid Claims',
      config: {
        value: '–', subValue: 'OR group on claims', trend: '', trendUp: true,
        accent: '#22c55e', prefix: '', suffix: '',
        description: 'OR group: claim.status=accepted OR claim.status=paid',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice', 'claim'],
          agg: { entity: 'claim', field: 'id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'acc-or-claim', logic: 'OR',
              conditions: [
                { entity: 'claim', field: 'status', operator: FilterOperator.Eq, value: 'accepted' },
                { entity: 'claim', field: 'status', operator: FilterOperator.Eq, value: 'paid'     },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR group',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 7),
      title: 'OR+AND — Active Non-Void',
      config: {
        value: '–', subValue: 'two-group combo', trend: '', trendUp: true,
        accent: '#10b981', prefix: '£', suffix: '',
        description: '(sent OR overdue) AND is_void=false — sum of receivable invoices',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'accounting', entities: ['invoice'],
          agg: { entity: 'invoice', field: 'total_amount', function: AggregationFunction.Sum },
          filterGroups: [
            {
              id: 'acc-twogrp-or', logic: 'OR',
              conditions: [
                { entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'sent'    },
                { entity: 'invoice', field: 'status', operator: FilterOperator.Eq, value: 'overdue' },
              ],
            } as FilterGroup,
            {
              id: 'acc-twogrp-and', logic: 'AND',
              conditions: [
                { entity: 'invoice', field: 'is_void', operator: FilterOperator.Eq, value: 'false' },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR+AND groups',
        },
      },
    },

    // ── Prescriptions filter groups ─────────────────────────────
    section(0, 9, 'AND / OR Filter Groups — Prescriptions', '#a78bfa'),

    {
      ...FACTORIES[WidgetType.Stat](0, 10),
      title: 'OR — Emergency or Urgent',
      config: {
        value: '–', subValue: 'priority OR group', trend: '', trendUp: false,
        accent: '#ef4444', prefix: '', suffix: '',
        description: 'OR group: priority=emergency OR priority=urgent',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'rx-or-priority', logic: 'OR',
              conditions: [
                { entity: 'prescription', field: 'priority', operator: FilterOperator.Eq, value: 'emergency' },
                { entity: 'prescription', field: 'priority', operator: FilterOperator.Eq, value: 'urgent'    },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR group',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](3, 10),
      title: 'AND — Repeat + Active',
      config: {
        value: '–', subValue: 'AND group', trend: '', trendUp: true,
        accent: '#3b82f6', prefix: '', suffix: '',
        description: 'AND group: is_repeat=true AND status=active',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'rx-and-repeat', logic: 'AND',
              conditions: [
                { entity: 'prescription', field: 'is_repeat', operator: FilterOperator.Eq, value: 'true'   },
                { entity: 'prescription', field: 'status',    operator: FilterOperator.Eq, value: 'active' },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'AND group',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](6, 10),
      title: 'AND — Controlled + Active',
      config: {
        value: '–', subValue: 'cross-entity AND', trend: '', trendUp: false,
        accent: '#f97316', prefix: '', suffix: '',
        description: 'AND: medication.is_controlled=true AND prescription.status=active',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription', 'prescription_item', 'medication'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'rx-controlled-active', logic: 'AND',
              conditions: [
                { entity: 'medication',   field: 'is_controlled', operator: FilterOperator.Eq, value: 'true'   },
                { entity: 'prescription', field: 'status',        operator: FilterOperator.Eq, value: 'active' },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'AND group',
        },
      },
    },
    {
      ...FACTORIES[WidgetType.Stat](9, 10),
      title: 'OR+AND — Urgent Repeat',
      config: {
        value: '–', subValue: 'two-group combo', trend: '', trendUp: false,
        accent: '#a78bfa', prefix: '', suffix: '',
        description: '(emergency OR urgent) AND is_repeat=true',
        showSparkline: false, sparkData: [], selectedFields: [],
        queryConfig: {
          product: 'prescriptions', entities: ['prescription'],
          agg: { entity: 'prescription', field: 'id', function: AggregationFunction.Count },
          filterGroups: [
            {
              id: 'rx-twogrp-or', logic: 'OR',
              conditions: [
                { entity: 'prescription', field: 'priority', operator: FilterOperator.Eq, value: 'emergency' },
                { entity: 'prescription', field: 'priority', operator: FilterOperator.Eq, value: 'urgent'    },
              ],
            } as FilterGroup,
            {
              id: 'rx-twogrp-and', logic: 'AND',
              conditions: [
                { entity: 'prescription', field: 'is_repeat', operator: FilterOperator.Eq, value: 'true' },
              ],
            } as FilterGroup,
          ],
          periodLabel: 'OR+AND groups',
        },
      },
    },
  ];
}


// ───────────────────────────────────────────────────────────────
//  PRODUCT_TEMPLATES — public export
// ───────────────────────────────────────────────────────────────

export const PRODUCT_TEMPLATES: DashboardTemplate[] = [
  {
    id:          'epx',
    name:        'EPX Clinical',
    description: 'Full appointment and patient dashboard — all 9 widget types, derived Full Name column, 3 sections',
    icon:        '🏥',
    color:       '#3b82f6',
    build:       buildEpx,
  },
  {
    id:          'accounting',
    name:        'Accounting',
    description: 'Invoices, revenue, payments, claims — all 9 widget types, Gross Value derived column, 3 sections',
    icon:        '💰',
    color:       '#10b981',
    build:       buildAccounting,
  },
  {
    id:          'prescriptions',
    name:        'Prescriptions',
    description: 'Rx activity, drug classes, controlled substances — all 9 widget types, Prescriber + Medication derived columns',
    icon:        '💊',
    color:       '#a78bfa',
    build:       buildPrescriptions,
  },
  {
    id:          'widget-gallery',
    name:        'Widget Gallery',
    description: 'One of each widget type with live EPX data — ideal starting point for exploring widget capabilities',
    icon:        '⊞',
    color:       '#6366f1',
    build:       buildWidgetGallery,
  },
  {
    id:          'aggregations',
    name:        'Aggregation Functions',
    description: 'COUNT, COUNT_DISTINCT, SUM, AVG, MIN, MAX — each annotated, all three products covered',
    icon:        '∑',
    color:       '#6366f1',
    build:       buildAggregations,
  },
  {
    id:          'filter-ops',
    name:        'Filter Operators',
    description: 'eq, neq, gt, gte, lt, lte, is_null, is_not_null, in, not_in, contains — one widget per operator',
    icon:        '⊗',
    color:       '#ec4899',
    build:       buildFilterOps,
  },
  {
    id:          'filter-groups',
    name:        'AND / OR Filter Groups',
    description: 'Single AND group, single OR group, two-group combinations — all three products with stat and table widgets',
    icon:        '⊕',
    color:       '#3b82f6',
    build:       buildFilterGroups,
  },
];
