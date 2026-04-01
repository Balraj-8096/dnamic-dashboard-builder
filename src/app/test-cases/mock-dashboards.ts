/**
 * mock-dashboards.ts
 *
 * Sample dashboard registry data for testing the multi-dashboard feature
 * (DashboardListPage, DashboardRegistryService, DashboardPersistenceService).
 *
 * MOCK_DASHBOARD_SUMMARIES — used by DashboardListPage and DashboardRegistryService
 *   when useRealApi() = false. Matches the DashboardSummary interface from
 *   dashboard-api.service.ts: { id, title, updatedAt? }
 *
 * MOCK_DASHBOARD_PAYLOADS — used by DashboardPersistenceService.load(id) in mock mode.
 *   Matches the DashboardPayload interface: { id, title, widgets, updatedAt? }
 *   Widgets are minimal stubs — enough to verify the list UI renders correctly.
 *   Full widget configs live in ProductTemplates.ts; use loadTemplate() for those.
 *
 * EDGE CASES COVERED:
 *   - 6 dashboards: tests grid layout and pagination/scroll at reasonable volume
 *   - One dashboard with a very long title (UI truncation)
 *   - One dashboard with zero widgets (empty canvas state)
 *   - One dashboard with no updatedAt (optional field — show "Never saved" fallback)
 *   - One dashboard that is the "active" dashboard (currently open in builder)
 *   - Mixed updatedAt recency: today, last week, last month, 6 months ago
 */

// ─── Types (mirrors dashboard-api.service.ts, duplicated to avoid circular imports) ───

export interface MockDashboardSummary {
  id:         string;
  title:      string;
  updatedAt?: string;   // ISO 8601 — optional, matches DashboardSummary
}

export interface MockDashboardPayload {
  id:         string;
  title:      string;
  widgets:    unknown[];  // Widget[] — typed as unknown[] to avoid importing Widget here
  updatedAt?: string;
}

// ─── Dashboard List (DashboardSummary[]) ─────────────────────────────────────────────

export const MOCK_DASHBOARD_SUMMARIES: MockDashboardSummary[] = [
  {
    id:        "dash-001",
    title:     "EPX Clinical Dashboard",
    updatedAt: "2026-03-31T14:22:00"    // yesterday — most recently edited
  },
  {
    id:        "dash-002",
    title:     "Accounting Overview Q1 2026",
    updatedAt: "2026-03-28T09:15:00"    // 3 days ago
  },
  {
    id:        "dash-003",
    title:     "Prescriptions Monitor",
    updatedAt: "2026-03-20T16:45:00"    // ~10 days ago
  },
  {
    id:        "dash-004",
    title:     "Executive Summary — All Products — Board Pack March 2026",  // long title: tests truncation
    updatedAt: "2026-03-01T11:00:00"    // 1 month ago
  },
  {
    id:        "dash-005",
    title:     "Empty Dashboard",
    updatedAt: "2025-10-05T08:30:00"    // 6 months ago — stale
  },
  {
    id:        "dash-006",
    title:     "New Dashboard",
    updatedAt: undefined                 // no updatedAt — tests "Never saved" fallback
  }
];

// ─── Dashboard Payloads (DashboardPayload) ────────────────────────────────────────────
// Minimal widget stubs — just enough for the canvas to render a non-empty state.
// Positions use the standard 12-column grid (x, y, w, h in grid units).

export const MOCK_DASHBOARD_PAYLOADS: Record<string, MockDashboardPayload> = {

  "dash-001": {
    id:        "dash-001",
    title:     "EPX Clinical Dashboard",
    updatedAt: "2026-03-31T14:22:00",
    widgets: [
      {
        id: "w-epx-001", type: "stat", title: "Total Appointments", locked: false,
        x: 0, y: 0, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Total Appointments", value: "", subValue: "", changeLabel: "", trend: "neutral",
          query: { product: "epx", entity: "appointment", field: "id", aggregation: "COUNT", filters: [], dateRange: null } }
      },
      {
        id: "w-epx-002", type: "stat", title: "Revenue", locked: false,
        x: 3, y: 0, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Total Revenue", value: "", subValue: "", changeLabel: "", trend: "up",
          query: { product: "epx", entity: "appointment_patient", field: "price", aggregation: "SUM", filters: [], dateRange: null } }
      },
      {
        id: "w-epx-003", type: "bar", title: "Appointments by Type", locked: false,
        x: 0, y: 2, w: 5, h: 3,
        config: { type: "bar", useQuery: true, title: "Appointments by Type",
          query: { product: "epx", entities: ["appointment"], groupBy: { entity: "appointment", field: "appointmenttype" },
            series: [{ entity: "appointment", field: "id", aggregation: "COUNT", label: "Count" }],
            filters: [], dateRange: null, queryLabels: {} } }
      },
      {
        id: "w-epx-004", type: "section", title: "Patient Overview", locked: false,
        x: 0, y: 5, w: 12, h: 1,
        config: { type: "section", label: "Patient Overview", color: "#6366f1" }
      }
    ]
  },

  "dash-002": {
    id:        "dash-002",
    title:     "Accounting Overview Q1 2026",
    updatedAt: "2026-03-28T09:15:00",
    widgets: [
      {
        id: "w-acc-001", type: "stat", title: "Total Invoiced", locked: false,
        x: 0, y: 0, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Total Invoiced (GBP)", value: "", subValue: "", changeLabel: "", trend: "up",
          query: { product: "accounting", entity: "invoice", field: "totalamount", aggregation: "SUM",
            filters: [{ entity: "invoice", field: "isvoid", operator: "eq", value: false, values: [] }], dateRange: null } }
      },
      {
        id: "w-acc-002", type: "stat", title: "Outstanding Invoices", locked: false,
        x: 3, y: 0, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Overdue Invoices", value: "", subValue: "", changeLabel: "", trend: "neutral",
          query: { product: "accounting", entity: "invoice", field: "id", aggregation: "COUNT",
            filters: [{ entity: "invoice", field: "status", operator: "eq", value: "overdue", values: [] }], dateRange: null } }
      },
      {
        id: "w-acc-003", type: "pie", title: "Revenue by Invoice Type", locked: false,
        x: 6, y: 0, w: 4, h: 3,
        config: { type: "pie", useQuery: true, title: "Revenue by Type",
          query: { product: "accounting", entity: "invoice", labelField: "invoicetype", valueField: "totalamount",
            aggregation: "SUM", filters: [{ entity: "invoice", field: "isvoid", operator: "eq", value: false, values: [] }], dateRange: null } }
      },
      {
        id: "w-acc-004", type: "note", title: "Currency Note", locked: true,
        x: 0, y: 2, w: 3, h: 2,
        config: { type: "note", content: "All figures in GBP only. Filter by currencycode = 'GBP' before aggregating to avoid mixed-currency totals.", color: "#f59e0b" }
      }
    ]
  },

  "dash-003": {
    id:        "dash-003",
    title:     "Prescriptions Monitor",
    updatedAt: "2026-03-20T16:45:00",
    widgets: [
      {
        id: "w-rx-001", type: "stat", title: "Active Prescriptions", locked: false,
        x: 0, y: 0, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Active Prescriptions", value: "", subValue: "", changeLabel: "", trend: "neutral",
          query: { product: "prescriptions", entity: "prescription", field: "id", aggregation: "COUNT",
            filters: [{ entity: "prescription", field: "status", operator: "eq", value: "active", values: [] }], dateRange: null } }
      },
      {
        id: "w-rx-002", type: "stat", title: "Controlled Substances", locked: false,
        x: 3, y: 0, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Controlled Substance Prescriptions", value: "", subValue: "", changeLabel: "", trend: "neutral",
          query: { product: "prescriptions", entity: "prescription", field: "id", aggregation: "COUNT",
            filters: [{ entity: "medication", field: "iscontrolled", operator: "eq", value: true, values: [] }], dateRange: null } }
      },
      {
        id: "w-rx-003", type: "progress", title: "Dispensing Rate", locked: false,
        x: 6, y: 0, w: 4, h: 3,
        config: { type: "progress", useQuery: false, label: "Dispensed vs Total", value: 80, max: 100, unit: "%", color: "#10b981" }
      }
    ]
  },

  "dash-004": {
    id:        "dash-004",
    title:     "Executive Summary — All Products — Board Pack March 2026",
    updatedAt: "2026-03-01T11:00:00",
    widgets: [
      {
        id: "w-exec-001", type: "section", title: "Clinical", locked: false,
        x: 0, y: 0, w: 12, h: 1,
        config: { type: "section", label: "Clinical — EPX", color: "#6366f1" }
      },
      {
        id: "w-exec-002", type: "stat", title: "Total Appointments YTD", locked: false,
        x: 0, y: 1, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Appointments YTD", value: "", subValue: "", changeLabel: "", trend: "up",
          query: { product: "epx", entity: "appointment", field: "id", aggregation: "COUNT", filters: [], dateRange: { preset: "this_year" } } }
      },
      {
        id: "w-exec-003", type: "section", title: "Finance", locked: false,
        x: 0, y: 3, w: 12, h: 1,
        config: { type: "section", label: "Finance — Accounting", color: "#10b981" }
      },
      {
        id: "w-exec-004", type: "stat", title: "Revenue YTD", locked: false,
        x: 0, y: 4, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Revenue YTD (GBP)", value: "", subValue: "", changeLabel: "", trend: "up",
          query: { product: "accounting", entity: "invoice", field: "totalamount", aggregation: "SUM",
            filters: [{ entity: "invoice", field: "isvoid", operator: "eq", value: false, values: [] },
                      { entity: "invoice", field: "currencycode", operator: "eq", value: "GBP", values: [] }],
            dateRange: { preset: "this_year" } } }
      },
      {
        id: "w-exec-005", type: "section", title: "Pharmacy", locked: false,
        x: 0, y: 6, w: 12, h: 1,
        config: { type: "section", label: "Pharmacy — Prescriptions", color: "#f59e0b" }
      },
      {
        id: "w-exec-006", type: "stat", title: "Prescriptions Dispensed YTD", locked: false,
        x: 0, y: 7, w: 3, h: 2,
        config: { type: "stat", useQuery: true, label: "Dispensed YTD", value: "", subValue: "", changeLabel: "", trend: "up",
          query: { product: "prescriptions", entity: "dispense", field: "id", aggregation: "COUNT",
            filters: [{ entity: "dispense", field: "status", operator: "eq", value: "dispensed", values: [] }],
            dateRange: { preset: "this_year" } } }
      }
    ]
  },

  "dash-005": {
    id:        "dash-005",
    title:     "Empty Dashboard",
    updatedAt: "2025-10-05T08:30:00",
    widgets: []   // intentionally empty — tests empty canvas state in builder
  },

  "dash-006": {
    id:        "dash-006",
    title:     "New Dashboard",
    updatedAt: undefined,
    widgets: []   // no updatedAt + no widgets — tests "Never saved" fallback in list UI
  }

};

// ─── Active Dashboard ID ──────────────────────────────────────────────────────────────
// The dashboard that should be pre-loaded when navigating to /builder in mock mode.
// In the real app this is tracked by DashboardRegistryService.activeDashboardId.

export const MOCK_ACTIVE_DASHBOARD_ID = "dash-001";

// ─── Edge Case Index ──────────────────────────────────────────────────────────────────

export const _mock_dashboard_edge_cases = {
  "EC-DASH_LONG_TITLE":    "dash-004 has a 60+ character title — tests truncation in list cards and toolbar breadcrumb",
  "EC-DASH_EMPTY_WIDGETS": "dash-005 and dash-006 have zero widgets — tests empty canvas rendering and '0 widgets' label in list card",
  "EC-DASH_NO_UPDATED_AT": "dash-006 has updatedAt=undefined — list UI must show a 'Never saved' or '—' fallback instead of crashing",
  "EC-DASH_STALE":         "dash-005 was last updated 2025-10-05 (~6 months ago) — tests date formatting for old timestamps",
  "EC-DASH_RECENT":        "dash-001 was last updated 2026-03-31 — tests 'yesterday' / relative-time formatting",
  "EC-DASH_MULTI_PRODUCT": "dash-004 queries all 3 products in a single dashboard — the widget query configs reference different product slugs across widgets",
  "EC-DASH_LOCKED_WIDGET": "dash-002/w-acc-004 (Currency Note) has locked=true — verify lock badge renders in list preview thumbnails if implemented",
  "EC-DASH_ACTIVE":        "MOCK_ACTIVE_DASHBOARD_ID='dash-001' — DashboardRegistryService should highlight this in the list and pre-load it for /builder"
} as const;
