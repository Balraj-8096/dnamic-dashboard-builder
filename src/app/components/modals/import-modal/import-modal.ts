import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DashboardService } from '../../../services/dashboard.service';

@Component({
  selector: 'app-import-modal',
  imports: [],
  templateUrl: './import-modal.html',
  styleUrl: './import-modal.scss',
})
export class ImportModal {
  private readonly dialogRef = inject(MatDialogRef<ImportModal>);
  private readonly svc = inject(DashboardService);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  dragging = false;
  errorMsg = '';

  // ── Drag events ───────────────────────────────────────────────
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragging = true;
  }

  onDragLeave(): void {
    this.dragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  // ── File input ────────────────────────────────────────────────
  openFilePicker(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.handleFile(file);
    // Reset so the same file can be re-selected
    (e.target as HTMLInputElement).value = '';
  }

  // ── Core handler ──────────────────────────────────────────────
  private handleFile(file: File): void {
    if (!file.name.endsWith('.json')) {
      this.errorMsg = 'Please select a .json file.';
      return;
    }
    this.errorMsg = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // svc.importLayout returns null on success, error string on failure
      const result = this.svc.importLayout(text);
      if (typeof result === 'string') {
        // Error — keep modal open, show message
        this.errorMsg = result;
      } else {
        // Success — service calls closeImport(); afterClosed() syncs signal
        this.dialogRef.close();
      }
    };
    reader.readAsText(file);
  }

  close(): void {
    this.dialogRef.close();
  }
}
