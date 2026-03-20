import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { getCatalogItem } from '../../../core/catalog';
import { TEMPLATES } from '../../../core/Templates';
import { DashboardService } from '../../../services/dashboard.service';

@Component({
  selector: 'app-templates-modal',
  imports: [],
  templateUrl: './templates-modal.html',
  styleUrl: './templates-modal.scss',
})
export class TemplatesModal {
  private readonly dialogRef = inject(MatDialogRef<TemplatesModal>);
  private readonly svc = inject(DashboardService);

  readonly templates = TEMPLATES;

  // Build widget-type chips for each template (unique types in build order)
  getTypeChips(tpl: typeof TEMPLATES[0]): { label: string; color: string }[] {
    const widgets = tpl.build();
    const seen = new Set<string>();
    return widgets
      .filter(w => { if (seen.has(w.type)) return false; seen.add(w.type); return true; })
      .map(w => {
        const cat = getCatalogItem(w.type as any);
        return { label: cat?.label ?? w.type, color: cat?.color ?? 'var(--acc)' };
      });
  }

  getWidgetCount(tpl: typeof TEMPLATES[0]): number {
    return tpl.build().length;
  }

  loadTemplate(tpl: typeof TEMPLATES[0]): void {
    // C3: loadTemplate RESETS history — not undoable back
    this.svc.loadTemplate(tpl.id);
    this.dialogRef.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}
