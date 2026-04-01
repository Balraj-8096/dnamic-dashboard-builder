import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router }        from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AppConfigService }          from '../../services/app-config.service';
import { DashboardApiService, DashboardSummary } from '../../services/api/dashboard-api.service';
import { DashboardRegistryService }  from '../../services/dashboard-registry.service';
import { ThemeService }              from '../../services/theme.service';
import { MOCK_DASHBOARD_SUMMARIES }  from '../../test-cases/mock-dashboards';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

@Component({
  selector: 'app-dashboard-list',
  imports: [],
  templateUrl: './dashboard-list.html',
  styleUrl: './dashboard-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardList implements OnInit {
  private readonly router    = inject(Router);
  private readonly configSvc = inject(AppConfigService);
  private readonly api       = inject(DashboardApiService);
  readonly themeSvc          = inject(ThemeService);
  readonly registry          = inject(DashboardRegistryService);
  private readonly cdr       = inject(ChangeDetectorRef);

  // ── State signals ──────────────────────────────────────────────
  private readonly _loadState = signal<LoadState>('idle');
  private readonly _dashboards = signal<DashboardSummary[]>([]);
  private readonly _errorMsg  = signal<string>('');
  private readonly _deletingId = signal<string | null>(null);
  private readonly _deleteErrorId = signal<string | null>(null);
  private readonly _creating  = signal<boolean>(false);
  private readonly _createError = signal<string>('');
  private readonly _renamingId = signal<string | null>(null);
  private readonly _renameValue = signal<string>('');

  readonly loadState   = this._loadState.asReadonly();
  readonly dashboards  = this._dashboards.asReadonly();
  readonly errorMsg    = this._errorMsg.asReadonly();
  readonly deletingId  = this._deletingId.asReadonly();
  readonly deleteErrorId = this._deleteErrorId.asReadonly();
  readonly creating    = this._creating.asReadonly();
  readonly createError = this._createError.asReadonly();
  readonly renamingId  = this._renamingId.asReadonly();
  readonly renameValue = this._renameValue.asReadonly();

  // ── Active dashboard (from registry, works in both modes) ─────
  readonly activeDashboardId = this.registry.activeDashboardId;

  ngOnInit(): void {
    this.loadList();
  }

  private async loadList(): Promise<void> {
    this._loadState.set('loading');
    this._errorMsg.set('');
    this.cdr.markForCheck();

    if (!this.configSvc.useRealApi()) {
      // Mock mode: use in-memory summaries
      this._dashboards.set([...MOCK_DASHBOARD_SUMMARIES]);
      this._loadState.set('loaded');
      this.cdr.markForCheck();
      return;
    }

    try {
      const list = await firstValueFrom(this.api.list());
      this._dashboards.set(list);
      this._loadState.set('loaded');
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        this._errorMsg.set('UNAUTHORIZED');
      } else {
        this._errorMsg.set('NETWORK_ERROR');
      }
      this._loadState.set('error');
    }

    this.cdr.markForCheck();
  }

  // ── Open / navigate ────────────────────────────────────────────
  openDashboard(id: string): void {
    this.router.navigate(['/builder', id]);
  }

  // ── Create new dashboard ───────────────────────────────────────
  async createDashboard(): Promise<void> {
    if (this._creating()) return;
    this._createError.set('');
    this._creating.set(true);
    this.cdr.markForCheck();

    if (!this.configSvc.useRealApi()) {
      // Mock mode: navigate to blank builder (no id = fresh canvas)
      this._creating.set(false);
      this.router.navigate(['/builder']);
      return;
    }

    try {
      const newId = crypto.randomUUID();
      const created = await firstValueFrom(
        this.api.create({ id: newId, title: 'New Dashboard', widgets: [] })
      );
      this.registry.create(created.id, created.title ?? 'New Dashboard');
      this._creating.set(false);
      this.router.navigate(['/builder', created.id]);
    } catch {
      this._createError.set('Failed to create dashboard. Please try again.');
      this._creating.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  async deleteDashboard(id: string, event: Event): Promise<void> {
    event.stopPropagation();

    if (!confirm('Delete this dashboard? This cannot be undone.')) return;

    this._deleteErrorId.set(null);
    this._deletingId.set(id);
    this.cdr.markForCheck();

    if (!this.configSvc.useRealApi()) {
      // Mock mode: remove from local list and registry
      this._dashboards.update(list => list.filter(d => d.id !== id));
      this.registry.remove(id);
      this._deletingId.set(null);
      this.cdr.markForCheck();
      return;
    }

    try {
      await firstValueFrom(this.api.delete(id));
      this._dashboards.update(list => list.filter(d => d.id !== id));
      this.registry.remove(id);
      this._deletingId.set(null);
    } catch {
      this._deleteErrorId.set(id);
      this._deletingId.set(null);
    }

    this.cdr.markForCheck();
  }

  clearDeleteError(id: string, event: Event): void {
    event.stopPropagation();
    if (this._deleteErrorId() === id) this._deleteErrorId.set(null);
  }

  // ── Rename (inline) ───────────────────────────────────────────
  startRename(dash: DashboardSummary, event: Event): void {
    event.stopPropagation();
    this._renamingId.set(dash.id);
    this._renameValue.set(dash.title);
    this.cdr.markForCheck();
  }

  onRenameInput(value: string): void {
    this._renameValue.set(value);
  }

  cancelRename(): void {
    this._renamingId.set(null);
    this._renameValue.set('');
  }

  async commitRename(id: string): Promise<void> {
    const newTitle = this._renameValue().trim();
    if (!newTitle) { this.cancelRename(); return; }

    const dash = this._dashboards().find(d => d.id === id);
    if (!dash || dash.title === newTitle) { this.cancelRename(); return; }

    if (!this.configSvc.useRealApi()) {
      // Mock mode: update in-place and registry
      this._dashboards.update(list =>
        list.map(d => d.id === id ? { ...d, title: newTitle } : d)
      );
      this.registry.rename(id, newTitle);
      this.cancelRename();
      this.cdr.markForCheck();
      return;
    }

    try {
      await firstValueFrom(this.api.save(id, { title: newTitle, widgets: [] }));
      this._dashboards.update(list =>
        list.map(d => d.id === id ? { ...d, title: newTitle } : d)
      );
      this.registry.rename(id, newTitle);
    } catch {
      // Rename failed — keep old title, just close
    }
    this.cancelRename();
    this.cdr.markForCheck();
  }

  // ── Retry ─────────────────────────────────────────────────────
  retry(): void {
    this.loadList();
  }

  // ── Utility ───────────────────────────────────────────────────
  formatDate(updatedAt: string | undefined): string {
    if (!updatedAt) return 'Never saved';
    const d = new Date(updatedAt);
    if (isNaN(d.getTime())) return '—';
    const now  = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7)  return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }
}
