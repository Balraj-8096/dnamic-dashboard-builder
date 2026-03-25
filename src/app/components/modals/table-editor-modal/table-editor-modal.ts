// ═══════════════════════════════════════════════════════════════
//  DASHCRAFT — Table Editor Modal
//  Unified single-view table widget configurator.
// ═══════════════════════════════════════════════════════════════

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { Widget, TableConfig, TableColumn } from '../../../core/interfaces';
import {
  DerivedColumnDef, FieldType, FilterGroup, SortDirection, TableQueryConfig,
} from '../../../core/query-types';
import { QueryService } from '../../../services/query.service';
import { STATUS_MAP } from '../../../core/constants';
import { FilterBuilder } from '../../shared/query-builder/filter-builder/filter-builder';

/** Internal column model used only inside this editor. */
interface EditorColumn {
  key:        string;    // "entity.field" for normal; "__derived_xxx" for derived
  label:      string;
  entity:     string;    // empty for derived columns
  field:      string;    // empty for derived columns
  visible:    boolean;
  type:       FieldType;
  width:      string;
  derived?:   boolean;
  derivedDef?: DerivedColumnDef;
}

@Component({
  selector: 'app-table-editor-modal',
  imports: [CommonModule, FormsModule, DragDropModule, FilterBuilder],
  templateUrl: './table-editor-modal.html',
  styleUrl: './table-editor-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableEditorModal implements OnInit {
  @Input({ required: true }) widget!: Widget;
  @Output() saved     = new EventEmitter<Widget>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly qsvc = inject(QueryService);
  private readonly cdr  = inject(ChangeDetectorRef);

  readonly SortDirection = SortDirection;
  readonly FieldType     = FieldType;
  readonly statusEntries = Object.entries(STATUS_MAP);
  readonly PRODUCTS      = ['epx', 'accounting', 'prescriptions'] as const;

  // ── Widget meta ───────────────────────────────────────────────────────────
  title        = '';
  product      = '';
  entityList:   string[] = [];
  newAddEntity = '';

  // ── Display options ───────────────────────────────────────────────────────
  striped      = false;
  compact      = false;
  statusColumn = false;

  // ── Columns ───────────────────────────────────────────────────────────────
  editorCols:   EditorColumn[] = [];
  newColEntity  = '';
  newColField   = '';
  colSearch     = '';
  editingColIdx = -1;

  // ── Sort ──────────────────────────────────────────────────────────────────
  sortEntity = '';
  sortField  = '';
  sortDir: SortDirection | '' = '';

  // ── Pagination ────────────────────────────────────────────────────────────
  pageSize = 20;

  // ── Filters ───────────────────────────────────────────────────────────────
  showFilters  = false;
  filterGroups: FilterGroup[] = [];

  // ── Derived column creator / editor ──────────────────────────────────────
  showDerivedPanel    = false;
  editingDerivedColIdx = -1;   // >= 0 means editing an existing derived col
  drvLabel            = '';
  drvMode: DerivedColumnDef['mode'] = 'concat';
  drvSeparator        = ' ';
  drvSources: { entity: string; field: string }[] = [];

  get isDerivedPanelEditMode(): boolean { return this.editingDerivedColIdx >= 0; }

  // ── Live preview data ─────────────────────────────────────────────────────
  previewRows: Record<string, unknown>[] = [];
  rowCount     = 0;

  // ── Local undo ────────────────────────────────────────────────────────────
  private localHistory: EditorColumn[][] = [];
  private localHistIdx  = -1;
  get canLocalUndo(): boolean { return this.localHistIdx > 0; }

  // ── Derived ───────────────────────────────────────────────────────────────
  get visibleEditorCols(): EditorColumn[] {
    return this.editorCols.filter(c => c.visible);
  }

  get hiddenColCount(): number {
    return this.editorCols.filter(c => !c.visible).length;
  }

  get canSave(): boolean {
    return !!(this.product && this.entityList.length && this.visibleEditorCols.length);
  }

  get canCreateDerived(): boolean {
    return !!(
      this.drvLabel.trim() &&
      this.drvSources.length >= 2 &&
      this.drvSources.every(s => s.entity && s.field)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const cfg  = this.widget.config as TableConfig;
    const qcfg = cfg.queryConfig;

    this.title        = this.widget.title;
    this.striped      = cfg.striped      ?? false;
    this.compact      = cfg.compact      ?? false;
    this.statusColumn = cfg.statusColumn ?? false;

    if (qcfg) {
      this.product      = qcfg.product    ?? '';
      this.entityList   = [...(qcfg.entities ?? [])];
      this.sortEntity   = qcfg.sort?.entity    ?? '';
      this.sortField    = qcfg.sort?.field     ?? '';
      this.sortDir      = qcfg.sort?.direction ?? '';
      this.pageSize     = qcfg.pageSize        ?? 20;
      this.filterGroups = qcfg.filterGroups    ? [...qcfg.filterGroups] : [];

      // Build normal EditorColumns from query config.
      // Exclude source-only fields that were added to queryConfig.columns solely to support
      // derived column computation — they should not be restored as visible columns.
      const cfgColMap = new Map((cfg.columns ?? []).map(c => [c.key, c]));
      const derivedSourceKeys = new Set<string>(
        (qcfg.derivedColumns ?? []).flatMap(def =>
          def.sources.map(s => `${s.entity}.${s.field}`)
        )
      );
      const normalCols: EditorColumn[] = (qcfg.columns ?? [])
        .filter(c => {
          const key = `${c.entity}.${c.field}`;
          // Always include if cfg.columns (user's display config) has it
          if (cfgColMap.has(key)) return true;
          // Otherwise exclude source-only fields used only by derived columns
          return !derivedSourceKeys.has(key);
        })
        .map(c => {
          const key      = `${c.entity}.${c.field}`;
          const saved    = cfgColMap.get(key);
          const fieldDef = this.getFieldDef(c.entity, c.field);
          return {
            key,
            label:   saved?.label  ?? fieldDef?.name ?? c.field,
            entity:  c.entity,
            field:   c.field,
            visible: true,
            type:    fieldDef?.type ?? saved?.type ?? FieldType.String,
            width:   saved?.width  ?? 'auto',
          };
        });

      // Restore derived EditorColumns from derivedColumns + cfg.columns
      const derivedCols: EditorColumn[] = (qcfg.derivedColumns ?? []).map(def => {
        const saved = cfgColMap.get(def.key);
        return {
          key:        def.key,
          label:      saved?.label ?? def.label ?? def.key,
          entity:     '',
          field:      '',
          visible:    true,
          type:       (def.mode === 'concat' ? FieldType.String : FieldType.Number),
          width:      saved?.width ?? 'auto',
          derived:    true,
          derivedDef: def,
        };
      });

      // Restore column order from cfg.columns (display config), fall back to query order
      if (cfg.columns?.length) {
        const byKey = new Map<string, EditorColumn>(
          [...normalCols, ...derivedCols].map(c => [c.key, c])
        );
        this.editorCols = cfg.columns
          .map(c => byKey.get(c.key))
          .filter((c): c is EditorColumn => !!c);
        // Append any query-only columns not in cfg.columns (edge-case safety)
        for (const c of normalCols) {
          if (!this.editorCols.find(e => e.key === c.key)) this.editorCols.push(c);
        }
      } else {
        this.editorCols = [...normalCols, ...derivedCols];
      }
    }

    // Prime the add-column picker
    if (this.entityList.length) {
      this.newColEntity = this.entityList[0];
      this.newColField  = this.fieldsFor(this.newColEntity)[0]?.name ?? '';
    }

    this.pushLocalHistory();
    this.refreshPreview();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Query helpers
  // ─────────────────────────────────────────────────────────────────────────

  get allEntities() {
    return this.product ? this.qsvc.getEntityList(this.product) : [];
  }

  get availableEntities() {
    const reachable = this.entityList.length
      ? this.qsvc.getReachableEntities(this.product, this.entityList)
      : this.allEntities;
    return reachable.filter(e => !this.entityList.includes(e.name));
  }

  fieldsFor(entity: string) {
    if (!this.product || !entity) return [];
    try { return this.qsvc.getFieldList(this.product, entity); }
    catch { return []; }
  }

  get filteredFields() {
    const all = this.fieldsFor(this.newColEntity);
    if (!this.colSearch) return all;
    const s = this.colSearch.toLowerCase();
    return all.filter(f => f.name.toLowerCase().includes(s));
  }

  get filterScope(): string[] { return this.entityList.filter(Boolean); }

  private getFieldDef(entity: string, field: string) {
    return this.fieldsFor(entity).find(f => f.name === field) ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Entity operations
  // ─────────────────────────────────────────────────────────────────────────

  onNewEntitySelected(entity: string): void {
    if (!entity) return;
    this.addEntity();
  }

  onProductChange(): void {
    this.entityList   = [];
    this.editorCols   = [];
    this.newColEntity = '';
    this.newColField  = '';
    this.sortEntity   = '';
    this.sortField    = '';
    this.sortDir      = '';
    this.previewRows  = [];
    this.rowCount     = 0;
    this.pushLocalHistory();
    this.cdr.markForCheck();
  }

  addEntity(): void {
    if (!this.newAddEntity || this.entityList.includes(this.newAddEntity)) return;
    this.entityList   = [...this.entityList, this.newAddEntity];
    this.newAddEntity = '';
    if (!this.newColEntity && this.entityList.length) {
      this.newColEntity = this.entityList[0];
      this.newColField  = this.fieldsFor(this.newColEntity)[0]?.name ?? '';
    }
    this.pushLocalHistory();
    this.refreshPreview();
  }

  removeEntity(entity: string): void {
    this.entityList = this.entityList.filter(e => e !== entity);
    this.editorCols = this.editorCols.filter(c => {
      if (c.derived) return true;   // derived cols don't belong to a single entity
      return c.entity !== entity;
    });
    if (this.sortEntity === entity) {
      this.sortEntity = this.entityList[0] ?? '';
      this.sortField  = this.fieldsFor(this.sortEntity)[0]?.name ?? '';
      this.sortDir    = '';
    }
    if (this.newColEntity === entity) {
      this.newColEntity = this.entityList[0] ?? '';
      this.newColField  = this.fieldsFor(this.newColEntity)[0]?.name ?? '';
    }
    this.pushLocalHistory();
    this.refreshPreview();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Column operations
  // ─────────────────────────────────────────────────────────────────────────

  onNewColEntityChange(entity: string): void {
    this.newColEntity = entity;
    this.colSearch    = '';
    this.newColField  = this.fieldsFor(entity)[0]?.name ?? '';
  }

  onColSearchChange(search: string): void {
    this.colSearch  = search;
    const first     = this.filteredFields[0]?.name;
    if (first) this.newColField = first;
    this.cdr.markForCheck();
  }

  addColumn(): void {
    if (!this.newColEntity || !this.newColField) return;
    const key = `${this.newColEntity}.${this.newColField}`;
    if (this.editorCols.some(c => c.key === key)) return;
    const fieldDef = this.getFieldDef(this.newColEntity, this.newColField);
    this.editorCols = [...this.editorCols, {
      key,
      label:   fieldDef?.name ?? this.newColField,
      entity:  this.newColEntity,
      field:   this.newColField,
      visible: true,
      type:    fieldDef?.type ?? FieldType.String,
      width:   'auto',
    }];
    this.pushLocalHistory();
    this.refreshPreview();
  }

  addAllColumns(): void {
    const entity = this.newColEntity || this.entityList[0];
    if (!entity) return;
    const existing = new Set(
      this.editorCols.filter(c => c.entity === entity).map(c => c.field)
    );
    const newCols: EditorColumn[] = this.fieldsFor(entity)
      .filter(f => !existing.has(f.name))
      .map(f => ({
        key:     `${entity}.${f.name}`,
        label:   f.name,
        entity,
        field:   f.name,
        visible: true,
        type:    f.type,
        width:   'auto',
      }));
    if (!newCols.length) return;
    this.editorCols = [...this.editorCols, ...newCols];
    this.pushLocalHistory();
    this.refreshPreview();
  }

  removeColumn(i: number): void {
    this.editorCols = this.editorCols.filter((_, idx) => idx !== i);
    if (this.editingColIdx === i) this.editingColIdx = -1;
    this.pushLocalHistory();
    this.refreshPreview();
  }

  startRename(i: number): void {
    this.editingColIdx = i;
    this.cdr.markForCheck();
  }

  confirmRename(i: number, evt: Event): void {
    const label = (evt.target as HTMLInputElement).value.trim();
    if (label && label !== this.editorCols[i]?.label) {
      this.editorCols = this.editorCols.map((c, idx) =>
        idx === i ? { ...c, label } : c
      );
    }
    this.editingColIdx = -1;
    this.cdr.markForCheck();
  }

  toggleColumnVisible(i: number): void {
    this.editorCols = this.editorCols.map((c, idx) =>
      idx === i ? { ...c, visible: !c.visible } : c
    );
    this.refreshPreview();
  }

  onColumnDrop(event: CdkDragDrop<EditorColumn[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const arr = [...this.editorCols];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.editorCols = arr;
    this.pushLocalHistory();
    this.refreshPreview();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Derived column creator
  // ─────────────────────────────────────────────────────────────────────────

  openDerivedPanel(): void {
    this.editingDerivedColIdx = -1;
    this.drvLabel     = '';
    this.drvMode      = 'concat';
    this.drvSeparator = ' ';
    // Pre-populate with first two fields so the form isn't empty
    const entity  = this.entityList[0] ?? '';
    const fields  = this.fieldsFor(entity);
    this.drvSources = [
      { entity, field: fields[0]?.name ?? '' },
      { entity, field: fields[1]?.name ?? '' },
    ].filter(s => s.field);
    this.showDerivedPanel = true;
    this.cdr.markForCheck();
  }

  /** Open the panel pre-populated with an existing derived column for editing. */
  editDerivedColumn(colIdx: number): void {
    const col = this.editorCols[colIdx];
    if (!col?.derived || !col.derivedDef) return;
    this.editingDerivedColIdx = colIdx;
    this.drvLabel     = col.label;
    this.drvMode      = col.derivedDef.mode;
    this.drvSeparator = col.derivedDef.separator ?? ' ';
    this.drvSources   = col.derivedDef.sources.map(s => ({ ...s }));
    this.showDerivedPanel = true;
    this.cdr.markForCheck();
  }

  closeDerivedPanel(): void {
    this.showDerivedPanel     = false;
    this.editingDerivedColIdx = -1;
    this.cdr.markForCheck();
  }

  addDrvSource(): void {
    const entity = this.entityList[0] ?? '';
    this.drvSources = [
      ...this.drvSources,
      { entity, field: this.fieldsFor(entity)[0]?.name ?? '' },
    ];
    this.cdr.markForCheck();
  }

  removeDrvSource(i: number): void {
    this.drvSources = this.drvSources.filter((_, idx) => idx !== i);
    this.cdr.markForCheck();
  }

  onDrvSrcEntityChange(i: number, entity: string): void {
    const updated = [...this.drvSources];
    updated[i] = { entity, field: this.fieldsFor(entity)[0]?.name ?? '' };
    this.drvSources = updated;
    this.cdr.markForCheck();
  }

  /** Mode label shown between source fields (e.g. "+" for sum, "→" for concat). */
  getDrvOpLabel(): string {
    switch (this.drvMode) {
      case 'concat':   return '+';
      case 'sum':      return '+';
      case 'subtract': return '−';
      case 'multiply': return '×';
      case 'divide':   return '÷';
    }
  }

  saveDerivedColumn(): void {
    if (!this.canCreateDerived) return;
    const label = this.drvLabel.trim();

    if (this.editingDerivedColIdx >= 0) {
      // ── Edit existing derived column in-place ──────────────────────────────
      const existing = this.editorCols[this.editingDerivedColIdx];
      const updatedDef: DerivedColumnDef = {
        key:       existing.key,          // preserve original key
        label,
        mode:      this.drvMode,
        sources:   this.drvSources.map(s => ({ ...s })),
        separator: this.drvMode === 'concat' ? this.drvSeparator : undefined,
      };
      const cols = [...this.editorCols];
      cols[this.editingDerivedColIdx] = {
        ...existing,
        label,
        type:       this.drvMode === 'concat' ? FieldType.String : FieldType.Number,
        derivedDef: updatedDef,
      };
      this.editorCols = cols;
    } else {
      // ── Create new derived column ──────────────────────────────────────────
      const key: string = `__derived_${Date.now()}`;
      const def: DerivedColumnDef = {
        key,
        label,
        mode:      this.drvMode,
        sources:   this.drvSources.map(s => ({ ...s })),
        separator: this.drvMode === 'concat' ? this.drvSeparator : undefined,
      };
      this.editorCols = [...this.editorCols, {
        key,
        label,
        entity:     '',
        field:      '',
        visible:    true,
        type:       this.drvMode === 'concat' ? FieldType.String : FieldType.Number,
        width:      'auto',
        derived:    true,
        derivedDef: def,
      }];
    }

    this.showDerivedPanel     = false;
    this.editingDerivedColIdx = -1;
    this.pushLocalHistory();
    this.refreshPreview();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Sort
  // ─────────────────────────────────────────────────────────────────────────

  onHeaderSortClick(col: EditorColumn): void {
    if (this.editingColIdx >= 0) return;
    if (col.derived) return;   // derived columns can't be sort keys
    if (this.sortEntity === col.entity && this.sortField === col.field) {
      if      (this.sortDir === SortDirection.Asc)  this.sortDir = SortDirection.Desc;
      else if (this.sortDir === SortDirection.Desc) this.sortDir = '';
      else                                           this.sortDir = SortDirection.Asc;
    } else {
      this.sortEntity = col.entity;
      this.sortField  = col.field;
      this.sortDir    = SortDirection.Asc;
    }
    this.refreshPreview();
  }

  getSortIcon(col: EditorColumn): string {
    if (col.derived) return '';
    if (!this.sortDir || this.sortEntity !== col.entity || this.sortField !== col.field) return '↕';
    return this.sortDir === SortDirection.Asc ? '↑' : '↓';
  }

  isSorted(col: EditorColumn): boolean {
    return !col.derived && !!this.sortDir
      && this.sortEntity === col.entity
      && this.sortField  === col.field;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Type / badge helpers
  // ─────────────────────────────────────────────────────────────────────────

  getTypeIcon(col: EditorColumn): string {
    if (col.derived) return 'fx';
    switch (col.type) {
      case FieldType.Number:   return '#';
      case FieldType.Datetime: return '⏱';
      case FieldType.Boolean:  return '◎';
      default:                 return 'T';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Local undo
  // ─────────────────────────────────────────────────────────────────────────

  private pushLocalHistory(): void {
    this.localHistory = this.localHistory.slice(0, this.localHistIdx + 1);
    this.localHistory.push(JSON.parse(JSON.stringify(this.editorCols)));
    this.localHistIdx = this.localHistory.length - 1;
  }

  localUndo(): void {
    if (!this.canLocalUndo) return;
    this.localHistIdx--;
    this.editorCols = JSON.parse(JSON.stringify(this.localHistory[this.localHistIdx]));
    this.refreshPreview();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Status badge helpers
  // ─────────────────────────────────────────────────────────────────────────

  isStatusCell(col: EditorColumn, value: unknown): boolean {
    return this.statusColumn
      && col.field === 'status'
      && !!STATUS_MAP[String(value ?? '').toLowerCase()];
  }

  getStatusStyle(value: unknown) {
    const key = String(value ?? '').toLowerCase();
    return STATUS_MAP[key] ?? { bg: '#1c1c1c', fg: '#94a3b8', label: String(value ?? '') };
  }

  getCellValue(row: Record<string, unknown>, col: EditorColumn): unknown {
    return row[col.key] ?? '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Live preview
  // ─────────────────────────────────────────────────────────────────────────

  refreshPreview(): void {
    const qcfg = this.buildQueryConfig();
    if (!qcfg || !qcfg.entities.length || !qcfg.columns.length) {
      this.previewRows = [];
      this.rowCount    = 0;
      this.cdr.markForCheck();
      return;
    }
    try {
      const result     = this.qsvc.executeTableQuery({ ...qcfg, pageSize: 6 });
      this.previewRows = result.rows;
      this.rowCount    = result.totalRows;
    } catch {
      this.previewRows = [];
      this.rowCount    = 0;
    }
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Config builders
  // ─────────────────────────────────────────────────────────────────────────

  private buildQueryConfig(): TableQueryConfig | null {
    if (!this.product || !this.entityList.length) return null;

    const normalCols  = this.visibleEditorCols.filter(c => !c.derived && c.entity);
    const derivedCols = this.visibleEditorCols.filter(c => c.derived && c.derivedDef);

    if (!normalCols.length && !derivedCols.length) return null;

    // Only include actual display columns — NOT derived-column source fields.
    // The query service automatically fetches source fields when computing derivedColumns.
    // Adding source fields here would cause them to appear as extra columns in the output.
    const colSet = new Map<string, { entity: string; field: string }>();
    for (const c of normalCols) {
      colSet.set(c.key, { entity: c.entity, field: c.field });
    }

    const existingQcfg = (this.widget.config as TableConfig).queryConfig;
    return {
      product:        this.product,
      entities:       this.qsvc.buildEntityPath(this.product, this.entityList),
      columns:        [...colSet.values()],
      derivedColumns: derivedCols.length ? derivedCols.map(c => c.derivedDef!) : undefined,
      filterGroups:   this.filterGroups.length ? this.filterGroups : undefined,
      sort: this.sortDir && this.sortEntity && this.sortField
        ? { entity: this.sortEntity, field: this.sortField, direction: this.sortDir as SortDirection }
        : undefined,
      pageSize:       this.pageSize,
      dateRangeField: existingQcfg?.dateRangeField,
    };
  }

  private buildTableColumns(): TableColumn[] {
    return this.visibleEditorCols.map(c => ({
      key:     c.key,
      label:   c.label,
      width:   c.width,
      type:    c.type,
      ...(c.derived && c.derivedDef ? { derived: c.derivedDef } : {}),
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Save / Cancel
  // ─────────────────────────────────────────────────────────────────────────

  save(): void {
    if (!this.canSave) return;
    const qcfg    = this.buildQueryConfig();
    const columns = this.buildTableColumns();
    const updated: Widget = {
      ...this.widget,
      title: this.title,
      config: {
        ...(this.widget.config as TableConfig),
        columns,
        rows:          [],
        striped:       this.striped,
        compact:       this.compact,
        statusColumn:  this.statusColumn,
        selectedFields: [],
        queryConfig:   qcfg ?? undefined,
      } as TableConfig,
    };
    this.saved.emit(updated);
  }

  cancel(): void { this.cancelled.emit(); }
}
